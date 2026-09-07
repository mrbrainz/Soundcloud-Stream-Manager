// Mocks everything SCSM's auth/API helper (see the "Auth/API helper
// module" board card, adapting references/soundcloud-repost-age.user.js
// and references/soundcloud-playlist-membership.user.js) reads from the
// live page: window.__sc_hydration, the oauth_token cookie, and the
// api-v2.soundcloud.com endpoints themselves. Load this BEFORE any real
// extension source file in a fixture page and none of that code needs to
// know it isn't running on soundcloud.com.
(function () {
  'use strict';

  const DATA = window.__SCSM_MOCK_DATA__;
  if (!DATA) {
    console.error('[SCSM mock] data.js must be loaded before sc-api-mock.js');
    return;
  }

  // ---- window.__sc_hydration (client_id / logged-in user id) ----
  window.__sc_hydration = DATA.hydration;

  // ---- oauth_token cookie ----
  // Real getOAuthToken() just regex-matches document.cookie, so setting a
  // same-named cookie on whatever origin the fixture is served from is
  // enough - no need to actually be on soundcloud.com.
  document.cookie = 'oauth_token=mock-oauth-token; path=/';

  function permalinkPath(url) {
    try {
      return new URL(url).pathname;
    } catch (e) {
      return url;
    }
  }

  function getRequestHeader(init, name) {
    if (!init || !init.headers) return null;
    const h = init.headers;
    if (typeof h.get === 'function') return h.get(name); // a real Headers instance
    const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? h[key] : null;
  }

  function jsonResponse(body, status = 200) {
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }

  // ---- fetch interception ----
  // Anything NOT aimed at api-v2.soundcloud.com falls through to the real
  // fetch (fixtures don't need that today, but this keeps the mock from
  // silently swallowing unrelated requests if a future feature adds one).
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;
    if (typeof url !== 'string' || !url.includes('api-v2.soundcloud.com')) {
      return realFetch(input, init);
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return jsonResponse({ error: 'bad mock url' }, 400);
    }

    // GET /resolve?url=<permalink>
    if (parsed.pathname === '/resolve') {
      const target = parsed.searchParams.get('url');
      const path = target ? permalinkPath(target) : null;
      const track = path && DATA.tracks[path];
      if (track) return jsonResponse(track);
      return jsonResponse({ error: 'mock: no fixture for ' + target }, 404);
    }

    // GET /tracks/{id}/download - live-verified (#38) this 401s on the
    // real API without a real OAuth Authorization header, plain client_id
    // is not enough. Enforced here too so a regression that drops the
    // header from the real fetch call (lib/api.js's getDownloadRedirectUrl)
    // fails this mock as well, not just live.
    const downloadMatch = parsed.pathname.match(/^\/tracks\/(\d+)\/download$/);
    if (downloadMatch) {
      const authHeader = getRequestHeader(init, 'Authorization');
      if (!authHeader) return jsonResponse({ error: 'mock: needs a real OAuth Authorization header' }, 401);
      const id = Number(downloadMatch[1]);
      const redirectUri = DATA.downloadRedirects && DATA.downloadRedirects[id];
      // #85 regression: simulates the live-observed case of SoundCloud's
      // API leaving a request permanently pending (no response at all,
      // ever) - never resolves on its own, only reacts to the caller's
      // AbortSignal, exactly like a real hung fetch() would.
      if (redirectUri === 'HANG_FOREVER') {
        return new Promise((resolve, reject) => {
          const signal = init && init.signal;
          if (!signal) return; // never settles
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      if (redirectUri) return jsonResponse({ redirectUri });
      return jsonResponse({ error: 'mock: no download redirect for track id ' + id }, 401);
    }

    // GET /tracks/{id}
    const trackIdMatch = parsed.pathname.match(/^\/tracks\/(\d+)$/);
    if (trackIdMatch) {
      const id = Number(trackIdMatch[1]);
      const track = Object.values(DATA.tracks).find((t) => t.id === id);
      if (track) return jsonResponse(track);
      return jsonResponse({ error: 'mock: no fixture for track id ' + id }, 404);
    }

    // GET /users/{id}/playlists?...&offset=N
    const playlistsMatch = parsed.pathname.match(/^\/users\/(\d+)\/playlists$/);
    if (playlistsMatch) {
      const offset = Number(parsed.searchParams.get('offset') || 0);
      // Single-page fixture dataset: anything past offset 0 is "end of list".
      return jsonResponse(offset === 0 ? DATA.playlistsPage : { collection: [] });
    }

    return jsonResponse({ error: 'mock: unhandled endpoint ' + url }, 404);
  };

  // ---- self-test, so a broken mock/fixture fails loudly on page load ----
  // instead of features silently getting no data.
  async function selfTest() {
    const results = [];
    for (const path of Object.keys(DATA.tracks)) {
      const res = await window.fetch(
        `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent('https://soundcloud.com' + path)}&client_id=x`
      );
      results.push([path, res.ok]);
    }
    const playlistsRes = await window.fetch('https://api-v2.soundcloud.com/users/999/playlists?client_id=x&limit=10&offset=0');
    results.push(['playlists page', playlistsRes.ok]);

    for (const idStr of Object.keys(DATA.downloadRedirects || {})) {
      // HANG_FOREVER (#85) never settles without an AbortSignal - it's
      // exercised directly by api-selfcheck.html's own regression test,
      // not this reachability self-test.
      if (DATA.downloadRedirects[idStr] === 'HANG_FOREVER') continue;
      const res = await window.fetch(`https://api-v2.soundcloud.com/tracks/${idStr}/download?client_id=x`, {
        headers: { Authorization: 'OAuth mock-oauth-token' },
      });
      results.push([`download redirect for ${idStr}`, res.ok]);
    }

    const failed = results.filter(([, ok]) => !ok);
    if (failed.length) {
      console.error('[SCSM mock] self-test FAILED for:', failed.map(([p]) => p));
    } else {
      console.log('[SCSM mock] self-test passed:', results.length, 'mock endpoints reachable');
    }
  }

  window.__scMockSelfTest = selfTest;
  selfTest();
})();
