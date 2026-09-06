// Shared DOM-matching layer. Every feature (repost age, playlist
// membership, both hide-filters, search links, download button) needs to
// find tracks on the page and get told when new ones appear, across three
// different page shapes - this module is the one place that knows about
// those shapes, so no feature re-implements its own MutationObserver. See
// the "DOM-matching layer per page shape" board card and docs/context.md.
//
// Page shapes:
// - feed/library/search: rows of `a.soundTitle__title[href]` anchors.
// - the standalone `soundcloud.com/artist/track` page: SoundCloud renders
//   this inside a same-origin `webiIframe` with a plain `<h1>` and NO
//   `a.soundTitle__title` anchors at all - its own URL (with a leading
//   "/n" segment SoundCloud adds for this iframe route) IS the permalink.
// - assorted other same-origin iframes (ad frames, the sandboxed crossfade
//   player) that also load this content script but never contain a feed or
//   a track page - these are skipped entirely (see isRelevantFrame below).
//
// This module only finds/announces things; it decides nothing about what a
// feature should DO with a track (badge it, hide it, etc) - that stays in
// each feature's own card so this stays reusable infrastructure, not policy.
(function () {
  'use strict';

  const isTopFrame = window.top === window.self;
  // Matches references/soundcloud-playlist-membership.user.js's frame
  // filter: a standalone track/playlist permalink, with or without the
  // "/n" prefix SoundCloud's webiIframe route adds.
  const STANDALONE_PATH_RE = /^\/n?\/([^/]+)\/(sets\/)?([^/]+)\/?$/;

  function isRelevantFrame() {
    return isTopFrame || STANDALONE_PATH_RE.test(location.pathname);
  }

  function permalinkPathFromHref(href) {
    return window.SCSMApi.permalinkPath('https://soundcloud.com' + href);
  }

  // The standalone page's own path IS the permalink - strip the leading
  // "/n" the webiIframe route adds so it matches the plain path used
  // everywhere else (feed hrefs, the API's permalink_url, the mock data).
  function standalonePermalinkPath() {
    return location.pathname.replace(/^\/n(?=\/)/, '');
  }

  function findTrackAnchors(root) {
    if (!root) return [];
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (!root) return [];
    const results = [];
    if (root.matches && root.matches('a.soundTitle__title[href]')) results.push(root);
    if (root.querySelectorAll) {
      root.querySelectorAll('a.soundTitle__title[href]').forEach((el) => results.push(el));
    }
    return results;
  }

  // ---- shared scan/annotate loop ----
  // Callbacks receive the raw list of "dirty" nodes to look inside (not
  // pre-filtered to anchors) - anchor-based features call findTrackAnchors
  // on each; text-leaf-based features (e.g. repost age's "Reposted X ago"
  // matching) run their own selector against the same nodes. Either way,
  // there's exactly one MutationObserver and one debounce for the whole
  // page, not one per feature.
  const scanCallbacks = [];
  function onScan(callback) {
    scanCallbacks.push(callback);
  }

  function notify(dirtyNodes) {
    scanCallbacks.forEach((cb) => {
      try {
        cb(dirtyNodes);
      } catch (e) {
        console.error('[SCSM dom] onScan callback failed', e);
      }
    });
  }

  // Manual full rescan - e.g. a feature just got toggled on in the popup
  // and needs to process everything already on the page, not just future
  // mutations.
  function rescan() {
    notify([document.body]);
  }

  let debounceTimer = null;
  const dirty = new Set();
  function boot() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => dirty.add(node));
        } else if (m.type === 'characterData') {
          // SoundCloud re-renders relative-time text (e.g. the "X ago"
          // ticker) in place every so often - features watching for that
          // need the changed text node's own element re-checked, not just
          // newly-added subtrees.
          dirty.add(m.target);
        }
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const nodes = [...dirty];
        dirty.clear();
        notify(nodes);
      }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Deferred (not synchronous, and NOT a microtask): dom.js loads and
    // runs boot() before content.js and any feature files after it in the
    // manifest's script list have had a chance to call onScan(). A
    // microtask (Promise.resolve().then) is NOT enough here - browsers
    // flush the microtask queue after EACH classic <script> finishes
    // executing, not just once all of them have run, so a microtask-deferred
    // rescan() still fires before the next <script> tag (content.js) even
    // starts. setTimeout schedules a macrotask instead, which only runs
    // after the whole synchronous script chain (and this task) completes.
    setTimeout(rescan, 0);
  }

  if (isRelevantFrame()) {
    if (document.body) {
      boot();
    } else {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    }
  }

  window.SCSMDom = {
    isTopFrame,
    isRelevantFrame,
    permalinkPathFromHref,
    standalonePermalinkPath,
    findTrackAnchors,
    onScan,
    rescan,
  };
})();
