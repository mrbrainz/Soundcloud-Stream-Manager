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
      chrome.storage.local.set({ [CACHE_KEY]: { cache, idIndex } });
    }, 300);
  }

  function cachedEntry(path) {
    const entry = cache[path];
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  }

  // Normalizes a raw /resolve or /tracks API record into the shape every
  // feature reads, and stores it. `playlists` starts empty here - the
  // playlist-membership feature (separate board card) owns populating it,
  // this module just reserves the slot so that feature doesn't need its
  // own parallel per-track cache.
  function storeTrack(track) {
    if (!track || typeof track.id !== 'number') return null;
    const path = track.permalink_url ? permalinkPath(track.permalink_url) : idIndex[track.id] || null;
    const data = {
      id: track.id,
      title: track.title || null,
      permalinkPath: path,
      createdAt: track.created_at || track.display_date || null,
      duration: typeof track.duration === 'number' ? track.duration : null,
      downloadable: !!track.downloadable,
      downloadUrl: track.download_url || null,
      playlists: (cache[path] && cache[path].data.playlists) || [],
    };
    if (path) {
      cache[path] = { data, fetchedAt: Date.now() };
      idIndex[track.id] = path;
      saveSoon();
    }
    return data;
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

  window.SCSMApi = {
    resolveByPermalinkPath,
    getTrackById,
    getCachedByPermalinkPath,
    permalinkPath,
  };
})();
