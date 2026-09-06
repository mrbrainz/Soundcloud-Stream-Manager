// Auth helpers, ported from references/soundcloud-repost-age.user.js and
// references/soundcloud-playlist-membership.user.js, adjusted for a real
// difference between a Tampermonkey userscript (which runs unsandboxed,
// directly in the page, under "@grant none") and a Manifest V3 content
// script (which runs in an isolated JS world by default - same DOM as the
// page, but a SEPARATE `window` for JS-level globals). window.__sc_hydration
// is a plain JS global the page's own bundle sets, so it's invisible here;
// content/mainWorldBridge.js runs in the page's actual main world (see
// manifest.json's "world": "MAIN" entry), reads it there, and republishes
// client_id / the logged-in user's id onto a DOM attribute - the one thing
// both worlds actually share. That's what getClientId()/getMyUserId() read.
(function () {
  'use strict';

  function getClientId() {
    return document.documentElement.dataset.scsmClientId || null;
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getOAuthToken() {
    return getCookie('oauth_token');
  }

  function getMyUserId() {
    const id = document.documentElement.dataset.scsmUserId;
    return id ? Number(id) : null;
  }

  function authHeaders() {
    const token = getOAuthToken();
    return token ? { Authorization: 'OAuth ' + token } : {};
  }

  window.SCSMAuth = { getClientId, getOAuthToken, getMyUserId, authHeaders };
})();
