// Shared per-track metadata cache + concurrency-limited request queue,
// sitting on top of lib/auth.js. Every feature (repost age, hide-old,
// hide-long, download button, and eventually playlist membership) reads
// track metadata through this one module instead of hitting
// api-v2.soundcloud.com independently - see the "Auth/API helper module"
// board card and docs/context.md.
//
// Two ways in, matching how the reference scripts use the API:
// - resolveByPermalinkPath(path): GET /resolve?url=... - used when a DOM
//   anchor's href is already known (feed/library/search rows, and the
//   standalone track/playlist page's own URL).
// - getTrackById(id): GET /tracks/{id} - used when only a numeric id is
//   known (e.g. a track id read out of an intercepted XHR body, as the
//   playlist-membership sync path will need later).
// Both funnel through the same cache and queue, keyed so a resolve-by-path
// and a later get-by-id for the same track share one cache entry.
(function () {
  'use strict';

  const API_BASE = 'https://api-v2.soundcloud.com';
  // Bumped v1 -> v2 when #53 added `genre` to storeTrack()'s normalized
  // shape: resolveByPermalinkPath()/getTrackById() return a cached entry
  // as-is within the 30-day TTL with no shape check, so every track
  // already cached under v1 (i.e. almost everything, this many hours into
  // active use) would otherwise stay permanently missing `genre` until
  // its TTL happened to expire - hideGenreTracks.js silently failing to
  // match tracks that visibly ARE tagged with a hidden genre. A key bump
  // is a full, clean invalidation; bump it again for any future field
  // that changes storeTrack()'s shape.
  const CACHE_KEY = 'scsm_metadata_cache_v2';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days - matches the repost-age reference script; upload dates/durations don't change, this just bounds cache growth
  const MAX_CONCURRENT = 3; // same limit the reference scripts use to stay low-volume/organic-looking

  // In-memory, chrome.storage.local-backed. permalinkPath -> {data, fetchedAt}.
  let cache = {};
  let idIndex = {}; // trackId -> permalinkPath, so getTrackById can hit the same cache entry a resolve() call already populated
  // trackId -> playlist descriptors, for a track the playlist-membership
  // feature has crawled but that has no permalink-keyed cache entry yet
  // (SoundCloud's playlists endpoint returns a bare stub - id/kind only -
  // for any track it's already sent the caller once this session; see
  // references/soundcloud-playlist-membership.user.js). Merged into the
  // real cache entry the moment one exists (storeTrack below).
  let pendingPlaylistsByTrackId = {};
  let loadPromise = null;

  function permalinkPath(url) {
    try {
      return new URL(url).pathname;
    } catch (e) {
      return url;
    }
  }

  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve) => {
      chrome.storage.local.get(CACHE_KEY, (result) => {
        const stored = result && result[CACHE_KEY];
        if (stored) {
          cache = stored.cache || {};
          idIndex = stored.idIndex || {};
          pendingPlaylistsByTrackId = stored.pendingPlaylists || {};
        }
        resolve();
      });
    });
    return loadPromise;
  }

  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.local.set({ [CACHE_KEY]: { cache, idIndex, pendingPlaylists: pendingPlaylistsByTrackId } });
    }, 300);
  }

  function cachedEntry(path) {
    const entry = cache[path];
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  }

  // Normalizes a raw /resolve or /tracks API record into the shape every
  // feature reads, and stores it. `playlists` is populated from whatever
  // the playlist-membership feature has already recorded for this track -
  // either a prior cache entry, or a pending-by-id entry if this is the
  // first time this track has ever gotten a permalink-keyed cache entry.
  function storeTrack(track) {
    if (!track || typeof track.id !== 'number') return null;
    const path = track.permalink_url ? permalinkPath(track.permalink_url) : idIndex[track.id] || null;
    const data = {
      id: track.id,
      title: track.title || null,
      // Prefer publisher_metadata.artist over the uploading account's
      // username - labels/aggregator accounts routinely post under a
      // different name than the actual artist (confirmed live: a track
      // uploaded by the "Nawty Records" account with publisher_metadata.artist
      // "Neumonic" - searching platforms for "Nawty Records <title>" would
      // rarely find the real release). Matches user.username for a plain
      // self-uploader (confirmed live too), so this is safe as a blanket
      // preference, not just a label-specific special case.
      artist: (track.publisher_metadata && track.publisher_metadata.artist) || (track.user && track.user.username) || null,
      permalinkPath: path,
      genre: track.genre || null,
      createdAt: track.created_at || track.display_date || null,
      duration: typeof track.duration === 'number' ? track.duration : null,
      downloadable: !!track.downloadable,
      playlists: (cache[path] && cache[path].data.playlists) || pendingPlaylistsByTrackId[track.id] || [],
    };
    if (path) {
      cache[path] = { data, fetchedAt: Date.now() };
      idIndex[track.id] = path;
      if (pendingPlaylistsByTrackId[track.id]) {
        delete pendingPlaylistsByTrackId[track.id];
      }
      saveSoon();
    }
    return data;
  }

  // Playlist-membership write path: sets which playlists (an array of
  // {id, title}) a track id belongs to. Writes straight into the
  // permalink-keyed cache entry if one already exists; otherwise holds it
  // in pendingPlaylistsByTrackId until a resolve/getTrackById call for
  // that track creates one (storeTrack above merges it in at that point).
  async function setPlaylistsForTrackId(trackId, playlists) {
    await load();
    const path = idIndex[trackId];
    if (path && cache[path]) {
      cache[path].data.playlists = playlists;
    } else {
      pendingPlaylistsByTrackId[trackId] = playlists;
    }
    saveSoon();
  }

  // ---- concurrency-limited queue ----
  const queue = [];
  let pending = 0;
  function drain() {
    while (pending < MAX_CONCURRENT && queue.length) {
      const job = queue.shift();
      pending++;
      job().finally(() => {
        pending--;
        drain();
      });
    }
  }
  function enqueue(job) {
    return new Promise((resolve) => {
      queue.push(async () => {
        try {
          resolve(await job());
        } catch (e) {
          resolve(null);
        }
      });
      drain();
    });
  }

  // De-dupes concurrent callers asking for the same key while a request is
  // already in flight (e.g. a MutationObserver rescan firing before the
  // first resolve completes) so they share one network call.
  const inflight = new Map();
  function dedupe(key, factory) {
    if (inflight.has(key)) return inflight.get(key);
    const p = enqueue(factory).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  // content/mainWorldBridge.js bridges client_id from the page's own
  // window.__sc_hydration asynchronously (it may not be set yet at
  // document_start, so that file polls up to 30x100ms) - lib/auth.js's
  // getClientId() just reads whatever's on the DOM right now, synchronously,
  // with no memory of "it's not there YET" vs "it's never coming." Every
  // feature's very first rescan() (triggered as soon as its own setting is
  // read, at document_idle - which can still race ahead of that bridge on a
  // slow/cold page load) used to hit this and simply give up for that
  // resolve attempt, with nothing ever retrying it: a feature relying on a
  // one-shot resolveByPermalinkPath()/getTrackById() succeeding to render
  // anything at all (e.g. downloadButton.js's confirmed-downloadable check)
  // could end up rendering NOTHING on initial load, only recovering once
  // some later event (a toggle off/on, another rescan) happened to fire
  // after the bridge had caught up - live-verified as the actual cause of
  // "the download button needs a toggle off/on to appear" (#83). Wait for
  // it here, once, shared by every caller below, instead of each one
  // re-implementing its own "maybe try again later."
  async function waitForClientId() {
    for (let i = 0; i < 20; i++) {
      const id = window.SCSMAuth.getClientId();
      if (id) return id;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  // resolveByPermalinkPath/getTrackById/getDownloadRedirectUrl all funnel
  // through the SAME MAX_CONCURRENT-limited queue above - live-verified
  // (#85) that SoundCloud's API can leave a request permanently pending
  // (never resolving, never rejecting, no HTTP response at all - looked
  // like anti-bot throttling under the bursty concurrent-resolve pattern
  // every feature's initial rescan produces). A plain fetch() has no
  // built-in timeout, so a single stuck request would occupy one of only
  // 3 concurrency slots FOREVER, and everything queued behind it - across
  // every feature - would simply never run. Abort and free the slot
  // instead, treating it the same as any other failed request.
  // Overridable by test fixtures (set window.__SCSM_TEST_FETCH_TIMEOUT_MS
  // before this file loads) so a regression test can prove the timeout
  // actually frees a wedged queue slot without a real 15s wait.
  const FETCH_TIMEOUT_MS = window.__SCSM_TEST_FETCH_TIMEOUT_MS || 15000;
  function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  // Live-verified (#87): a single burst of concurrent resolves across every
  // feature's initial rescan is enough to trip SoundCloud's own rate
  // limiting - a 429 with a valid client_id AND a valid OAuth header, not
  // an auth problem. Before this, `if (!res.ok) return null` treated a
  // transient, retryable 429/503 exactly the same as a genuine 404 "this
  // track doesn't exist" - one rate-limited moment early in a session could
  // permanently blank out a feature (e.g. downloadButton.js never showing a
  // button for a track that IS downloadable) with no retry, ever. Respects
  // Retry-After when the server sends one; otherwise backs off
  // exponentially. Overridable in tests (window.__SCSM_TEST_RETRY_DELAY_MS)
  // so a regression test doesn't have to sit through a real multi-second
  // backoff.
  const MAX_RETRIES = 2;
  const RETRY_BASE_DELAY_MS = window.__SCSM_TEST_RETRY_DELAY_MS || 1000;
  async function fetchWithRetry(url, options) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchWithTimeout(url, options);
      if ((res.status !== 429 && res.status !== 503) || attempt >= MAX_RETRIES) return res;
      const retryAfterSeconds = Number(res.headers.get('Retry-After'));
      const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  async function resolveByPermalinkPath(path) {
    await load();
    const cached = cachedEntry(path);
    if (cached) return cached;

    return dedupe('resolve:' + path, async () => {
      const clientId = await waitForClientId();
      if (!clientId) return null;
      const url = 'https://soundcloud.com' + path;
      const res = await fetchWithRetry(`${API_BASE}/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`, {
        credentials: 'omit',
      });
      if (!res.ok) return null;
      const track = await res.json();
      return storeTrack(track);
    });
  }

  async function getTrackById(id) {
    await load();
    const knownPath = idIndex[id];
    if (knownPath) {
      const cached = cachedEntry(knownPath);
      if (cached) return cached;
    }

    return dedupe('id:' + id, async () => {
      const clientId = await waitForClientId();
      if (!clientId) return null;
      const res = await fetchWithRetry(`${API_BASE}/tracks/${id}?client_id=${clientId}&app_locale=en`, {
        credentials: 'include',
        headers: window.SCSMAuth.authHeaders(),
      });
      if (!res.ok) return null;
      const track = await res.json();
      return storeTrack(track);
    });
  }

  // Sync, no-fetch read for callers that only want an already-cached
  // answer (e.g. deciding whether a DOM element needs annotating at all).
  function getCachedByPermalinkPath(path) {
    return cachedEntry(path);
  }

  // All track ids currently cached with non-empty playlist membership.
  // Lets the playlist-membership feature's crawl clear a track that has
  // dropped OUT of every playlist since the last crawl - the crawl itself
  // only ever sees tracks that are STILL in at least one playlist, so
  // without this a track removed from its only playlist would keep
  // showing a stale badge indefinitely, even across a page refresh (see
  // board card #33).
  async function getAllTrackIdsWithPlaylists() {
    await load();
    const ids = [];
    for (const entry of Object.values(cache)) {
      if (entry && entry.data && Array.isArray(entry.data.playlists) && entry.data.playlists.length > 0) {
        ids.push(entry.data.id);
      }
    }
    return ids;
  }

  // Resolves the actual signed download link for a track the API has
  // already confirmed `downloadable`. NOT part of storeTrack()'s cached
  // shape - live-verified (#38) that /resolve and /tracks/{id} no longer
  // return a `download_url` field at all (SoundCloud dropped it), even for
  // a genuinely downloadable track. The real link now only comes from this
  // separate endpoint, which - also confirmed live - 401s under a plain
  // client_id and requires the real OAuth Authorization header (resolving
  // the "does this need OAuth" open question from #13's original PR: yes).
  // Not cached long-term like the rest of the metadata, since a signed
  // redirect URL is the kind of thing that can expire.
  async function getDownloadRedirectUrl(trackId) {
    return dedupe('download:' + trackId, async () => {
      const clientId = await waitForClientId();
      if (!clientId) return null;
      const res = await fetchWithRetry(`${API_BASE}/tracks/${trackId}/download?client_id=${clientId}`, {
        credentials: 'include',
        headers: window.SCSMAuth.authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data.redirectUri) || null;
    });
  }

  window.SCSMApi = {
    resolveByPermalinkPath,
    getTrackById,
    getCachedByPermalinkPath,
    setPlaylistsForTrackId,
    getAllTrackIdsWithPlaylists,
    getDownloadRedirectUrl,
    permalinkPath,
  };
})();
