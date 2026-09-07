// "Show repost age" feature: annotates "Reposted X ago" text with how old
// the track's ORIGINAL upload actually is (e.g. "· track is 2y old"),
// adapted from references/soundcloud-repost-age.user.js but reading
// through the shared lib/api.js metadata cache instead of its own
// resolve/cache logic, and gated on the showRepostAge popup setting
// instead of always running. See board card #8 and docs/context.md.
(function () {
  'use strict';

  const BADGE_CLASS = 'scsm-repost-age';
  let enabled = false;

  function formatAge(dateStr) {
    const then = new Date(dateStr).getTime();
    if (Number.isNaN(then)) return null;
    const diffSec = Math.max(0, (Date.now() - then) / 1000);
    const units = [
      ['y', 31536000],
      ['mo', 2592000],
      ['w', 604800],
      ['d', 86400],
      ['h', 3600],
      ['m', 60],
    ];
    for (const [label, secs] of units) {
      if (diffSec >= secs) return Math.floor(diffSec / secs) + label;
    }
    return '<1m';
  }

  // A "Reposted ... ago" leaf: SoundCloud re-renders this text periodically
  // as the ticker advances, which can wipe out a previously-appended badge
  // - so a leaf that already has our badge (1 child) must still count as a
  // match, otherwise a re-render silently drops the badge for good.
  // annotate()'s own "already has a badge" check is what guards against
  // double-adding, not this filter.
  function isRepostLeaf(el) {
    if (!el || el.tagName === 'A') return false;
    const text = (el.textContent || '').trim();
    if (!/reposted/i.test(text) || !/ago$/i.test(text)) return false;
    const otherChildren = [...el.children].filter((c) => !c.classList.contains(BADGE_CLASS));
    return otherChildren.length === 0;
  }

  // The element whose text actually matches is often SoundCloud's
  // visually-hidden a11y label sitting inside the visible <time> element -
  // appending our badge there would be invisible. Walk up to the nearest
  // ancestor that isn't itself hidden.
  function isVisuallyHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    if (/visuallyhidden|visually-hidden|sr-only|screen-reader/i.test(el.className || '')) return true;
    const cs = getComputedStyle(el);
    if (cs.overflow === 'hidden' && parseFloat(cs.width) <= 2) return true;
    return false;
  }

  function findAttachTarget(leaf) {
    let el = leaf;
    for (let i = 0; i < 6 && el; i++) {
      if (!isVisuallyHidden(el)) return el;
      el = el.parentElement;
    }
    return leaf.parentElement || leaf;
  }

  // Track permalinks are /artist/track (2 segments); playlists are
  // /artist/sets/name. Deliberately NOT scoped to the shared DOM layer's
  // a.soundTitle__title selector (see findTrackAnchors in lib/dom.js) -
  // live-verification against real soundcloud.com (see #15) found the
  // anchor nearest a repost's "Reposted X ago" text isn't reliably that
  // specific class (e.g. it may be the cover-art link instead), so this
  // matches by href SHAPE on any anchor, exactly like the proven-working
  // references/soundcloud-repost-age.user.js did.
  const TRACK_HREF_RE = /^\/([^/]+)\/([^/]+)$/;
  const PLAYLIST_HREF_RE = /^\/([^/]+)\/sets\/([^/]+)$/;

  function findPermalinkIn(container) {
    if (!container.querySelectorAll) return null;
    const links = container.querySelectorAll('a[href^="/"]');
    for (const a of links) {
      const href = a.getAttribute('href');
      if (!href) continue;
      if (TRACK_HREF_RE.test(href) || PLAYLIST_HREF_RE.test(href)) return href;
    }
    return null;
  }

  // Walk up from the "Reposted ... ago" leaf until an ancestor contains an
  // anchor whose href matches a track/playlist permalink shape - not just
  // the reposting user's own 1-segment profile link, which sits closest to
  // the text but never matches either regex above.
  function findPermalinkNear(leaf) {
    let el = leaf;
    for (let i = 0; i < 14 && el; i++) {
      const href = findPermalinkIn(el);
      if (href) return href;
      el = el.parentElement;
    }
    return null;
  }

  async function annotate(leaf) {
    if (!enabled) return;
    const target = findAttachTarget(leaf);
    if (target.querySelector('.' + BADGE_CLASS)) return;

    const href = findPermalinkNear(leaf);
    if (!href) return;
    const path = window.SCSMDom.permalinkPathFromHref(href);

    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    // Re-check both conditions post-await: the setting may have been
    // toggled off, or another scan may have already annotated this leaf,
    // while the request was in flight.
    if (!enabled || !track || !track.createdAt || target.querySelector('.' + BADGE_CLASS)) return;

    const age = formatAge(track.createdAt);
    if (!age) return;

    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    span.textContent = ' · track is ' + age + ' old';
    span.style.opacity = '0.6';
    span.title = new Date(track.createdAt).toLocaleString();
    target.appendChild(span);
  }

  function scanForRepostLeaves(root) {
    if (!root) return [];
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (!root) return [];
    const leaves = [];
    if (isRepostLeaf(root) && !window.SCSMDom.isInSidebar(root)) leaves.push(root);
    if (root.querySelectorAll) {
      root.querySelectorAll('*').forEach((el) => {
        if (isRepostLeaf(el) && !window.SCSMDom.isInSidebar(el)) leaves.push(el);
      });
    }
    return leaves;
  }

  function removeAllBadges() {
    document.querySelectorAll('.' + BADGE_CLASS).forEach((el) => el.remove());
  }

  function onDirty(dirtyNodes) {
    if (!enabled) return;
    dirtyNodes.forEach((node) => {
      scanForRepostLeaves(node).forEach(annotate);
    });
  }

  function applySetting(settings) {
    const shouldEnable = !!settings.showRepostAge;
    if (shouldEnable === enabled) return;
    enabled = shouldEnable;
    if (enabled) {
      window.SCSMDom.rescan(); // process everything already on the page, not just future mutations
    } else {
      removeAllBadges();
    }
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
