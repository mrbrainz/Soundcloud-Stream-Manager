// Auth helpers, ported from references/soundcloud-repost-age.user.js and
// references/soundcloud-playlist-membership.user.js: read client_id and the
// logged-in user's id straight from SoundCloud's own page hydration state
// instead of hardcoding either (the SCSM v1 approach that rotted when
// SoundCloud tightened API access - see docs/context.md), and read the
// OAuth token from the same non-httpOnly cookie the page itself uses.
(function () {
  'use strict';

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

  window.SCSMAuth = { getClientId, getOAuthToken, getMyUserId, authHeaders };
})();
