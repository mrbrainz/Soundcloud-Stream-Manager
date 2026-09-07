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

  // Live-verified on /feed (#50): the right-hand column (streamSidebar's
  // "New tracks"/"Artists you should follow"/"Recently played" modules)
  // also contains `a.soundTitle__title` anchors, so every feature was
  // picking those up too. The main stream/search list shape differs
  // per page (`.stream__list`, `.searchList`, ...) and even shares a
  // `.lazyLoadingList__list` class with sidebar modules, so positively
  // matching "the real list" isn't reliable - excluding the sidebar's own
  // layout wrapper is. `.l-sidebar-right` consistently wraps the whole
  // right column across page shapes that have one; pages without a
  // sidebar (e.g. search) simply never match it.
  const SIDEBAR_SELECTOR = '.l-sidebar-right';

  function isInSidebar(el) {
    return !!(el.closest && el.closest(SIDEBAR_SELECTOR));
  }

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
    if (root.matches && root.matches('a.soundTitle__title[href]') && !isInSidebar(root)) results.push(root);
    if (root.querySelectorAll) {
      root.querySelectorAll('a.soundTitle__title[href]').forEach((el) => {
        if (!isInSidebar(el)) results.push(el);
      });
    }
    return results;
  }

  // The row-level container a track anchor sits in - what a feature
  // actually wants to badge/minimize/attach to, not the anchor itself.
  // Falls back to the anchor's parent (or the anchor itself) on a page
  // shape that doesn't use the feed/library/search <li> wrapper, so
  // callers never have to null-check this.
  function findRowForAnchor(anchor) {
    if (!anchor) return null;
    return anchor.closest('li.soundList__item') || anchor.parentElement || anchor;
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

  // ---- page-type classification (#65) ----
  // Lets the user scope which pages each feature is active on (a popup
  // setting - see lib/settings.js's enabledPageTypes). SoundCloud exposes
  // no explicit page-type marker, so this is a best-effort classification
  // of location.pathname, live-verified against real soundcloud.com
  // (2026-09-07): /feed (feed), /discover (discover), /<artist> (profile,
  // 1 segment), /<artist>/<track> (track, 2 segments), /<artist>/sets/<name>
  // (playlist, 3 segments). All confirmed rendering directly in the TOP
  // frame today, not inside a webiIframe - contradicts
  // standalonePermalinkPath()'s older assumption for the track/playlist
  // shape (see that function's own comment), which this doesn't touch;
  // that's a separate, pre-existing concern.
  //
  // RESERVED_ROOT_SEGMENTS rules out the other known top-level routes
  // (confirmed via the site's own nav) that would otherwise
  // false-positive as a 1- or 2-segment "profile"/"track" path - a
  // SoundCloud username can never collide with one of these, so this
  // isn't a precision/recall tradeoff, just a known-reserved-word list.
  const RESERVED_ROOT_SEGMENTS = new Set([
    'you',
    'artists',
    'upload',
    'notifications',
    'messages',
    'discover',
    'feed',
    'stream',
    'search',
    'tags',
    'charts',
    'settings',
    'jobs',
    'pro',
    'pages',
    'backstage',
    'creators',
  ]);

  function pageType() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/feed' || path === '/stream') return 'feed';
    if (path === '/discover') return 'discover';

    const playlistMatch = path.match(/^\/([^/]+)\/sets\/([^/]+)$/);
    if (playlistMatch && !RESERVED_ROOT_SEGMENTS.has(playlistMatch[1])) return 'playlist';

    const trackMatch = path.match(/^\/([^/]+)\/([^/]+)$/);
    if (trackMatch && !RESERVED_ROOT_SEGMENTS.has(trackMatch[1])) return 'track';

    const profileMatch = path.match(/^\/([^/]+)$/);
    if (profileMatch && !RESERVED_ROOT_SEGMENTS.has(profileMatch[1])) return 'profile';

    return null; // some other page shape (settings, notifications, etc.) - not one of the 5 scoped types
  }

  // Whether the CURRENT page's type is on the user's enabled list. An
  // unclassified page shape (pageType() returning null) or a missing/
  // malformed setting defaults to true - additive, not a breaking change:
  // a page shape this classifier doesn't recognize shouldn't silently
  // lose feature coverage it always had.
  function isPageTypeEnabled(settings) {
    const type = pageType();
    if (!type) return true;
    const enabled = settings && Array.isArray(settings.enabledPageTypes) ? settings.enabledPageTypes : null;
    if (!enabled) return true;
    return enabled.includes(type);
  }

  // ---- SPA navigation (#79, follow-up to #65) ----
  // SoundCloud navigates in-app (e.g. clicking your own avatar to your
  // profile) via history.pushState(), not a real page load - content
  // scripts only run once per real load, so nothing previously told any
  // feature its `enabled` flag (computed against pageType() above) had
  // gone stale for the new URL. content/mainWorldBridge.js patches
  // pushState/replaceState/popstate in the MAIN world (a page-API patch,
  // same rule as the playlist XHR patch there) and publishes a
  // 'scsm:navigation' CustomEvent on document - listened for here so
  // every feature can subscribe through ONE place instead of each
  // touching the DOM event directly.
  const pageChangeCallbacks = [];
  function onPageTypeChange(callback) {
    pageChangeCallbacks.push(callback);
  }

  if (isRelevantFrame()) {
    document.addEventListener('scsm:navigation', () => {
      pageChangeCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[SCSM dom] onPageTypeChange callback failed', e);
        }
      });
      // The whole page's content swaps out on an SPA navigation - a fresh
      // rescan picks it up immediately rather than waiting for individual
      // mutations to trickle through the debounce.
      rescan();
    });
  }

  window.SCSMDom = {
    isTopFrame,
    isRelevantFrame,
    permalinkPathFromHref,
    standalonePermalinkPath,
    findTrackAnchors,
    findRowForAnchor,
    isInSidebar,
    pageType,
    isPageTypeEnabled,
    onPageTypeChange,
    onScan,
    rescan,
  };
})();
