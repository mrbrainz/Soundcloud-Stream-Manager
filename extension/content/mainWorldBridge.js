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
})();
