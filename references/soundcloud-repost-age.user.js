// ==UserScript==
// @name         SoundCloud Repost Age
// @namespace    https://mrbrainz.example/soundcloud-repost-age
// @version      1.3.0
// @description  Shows how old a reposted track/playlist actually is, next to "Reposted X ago" in your SoundCloud feed.
// @author       DJ BrainZ
// @match        https://soundcloud.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // SoundCloud loads a handful of sandboxed same-origin iframes (crossfade
  // player, ad standby pages, etc) that also match @match but never contain
  // a feed - skip those entirely instead of spamming their console.
  if (window.top !== window.self) return;

  console.log('[SC Repost Age] v1.3.0 loaded on', location.href);

  // Self-heal from an older/duplicate copy of this script (or a leftover
  // install) that appended its label inside SoundCloud's visually-hidden a11y
  // span instead of the visible <time> element - that stale, invisible span
  // satisfies "already annotated" checks and permanently blocks a fresh,
  // visible one from ever being added. Strip anything found there on load.
  document.querySelectorAll('.sc-repost-age').forEach((span) => {
    const parent = span.parentElement;
    if (parent && /visuallyhidden|visually-hidden|sr-only|screen-reader/i.test(parent.className || '')) {
      span.remove();
    }
  });

  const CACHE_KEY = 'sc_repost_age_cache_v1';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days - post dates don't change, this just bounds cache growth
  const MAX_CONCURRENT = 3;
  const RESOLVE_ENDPOINT = 'https://api-v2.soundcloud.com/resolve';

  // In-flight resolves, keyed by permalink, so a burst of re-renders for the
  // same track (see the MutationObserver note below) doesn't fire duplicate
  // network requests while the first one is still pending.
  const inflight = new Map();
  let pending = 0;
  const queue = [];

  // ---------- persistent cache (permalink -> original post date) ----------
  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // storage full/blocked - fine, in-memory cache still works for this session
    }
  }
  const cache = loadCache();

  // ---------- client_id, read straight from SoundCloud's own page state ----------
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

  // ---------- relative age formatting ----------
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
      if (diffSec >= secs) return `${Math.floor(diffSec / secs)}${label}`;
    }
    return '<1m';
  }

  // ---------- resolve a track/playlist permalink to its original post date ----------
  function resolvePermalink(url) {
    const cached = cache[url];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return Promise.resolve(cached.date);
    }
    if (inflight.has(url)) return inflight.get(url);

    const promise = new Promise((resolve) => {
      queue.push(async () => {
        const clientId = getClientId();
        if (!clientId) {
          resolve(null);
          return;
        }
        try {
          const res = await fetch(
            `${RESOLVE_ENDPOINT}?url=${encodeURIComponent(url)}&client_id=${clientId}`,
            { credentials: 'omit' }
          );
          if (!res.ok) {
            resolve(null);
            return;
          }
          const data = await res.json();
          const date = data.display_date || data.created_at || null;
          if (date) {
            cache[url] = { date, fetchedAt: Date.now() };
            saveCache(cache);
          }
          resolve(date);
        } catch (e) {
          resolve(null);
        }
      });
      drainQueue();
    }).finally(() => inflight.delete(url));

    inflight.set(url, promise);
    return promise;
  }

  function drainQueue() {
    while (pending < MAX_CONCURRENT && queue.length) {
      const job = queue.shift();
      pending++;
      job().finally(() => {
        pending--;
        drainQueue();
      });
    }
  }

  // ---------- DOM matching ----------
  // Track permalinks are /artist/track (2 segments); playlists are /artist/sets/name.
  const TRACK_HREF_RE = /^\/([^/]+)\/([^/]+)$/;
  const PLAYLIST_HREF_RE = /^\/([^/]+)\/sets\/([^/]+)$/;

  function findPermalinkIn(container) {
    const links = container.querySelectorAll('a[href^="/"]');
    for (const a of links) {
      const href = a.getAttribute('href');
      if (!href) continue;
      if (TRACK_HREF_RE.test(href) || PLAYLIST_HREF_RE.test(href)) {
        return 'https://soundcloud.com' + href;
      }
    }
    return null;
  }

  function findPermalinkNear(leaf) {
    // Walk up from the "Reposted ... ago" text until an ancestor's links
    // include an actual track/playlist permalink (not just the reposting
    // user's own 1-segment profile link, which sits closest to the text).
    let el = leaf;
    for (let i = 0; i < 14 && el; i++) {
      const permalink = findPermalinkIn(el);
      if (permalink) return permalink;
      el = el.parentElement;
    }
    return null;
  }

  function isRepostLeaf(el) {
    // Note: deliberately NOT gated on el.children.length === 0. SoundCloud
    // re-renders this text periodically as the "X minutes ago" counter
    // ticks up, which can wipe out a previously-appended span - so a leaf
    // that already has our span (1 child) must still be recognized as the
    // same repost line, otherwise a re-render silently drops the label for
    // good. annotate() below is what actually guards against double-adding.
    if (!el || el.tagName === 'A') return false;
    const text = (el.textContent || '').trim();
    if (!/reposted/i.test(text) || !/ago$/i.test(text)) return false;
    // Only treat this as the *specific* text-bearing element, not every
    // ancestor whose combined textContent happens to also match - require
    // it to have no element children other than our own injected span.
    const otherChildren = [...el.children].filter((c) => !c.classList.contains('sc-repost-age'));
    return otherChildren.length === 0;
  }

  // The element whose text actually matches "Reposted ... ago" is SoundCloud's
  // visually-hidden a11y label (class sc-visuallyhidden, 1px wide, overflow
  // hidden) that sits inside the visible <time> element alongside the short
  // "X ago" text people actually see. Appending our span there is invisible.
  // Walk up to the nearest ancestor that isn't itself hidden and use that as
  // the actual attachment point.
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

  async function annotate(leaf) {
    const target = findAttachTarget(leaf);

    // Source of truth for "already done" is the DOM itself, not an
    // identity-keyed set - that way a re-render that strips our span (see
    // isRepostLeaf above) gets picked back up instead of being skipped.
    if (target.querySelector('.sc-repost-age')) return;

    const permalink = findPermalinkNear(leaf);
    if (!permalink) return;

    const date = await resolvePermalink(permalink);
    if (!date) return;

    const age = formatAge(date);
    if (!age || target.querySelector('.sc-repost-age')) return; // re-check post-await

    const span = document.createElement('span');
    span.className = 'sc-repost-age';
    span.textContent = ` · track is ${age} old`;
    span.style.opacity = '0.6';
    span.title = new Date(date).toLocaleString();
    target.appendChild(span);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (!root) return;
    if (isRepostLeaf(root)) annotate(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll('*').forEach((el) => {
      if (isRepostLeaf(el)) annotate(el);
    });
  }

  // ---------- watch the feed for new items AND for the "X ago" text ticking ----------
  // childList catches new feed items (infinite scroll, SPA nav). characterData
  // catches SoundCloud updating the relative-time text of an *existing* line in
  // place, which is what actually happens every minute or so on this page and
  // is what silently strips a previously-added span if we don't re-scan it.
  let debounceTimer = null;
  const dirty = new Set();
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => dirty.add(node));
      } else if (m.type === 'characterData') {
        dirty.add(m.target);
      }
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const nodes = [...dirty];
      dirty.clear();
      nodes.forEach((node) => scan(node));
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // initial pass for whatever is already on the page
  scan(document.body);
  console.log('[SC Repost Age] initial scan done, client_id =', getClientId());
})();