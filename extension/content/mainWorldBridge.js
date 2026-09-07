// Runs in the page's MAIN world (see manifest.json's "world": "MAIN" entry),
// not the isolated world every other content script file runs in. This is
// the ONLY file in the extension that can see window.__sc_hydration -
// that's a plain JS global the page's own bundle sets, and Chrome's
// isolated world (the default, and where chrome.storage/chrome.runtime are
// available) gets a completely separate `window` for JS-level globals even
// though it shares the same DOM as the main world.
//
// Bridges the client_id / logged-in user id across that boundary the only
// way both worlds can see: writing them onto a DOM attribute (the DOM,
// unlike JS globals, IS shared between worlds). lib/auth.js reads them
// back from there instead of touching window.__sc_hydration directly.
(function () {
  'use strict';

  function tryExtractAndPublish() {
    let hydration;
    try {
      hydration = window.__sc_hydration;
    } catch (e) {
      return false;
    }
    if (!Array.isArray(hydration)) return false;

    const apiClient = hydration.find((e) => e && e.hydratable === 'apiClient');
    const meUser = hydration.find((e) => e && e.hydratable === 'meUser');

    let found = false;
    if (apiClient && apiClient.data && apiClient.data.id) {
      document.documentElement.dataset.scsmClientId = apiClient.data.id;
      found = true;
    }
    if (meUser && meUser.data && meUser.data.id) {
      document.documentElement.dataset.scsmUserId = String(meUser.data.id);
    }
    return found;
  }

  // __sc_hydration may not be set yet this early (document_start, so this
  // bridge starts running before the page's own bundle has necessarily
  // executed) - poll briefly rather than giving up after one check.
  if (!tryExtractAndPublish()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryExtractAndPublish() || attempts >= 30) clearInterval(interval);
    }, 100);
  }

  // ---- playlist add/remove/create/delete sync (#61) ----
  // Must live here, in the MAIN world: this used to be
  // content/features/playlistMembership.js's own patchXHR(), patching
  // XMLHttpRequest.prototype from the isolated content-script world. But
  // SoundCloud's own app code - and the XHR calls it makes for
  // PUT/DELETE/POST /playlists/{id} - runs in the MAIN world, with a
  // completely separate XMLHttpRequest constructor. Live-verified (#61):
  // added a track to a real playlist, the real PUT fired, but the
  // isolated-world patch never saw it - only SoundCloud's own analytics
  // instrumentation showed up on the main world's
  // XMLHttpRequest.prototype.open. The mock test harness never caught this
  // because a plain HTML fixture has no isolated/main-world split.
  //
  // Bridges the parsed result to the isolated world the same way as
  // client_id/user id above, but via a CustomEvent on document instead of
  // a dataset attribute - DOM events, like the DOM itself, ARE shared
  // across worlds, and the result here is structured data (ids/arrays),
  // not a single string. playlistMembership.js (isolated world - the only
  // side with chrome.storage access to update the cache) listens for it.
  const PLAYLIST_ID_RE = /\/playlists\/(\d+)(?:\?|$)/;
  const PLAYLIST_CREATE_RE = /\/playlists\/?(?:\?|$)/;

  function publishPlaylistSync(detail) {
    document.dispatchEvent(new CustomEvent('scsm:playlist-sync', { detail }));
  }

  function patchPlaylistXHR() {
    const OrigXHR = window.XMLHttpRequest;
    const origOpen = OrigXHR.prototype.open;
    const origSend = OrigXHR.prototype.send;

    OrigXHR.prototype.open = function (method, url, ...rest) {
      this.__scsmMethod = method;
      // See lib/auth.js/#33's identical fix: modern app code can legally
      // pass a URL object (not a plain string) to .open() - normalize here,
      // at open() time, not later at read time in send().
      try {
        this.__scsmUrl = typeof url === 'string' ? url : String(url);
      } catch (e) {
        this.__scsmUrl = '';
      }
      return origOpen.call(this, method, url, ...rest);
    };

    OrigXHR.prototype.send = function (body) {
      const method = (this.__scsmMethod || '').toUpperCase();
      const url = this.__scsmUrl || '';

      if (url.includes('api-v2.soundcloud.com/playlists')) {
        const idMatch = url.match(PLAYLIST_ID_RE);

        if (method === 'PUT' && idMatch) {
          const playlistId = Number(idMatch[1]);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try {
              const parsed = JSON.parse(body);
              const trackIds = parsed && parsed.playlist && Array.isArray(parsed.playlist.tracks) ? parsed.playlist.tracks : null;
              if (trackIds) publishPlaylistSync({ type: 'put', playlistId, trackIds });
            } catch (e) {
              console.warn('[SCSM mainWorldBridge] could not parse PUT body for playlist sync', e);
            }
          });
        } else if (method === 'DELETE' && idMatch) {
          const playlistId = Number(idMatch[1]);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            publishPlaylistSync({ type: 'delete', playlistId });
          });
        } else if (method === 'POST' && !idMatch && PLAYLIST_CREATE_RE.test(url)) {
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try {
              const created = JSON.parse(this.responseText);
              if (created && typeof created.id === 'number') {
                const tracks = Array.isArray(created.tracks) ? created.tracks : [];
                const trackIds = tracks.map((t) => t.id).filter((id) => typeof id === 'number');
                publishPlaylistSync({ type: 'put', playlistId: created.id, trackIds, title: created.title });
              }
            } catch (e) {
              console.warn('[SCSM mainWorldBridge] could not parse playlist-create response for sync', e);
            }
          });
        }
      }

      return origSend.call(this, body);
    };
  }

  patchPlaylistXHR();

  // ---- SPA navigation sync (#79, follow-up to #65) ----
  // SoundCloud is a single-page app - clicking an in-app link (e.g. your
  // own avatar to your profile) navigates via history.pushState(), not a
  // real page load. Content scripts only run once per real load, so
  // nothing previously told any feature its `enabled` flag (computed by
  // applySetting() against #65's page-type gate) had gone stale for the
  // new URL - live-verified (#79): with only "feed" enabled, hide-filters
  // stayed active after navigating feed -> profile via an avatar click,
  // and only a real reload (which re-injects the content scripts fresh)
  // fixed it.
  //
  // pushState()/replaceState() are page-API patches, same rule as the
  // playlist XHR patch above: must happen here, in the MAIN world, since
  // SoundCloud's own router calls the MAIN world's History object, not
  // whatever the isolated world's content script would patch. Bridges via
  // a CustomEvent the same way - lib/dom.js (isolated world) listens for
  // it and re-notifies every feature to re-fetch settings and re-run
  // applySetting() against the new page.
  function publishNavigation() {
    document.dispatchEvent(new CustomEvent('scsm:navigation'));
  }

  function patchHistoryNavigation() {
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = origPushState.apply(this, args);
      publishNavigation();
      return result;
    };
    history.replaceState = function (...args) {
      const result = origReplaceState.apply(this, args);
      publishNavigation();
      return result;
    };

    // Covers browser back/forward too - those don't go through
    // pushState/replaceState at all, but DO fire the native popstate event.
    window.addEventListener('popstate', publishNavigation);
  }

  patchHistoryNavigation();
})();
