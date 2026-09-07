// ==UserScript==
// @name         SoundCloud Playlist Membership
// @namespace    https://mrbrainz.example/soundcloud-playlist-membership
// @version      1.4.0
// @description  Shows which of your own playlists (if any) already contain a track, right on the feed/library/search - built from the same data SoundCloud's own "Add to playlist" dialog uses.
// @author       DJ BrainZ
// @match        https://soundcloud.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
  HOW THIS WORKS
  ---------------
  SoundCloud's own "+" / "Add to playlist" dialog doesn't do a live "is this
  track in playlist X" check per click - it already has your entire playlist
  library (with full tracklists) loaded, and just does a local lookup. This
  script does the same thing:

  1. On load (and periodically / on demand), it crawls
     GET /users/{you}/playlists?...  (paginated, 10 at a time) with your
     session's OAuth token attached. Each playlist comes back with its full
     track list in one shot - the same call the native dialog uses - so this
     is ~10-15 requests total even with 100+ playlists, not one per playlist.
  2. That builds a local index: track id -> which of your playlists contain
     it. Cached in localStorage so this is a background/periodic cost, not
     a per-pageview one.
  3. It watches every track title it finds on the page (feed, library,
     search, playlist pages). Most of the time matching a title to a
     playlist is a pure local lookup with no network call at all; when the
     track's permalink hasn't been seen yet, it resolves just that one
     link lazily (see the note below) before deciding whether to badge it.
  4. It also patches XMLHttpRequest to watch for the PUT/POST/DELETE calls
     SoundCloud fires when YOU add/remove a track or create/delete a
     playlist from this browser, and updates the local index immediately so
     it never has to wait for the next full crawl to reflect your own
     actions. (Changes made from another device/browser are only picked up
     on the next periodic or manual re-crawl - this script has no way to
     know about those in real time.)

  This reuses your session's OAuth token (read from the same non-httpOnly
  `oauth_token` cookie the page itself uses) - same trust boundary as any
  other script running on the page, nothing leaves your browser.

  NOTE ON A SOUNDCLOUD QUIRK: the playlists endpoint silently returns a
  "stub" track object (just id/kind, no permalink/title/etc) for any track
  it's already sent you once in this session - so a straightforward crawl
  only resolves a fraction of tracks to a permalink. Rather than batch-
  resolving the rest in a burst of GET /tracks?ids=... calls (a traffic
  shape no normal user or the native web app ever produces), this script
  resolves the remainder lazily and one at a time - only for tracks you
  actually scroll past - via GET /resolve?url=..., the same endpoint and
  concurrency-limited queue the companion repost-age script already uses.
  Confirmed live: /resolve always returns the full record regardless of
  the stub-dedup state, so it's a safe, low-volume, organic-looking way to
  fill in the gaps over time instead of all at once.

  NOTE ON A TRACK'S OWN PAGE (soundcloud.com/artist/track): SoundCloud
  doesn't render that page in the top-level document at all - it loads it
  inside a same-origin iframe (class "webiIframe"), a newer rewrite that
  uses a plain <h1> for the title with none of the a.soundTitle__title
  anchors the rest of the site uses. Tampermonkey already injects a
  separate copy of this script into every matching frame, including that
  one, so rather than blanket-skipping all iframes (which would also skip
  legitimate content and hide the badge on a track's own page), only
  frames whose path doesn't look like a track/playlist permalink at all
  (ad frames, the sandboxed crossfade player) are skipped. The crawl,
  its auto-refresh timer, and the manual-refresh button still only run in
  the top frame, so visiting many individual track pages doesn't trigger
  redundant crawls.

  NOTE ON THE FEED SPECIFICALLY: it's a fast, virtualized, never-ending
  scroll of tracks you've mostly never visited before, so it's the page
  most likely to have a burst of unresolved permalinks mount at once. To
  keep a track you're actually looking at from getting stuck behind a
  queue of resolves for cards you've already scrolled past, an unresolved
  anchor's /resolve is deferred (via IntersectionObserver) until it
  actually scrolls into view, rather than fired the instant it's added to
  the DOM.
*/

(function () {
  'use strict';

  // A track or playlist's OWN page (soundcloud.com/artist/track) is not
  // rendered by the top-level document at all - SoundCloud loads it inside
  // a same-origin iframe (class "webiIframe"), a newer MUI-based rewrite
  // with completely different markup (an <h1>, no a.soundTitle__title
  // anchors) from the classic list rows used in the feed/search/library.
  // Tampermonkey's @match (no @noframes) already runs a separate copy of
  // this script inside every matching frame, including that one - so
  // rather than blanket-skipping all iframes (which would also hide
  // badges on your own track/playlist pages), only skip frames whose path
  // doesn't look like a track/playlist permalink at all (ad frames, the
  // sandboxed crossfade player).
  const isTopFrame = window.top === window.self;
  const STANDALONE_PATH_RE = /^\/n?\/([^/]+)\/(sets\/)?([^/]+)\/?$/;
  if (!isTopFrame && !STANDALONE_PATH_RE.test(location.pathname)) return;

  const CACHE_KEY = 'sc_playlist_membership_cache_v1';
  const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12; // re-crawl every 12h in case another device changed things
  const CRAWL_PAGE_SIZE = 10;
  const CRAWL_DELAY_MS = 250; // be polite between pagination requests
  const BADGE_CLASS = 'sc-playlist-badge';

  console.log('[SC Playlist Membership] v1.4.0 loaded on', location.href, '(top frame:', isTopFrame + ')');

  // ---------- auth helpers ----------
  function getClientId() {
    try {
      const hydration = window.__sc_hydration;
      if (Array.isArray(hydration)) {
        const entry = hydration.find((e) => e && e.hydratable === 'apiClient');
        if (entry && entry.data && entry.data.id) return entry.data.id;
      }
    } catch (e) {}
    return null;
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getOAuthToken() {
    return getCookie('oauth_token');
  }

  function getMyUserId() {
    try {
      const hydration = window.__sc_hydration;
      if (Array.isArray(hydration)) {
        const entry = hydration.find((e) => e && e.hydratable === 'meUser');
        if (entry && entry.data && entry.data.id) return entry.data.id;
      }
    } catch (e) {}
    return null;
  }

  function authHeaders() {
    const token = getOAuthToken();
    return token ? { Authorization: 'OAuth ' + token } : {};
  }

  // ---------- persistent index ----------
  // Shape:
  // {
  //   builtAt: <ms epoch>,
  //   playlists: { [playlistId]: { title, trackIds: number[] } },
  //   trackIndex: { [trackId]: playlistId[] },
  //   permalinkToTrackId: { [permalinkPath]: trackId }
  // }
  function emptyIndex() {
    return { builtAt: 0, playlists: {}, trackIndex: {}, permalinkToTrackId: {} };
  }

  function loadIndex() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return emptyIndex();
      const parsed = JSON.parse(raw);
      return {
        builtAt: parsed.builtAt || 0,
        playlists: parsed.playlists || {},
        trackIndex: parsed.trackIndex || {},
        permalinkToTrackId: parsed.permalinkToTrackId || {},
      };
    } catch (e) {
      return emptyIndex();
    }
  }

  let INDEX = loadIndex();
  let saveTimer = null;
  function saveIndexSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(INDEX));
      } catch (e) {
        console.warn('[SC Playlist Membership] failed to persist index (storage full?)', e);
      }
    }, 300);
  }

  function permalinkPath(url) {
    try {
      return new URL(url).pathname;
    } catch (e) {
      return url;
    }
  }

  // ---------- background crawl ----------
  let crawlInFlight = null;
  function crawlPlaylists({ quiet } = {}) {
    if (crawlInFlight) return crawlInFlight;

    crawlInFlight = (async () => {
      const clientId = getClientId();
      const myId = getMyUserId();
      if (!clientId || !myId) {
        console.warn('[SC Playlist Membership] missing client_id or user id, skipping crawl');
        return;
      }

      const fresh = { builtAt: Date.now(), playlists: {}, trackIndex: {}, permalinkToTrackId: {} };
      let offset = 0;
      let total = 0;

      for (;;) {
        const url =
          `https://api-v2.soundcloud.com/users/${myId}/playlists` +
          `?client_id=${clientId}&limit=${CRAWL_PAGE_SIZE}&offset=${offset}` +
          `&linked_partitioning=1&app_locale=en`;
        let res;
        try {
          res = await fetch(url, { credentials: 'include', headers: authHeaders() });
        } catch (e) {
          console.warn('[SC Playlist Membership] crawl request failed, stopping this pass', e);
          break;
        }
        if (!res.ok) {
          console.warn('[SC Playlist Membership] crawl got status', res.status, '- stopping this pass');
          break;
        }
        let data;
        try {
          data = await res.json();
        } catch (e) {
          break;
        }
        const collection = Array.isArray(data.collection) ? data.collection : [];
        if (collection.length === 0) break;

        for (const playlist of collection) {
          const pid = playlist.id;
          const trackIds = [];
          const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
          for (const t of tracks) {
            if (typeof t.id !== 'number') continue;
            trackIds.push(t.id);
            if (t.permalink_url) {
              fresh.permalinkToTrackId[permalinkPath(t.permalink_url)] = t.id;
            }
            (fresh.trackIndex[t.id] = fresh.trackIndex[t.id] || []).push(pid);
          }
          fresh.playlists[pid] = { title: playlist.title, trackIds };
          total++;
        }

        if (collection.length < CRAWL_PAGE_SIZE) break;
        offset += CRAWL_PAGE_SIZE;
        await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
      }

      // Merge rather than replace permalinkToTrackId: lazy on-demand
      // resolves (see resolvePermalinkForHref below) may have already
      // filled in some entries this session that a fresh crawl's stubs
      // wouldn't include, and there's no reason to throw that away.
      fresh.permalinkToTrackId = Object.assign({}, INDEX.permalinkToTrackId, fresh.permalinkToTrackId);

      INDEX = fresh;
      saveIndexSoon();
      if (!quiet) {
        const unresolvedCount = Object.keys(fresh.trackIndex).length - Object.keys(fresh.permalinkToTrackId).length;
        console.log(
          `[SC Playlist Membership] index rebuilt: ${total} playlists, ${Object.keys(fresh.trackIndex).length} distinct tracks, ` +
          `${Object.keys(fresh.permalinkToTrackId).length} already resolved to permalinks (rest resolve lazily as you browse)`
        );
      }
      annotateAll();
    })().finally(() => {
      crawlInFlight = null;
    });

    return crawlInFlight;
  }

  function maybeAutoRefresh() {
    if (Date.now() - INDEX.builtAt > REFRESH_INTERVAL_MS) {
      crawlPlaylists({ quiet: true });
    }
  }

  // ---------- keep the index in sync with adds/removes/creates/deletes ----------
  // Confirmed live: adding/removing a track is PUT /playlists/{id} with body
  // {"playlist":{"tracks":[<id>,<id>,...]}} - the FULL new track id list, not
  // a single add/remove op. Playlist creation is POST /playlists (no id
  // suffix); deletion is DELETE /playlists/{id}.
  const PLAYLIST_ID_RE = /\/playlists\/(\d+)(?:\?|$)/;
  const PLAYLIST_CREATE_RE = /\/playlists\/?(?:\?|$)/;

  // ---------- lazy, on-demand permalink resolution ----------
  // Resolves a track id -> permalink one at a time via GET /resolve, using
  // the SAME endpoint and concurrency-limited queue pattern as the
  // companion repost-age script. This is deliberately NOT a batch sweep:
  // it only ever resolves ids you actually need (a track just added to a
  // playlist, or one visible on the page right now), so the traffic it
  // generates looks like ordinary link-resolution activity rather than a
  // scripted burst. /resolve needs a URL, not an id, so for the sync path
  // (where we only have numeric ids from the PUT/POST body) this fetches
  // the track by id first via a single GET /tracks/{id} - one request per
  // track, exactly mirroring a user opening that one track's page - then
  // resolves; for the DOM path (see resolvePermalinkForHref) we already
  // have the permalink from the href itself and skip straight to /resolve.
  const MAX_CONCURRENT_RESOLVES = 3;
  const resolveQueue = [];
  let resolvePending = 0;
  function resolveDrain() {
    while (resolvePending < MAX_CONCURRENT_RESOLVES && resolveQueue.length) {
      const job = resolveQueue.shift();
      resolvePending++;
      job().finally(() => {
        resolvePending--;
        resolveDrain();
      });
    }
  }
  function enqueueResolve(job) {
    return new Promise((resolve) => {
      resolveQueue.push(async () => {
        try {
          resolve(await job());
        } catch (e) {
          resolve(null);
        }
      });
      resolveDrain();
    });
  }

  // Used by the add/create sync path: we only have numeric track ids (no
  // permalink) from the intercepted request body, so fetch each one's own
  // record directly - a single, ordinary-looking GET per track, no
  // different from a user opening that track's page.
  async function hydratePermalinks(trackIds) {
    const known = new Set(Object.values(INDEX.permalinkToTrackId));
    const unresolved = trackIds.filter((id) => !known.has(id));
    if (unresolved.length === 0) return;
    const clientId = getClientId();
    if (!clientId) return;
    await Promise.all(
      unresolved.map((id) =>
        enqueueResolve(async () => {
          const res = await fetch(`https://api-v2.soundcloud.com/tracks/${id}?client_id=${clientId}&app_locale=en`, {
            credentials: 'include',
            headers: authHeaders(),
          });
          if (!res.ok) return null;
          const t = await res.json();
          if (t && t.permalink_url && typeof t.id === 'number') {
            INDEX.permalinkToTrackId[permalinkPath(t.permalink_url)] = t.id;
          }
          return null;
        })
      )
    );
  }

  // Used by the DOM annotation path: we already have the permalink (from
  // the href SoundCloud rendered), so this is a single /resolve call per
  // unresolved track actually seen on the page - the same shape as
  // pasting/opening that link. resolveInflight dedupes repeat calls for
  // the same permalink while one is already in flight (a MutationObserver
  // rescan can otherwise fire before the first resolve completes).
  const resolveInflight = new Map();
  const resolveFailed = new Set(); // paths that came back null this session - don't hammer them on every rescan
  function resolvePermalinkForHref(href) {
    const url = 'https://soundcloud.com' + href;
    const path = permalinkPath(url);
    if (INDEX.permalinkToTrackId[path] != null) return Promise.resolve(INDEX.permalinkToTrackId[path]);
    if (resolveFailed.has(path)) return Promise.resolve(null);
    if (resolveInflight.has(path)) return resolveInflight.get(path);

    const promise = enqueueResolve(async () => {
      const clientId = getClientId();
      if (!clientId) return null;
      const res = await fetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`, {
        credentials: 'omit',
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data.id === 'number') {
        INDEX.permalinkToTrackId[path] = data.id;
        saveIndexSoon();
        return data.id;
      }
      resolveFailed.add(path);
      return null;
    }).finally(() => resolveInflight.delete(path));

    resolveInflight.set(path, promise);
    return promise;
  }

  async function applyPlaylistTrackIds(playlistId, trackIds, title) {
    const prev = INDEX.playlists[playlistId];
    const prevSet = new Set(prev ? prev.trackIds : []);
    const nextSet = new Set(trackIds);
    const addedIds = [...nextSet].filter((tid) => !prevSet.has(tid));

    for (const tid of prevSet) {
      if (!nextSet.has(tid) && INDEX.trackIndex[tid]) {
        INDEX.trackIndex[tid] = INDEX.trackIndex[tid].filter((pid) => pid !== playlistId);
        if (INDEX.trackIndex[tid].length === 0) delete INDEX.trackIndex[tid];
      }
    }
    for (const tid of nextSet) {
      if (!prevSet.has(tid)) {
        INDEX.trackIndex[tid] = INDEX.trackIndex[tid] || [];
        if (!INDEX.trackIndex[tid].includes(playlistId)) INDEX.trackIndex[tid].push(playlistId);
      }
    }

    INDEX.playlists[playlistId] = {
      title: title || (prev && prev.title) || (INDEX.playlists[playlistId] && INDEX.playlists[playlistId].title) || '(untitled)',
      trackIds: [...nextSet],
    };
    saveIndexSoon();
    annotateAll();

    // The PUT/POST bodies we intercept this from only carry numeric track
    // ids, no metadata - resolve permalinks for newly-added tracks in the
    // background so their badge appears without waiting for a recrawl.
    if (addedIds.length > 0) {
      await hydratePermalinks(addedIds);
      saveIndexSoon();
      annotateAll();
    }
  }

  function removePlaylistFromIndex(playlistId) {
    const prev = INDEX.playlists[playlistId];
    if (!prev) return;
    for (const tid of prev.trackIds) {
      if (INDEX.trackIndex[tid]) {
        INDEX.trackIndex[tid] = INDEX.trackIndex[tid].filter((pid) => pid !== playlistId);
        if (INDEX.trackIndex[tid].length === 0) delete INDEX.trackIndex[tid];
      }
    }
    delete INDEX.playlists[playlistId];
    saveIndexSoon();
    annotateAll();
  }

  function patchXHR() {
    const OrigXHR = window.XMLHttpRequest;
    const origOpen = OrigXHR.prototype.open;
    const origSend = OrigXHR.prototype.send;

    OrigXHR.prototype.open = function (method, url, ...rest) {
      this.__scMethod = method;
      this.__scUrl = url;
      return origOpen.call(this, method, url, ...rest);
    };

    OrigXHR.prototype.send = function (body) {
      const method = (this.__scMethod || '').toUpperCase();
      const url = this.__scUrl || '';

      if (typeof url === 'string' && url.includes('api-v2.soundcloud.com/playlists')) {
        const idMatch = url.match(PLAYLIST_ID_RE);

        if (method === 'PUT' && idMatch) {
          const playlistId = Number(idMatch[1]);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try {
              const parsed = JSON.parse(body);
              const trackIds = parsed && parsed.playlist && Array.isArray(parsed.playlist.tracks) ? parsed.playlist.tracks : null;
              if (trackIds) applyPlaylistTrackIds(playlistId, trackIds);
            } catch (e) {
              console.warn('[SC Playlist Membership] could not parse PUT body for sync', e);
            }
          });
        } else if (method === 'DELETE' && idMatch) {
          const playlistId = Number(idMatch[1]);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            removePlaylistFromIndex(playlistId);
          });
        } else if (method === 'POST' && !idMatch && PLAYLIST_CREATE_RE.test(url)) {
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try {
              const created = JSON.parse(this.responseText);
              if (created && typeof created.id === 'number') {
                const tracks = Array.isArray(created.tracks) ? created.tracks : [];
                const trackIds = tracks.map((t) => t.id).filter((id) => typeof id === 'number');
                for (const t of tracks) {
                  if (t.permalink_url && typeof t.id === 'number') {
                    INDEX.permalinkToTrackId[permalinkPath(t.permalink_url)] = t.id;
                  }
                }
                applyPlaylistTrackIds(created.id, trackIds, created.title);
              }
            } catch (e) {
              console.warn('[SC Playlist Membership] could not parse playlist-create response for sync', e);
            }
          });
        }
      }

      return origSend.call(this, body);
    };
  }

  // ---------- DOM: find track titles and annotate them ----------
  function findTrackId(href) {
    const path = permalinkPath('https://soundcloud.com' + href);
    return INDEX.permalinkToTrackId[path];
  }

  function badgeFor(trackId) {
    const playlistIds = INDEX.trackIndex[trackId];
    if (!playlistIds || playlistIds.length === 0) return null;
    const titles = playlistIds.map((pid) => (INDEX.playlists[pid] ? INDEX.playlists[pid].title : null)).filter(Boolean);
    if (titles.length === 0) return null;
    return titles;
  }

  // Defers a permalink's /resolve until its anchor actually scrolls into
  // (near) view, instead of the moment it's added to the DOM. One shared
  // observer for every not-yet-resolved anchor currently on the page;
  // rootMargin gives a small head start so the badge is usually already
  // there by the time an element fully scrolls into place.
  const pendingVisibilityResolve = new WeakMap(); // anchor -> href, for dedup
  let visibilityObserver = null;
  function getVisibilityObserver() {
    if (visibilityObserver) return visibilityObserver;
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const a = entry.target;
          const href = pendingVisibilityResolve.get(a);
          visibilityObserver.unobserve(a);
          pendingVisibilityResolve.delete(a);
          if (!href || !a.isConnected) continue;
          resolvePermalinkForHref(href).then((resolved) => {
            if (resolved != null) annotateAnchor(a);
          });
        }
      },
      { rootMargin: '400px 0px' }
    );
    return visibilityObserver;
  }
  function queueResolveWhenVisible(a, href) {
    if (pendingVisibilityResolve.has(a)) return; // already queued
    pendingVisibilityResolve.set(a, href);
    getVisibilityObserver().observe(a);
  }

  function annotateAnchor(a) {
    const href = a.getAttribute('href');
    if (!href) return;
    // strip any existing badge first - titles/hrefs don't change under an
    // anchor instance, but re-scans should stay idempotent either way.
    const next = a.nextElementSibling;
    if (next && next.classList && next.classList.contains(BADGE_CLASS)) {
      // already annotated; only touch it if the membership actually changed
      const trackId = findTrackId(href);
      const titles = trackId != null ? badgeFor(trackId) : null;
      const wanted = titles ? renderLabel(titles) : null;
      if (wanted === next.dataset.label) return;
      next.remove();
      if (!titles) return;
    }

    let trackId = findTrackId(href);
    if (trackId == null) {
      // Permalink not resolved yet - don't queue a /resolve for it until it
      // actually scrolls into view. A long, fast-scrolling, virtualized page
      // like the Feed can mount dozens of never-before-seen anchors in a
      // couple of seconds, and queuing a resolve for every single one the
      // instant it's added to the DOM (regardless of whether it's actually
      // on screen) backs up the concurrency-limited queue - a track you're
      // actually looking at can end up waiting many seconds behind a pile of
      // resolves for cards you've already scrolled past. Gating on
      // visibility keeps the queue matched to what you're actually looking
      // at (and is, incidentally, an even lower-volume/more organic traffic
      // shape than resolving everything eagerly).
      queueResolveWhenVisible(a, href);
      return;
    }
    const titles = badgeFor(trackId);
    if (!titles) return;

    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    const label = renderLabel(titles);
    span.dataset.label = label;
    span.textContent = ' ' + label;
    span.style.opacity = '0.75';
    span.style.color = '#3fa9f5';
    span.title = 'In your playlist' + (titles.length > 1 ? 's' : '') + ':\n' + titles.join('\n');
    a.insertAdjacentElement('afterend', span);
  }

  function renderLabel(titles) {
    return titles.length === 1 ? `✓ in "${titles[0]}"` : `✓ in ${titles.length} playlists`;
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (!root) return;
    if (root.matches && root.matches('a.soundTitle__title[href]')) annotateAnchor(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll('a.soundTitle__title[href]').forEach(annotateAnchor);
  }

  // ---------- standalone track/playlist page (inside the webi iframe) ----------
  // This page has no a.soundTitle__title anchors at all - just a plain
  // <h1> with the title text and no href. Its own URL (with a leading "/n"
  // segment SoundCloud adds for this iframe route) IS the track/playlist's
  // permalink, so that's used directly instead of reading an href.
  function currentPagePermalinkPath() {
    return location.pathname.replace(/^\/n(?=\/)/, '');
  }

  function annotateStandalonePage() {
    const h1 = document.querySelector('h1');
    if (!h1) return;
    const path = currentPagePermalinkPath();

    const next = h1.nextElementSibling;
    if (next && next.classList && next.classList.contains(BADGE_CLASS)) {
      const trackId = INDEX.permalinkToTrackId[path];
      const titles = trackId != null ? badgeFor(trackId) : null;
      const wanted = titles ? renderLabel(titles) : null;
      if (wanted === next.dataset.label) return;
      next.remove();
      if (!titles) return;
    }

    const trackId = INDEX.permalinkToTrackId[path];
    if (trackId == null) {
      resolvePermalinkForHref(path).then((resolved) => {
        if (resolved != null) annotateStandalonePage();
      });
      return;
    }
    const titles = badgeFor(trackId);
    if (!titles) return;

    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    const label = renderLabel(titles);
    span.dataset.label = label;
    span.textContent = ' ' + label;
    span.style.opacity = '0.75';
    span.style.color = '#3fa9f5';
    span.style.fontSize = '0.5em';
    span.style.verticalAlign = 'middle';
    span.title = 'In your playlist' + (titles.length > 1 ? 's' : '') + ':\n' + titles.join('\n');
    h1.insertAdjacentElement('afterend', span);
  }

  function annotateAll() {
    scan(document.body);
    annotateStandalonePage();
  }

  let debounceTimer = null;
  const dirty = new Set();
  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => dirty.add(node));
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const nodes = [...dirty];
        dirty.clear();
        nodes.forEach((node) => scan(node));
        annotateStandalonePage();
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- tiny manual-refresh affordance ----------
  function addRefreshButton() {
    const btn = document.createElement('button');
    btn.textContent = '⟳ playlist index';
    btn.title = 'Click to re-crawl your playlists now';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '12px',
      right: '12px',
      zIndex: 999999,
      padding: '6px 10px',
      fontSize: '11px',
      opacity: '0.55',
      background: '#111',
      color: '#fff',
      border: '1px solid #444',
      borderRadius: '6px',
      cursor: 'pointer',
    });
    btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
    btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.55'));
    btn.addEventListener('click', () => {
      btn.textContent = '⟳ crawling…';
      crawlPlaylists().then(() => {
        btn.textContent = '⟳ playlist index';
      });
    });
    document.body.appendChild(btn);
  }

  // ---------- boot ----------
  // patchXHR/observeDom/annotateAll run in every frame this script is
  // active in (top page or the standalone-page iframe) - an add/remove can
  // be triggered from either. The crawl itself, its auto-refresh timer,
  // and the manual-refresh button only run in the top frame, so visiting
  // N track pages doesn't mean N redundant playlist crawls.
  patchXHR();
  observeDom();
  annotateAll();
  if (isTopFrame) {
    maybeAutoRefresh();
    if (INDEX.builtAt === 0) crawlPlaylists();
    if (document.body) addRefreshButton();
    else document.addEventListener('DOMContentLoaded', addRefreshButton, { once: true });
  }

  // expose for manual use from the console if wanted
  window.__scPlaylistMembership = {
    refresh: () => crawlPlaylists(),
    index: () => INDEX,
  };
})();