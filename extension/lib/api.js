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
  const CACHE_KEY = 'scsm_metadata_cache_v1';
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

  async function resolveByPermalinkPath(path) {
    await load();
    const cached = cachedEntry(path);
    if (cached) return cached;

    return dedupe('resolve:' + path, async () => {
      const clientId = window.SCSMAuth.getClientId();
      if (!clientId) return null;
      const url = 'https://soundcloud.com' + path;
      const res = await fetch(`${API_BASE}/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`, {
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
      const clientId = window.SCSMAuth.getClientId();
      if (!clientId) return null;
      const res = await fetch(`${API_BASE}/tracks/${id}?client_id=${clientId}&app_locale=en`, {
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
      const clientId = window.SCSMAuth.getClientId();
      if (!clientId) return null;
      const res = await fetch(`${API_BASE}/tracks/${trackId}/download?client_id=${clientId}`, {
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
