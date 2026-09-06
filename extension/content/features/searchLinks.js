// "Show search links" feature: adds an inline icon row per track linking
// to a search for that track on Deezer, Apple Music, Beatport, and
// Spotify. Query is title + artist with punctuation stripped, used
// identically across all four platforms for now - per the SCSM 2.0
// planning decision, v1 only did this for Deezer with title alone; we're
// trying title+artist everywhere and may need to tune per-platform later
// if match rate suffers. See board card #12 and docs/context.md.
(function () {
  'use strict';

  const LINK_CLASS = 'scsm-search-link';

  const PLATFORMS = [
    { key: 'deezer', label: 'Deezer', urlFor: (q) => 'https://www.deezer.com/search/' + encodeURIComponent(q) },
    { key: 'appleMusic', label: 'Apple Music', urlFor: (q) => 'https://music.apple.com/search?term=' + encodeURIComponent(q) },
    { key: 'beatport', label: 'Beatport', urlFor: (q) => 'https://www.beatport.com/search?q=' + encodeURIComponent(q) },
    { key: 'spotify', label: 'Spotify', urlFor: (q) => 'https://open.spotify.com/search/' + encodeURIComponent(q) },
  ];

  let enabled = false;

  // Matches v1's Deezer-tweak method (see README.md): strip everything but
  // alphanumerics/spaces, then collapse repeated whitespace.
  function buildQuery(track, anchor) {
    const title = (track && track.title) || anchor.textContent.trim();
    const raw = track && track.artist ? `${track.artist} ${title}` : title;
    return raw.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().replace(/\s{2,}/g, ' ');
  }

  function renderLinks(row, track, anchor) {
    // A minimized row only shows its collapsed summary - don't inject
    // icons a user can't see; rowState.restore() triggers a rescan when
    // the row becomes visible again, which re-runs this.
    if (window.SCSMRowState.isMinimized(row)) return;

    const container = window.SCSMIconRow.getOrCreateIconRow(row);
    const query = buildQuery(track, anchor);

    PLATFORMS.forEach((platform) => {
      const cls = LINK_CLASS + '-' + platform.key;
      if (container.querySelector('.' + cls)) return; // idempotent

      const link = document.createElement('a');
      link.className = LINK_CLASS + ' ' + cls;
      link.href = platform.urlFor(query);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = platform.label;
      link.style.marginRight = '8px';
      link.style.fontSize = '11px';
      link.style.opacity = '0.7';
      // Don't let the click bubble into the row's own click-to-play handler.
      link.addEventListener('click', (e) => e.stopPropagation());
      container.appendChild(link);
    });
  }

  async function evaluate(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (!row || window.SCSMRowState.isMinimized(row)) return;
    if (window.SCSMIconRow.getOrCreateIconRow(row).querySelector('.' + LINK_CLASS)) return; // already rendered

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled) return;
    // Best-effort: even if the resolve failed, still let the user search by
    // whatever title text is visible rather than rendering nothing.
    renderLinks(row, track, anchor);
  }

  function onDirty(dirtyNodes) {
    if (!enabled) return;
    dirtyNodes.forEach((node) => {
      window.SCSMDom.findTrackAnchors(node).forEach(evaluate);
    });
  }

  function removeAllLinks() {
    document.querySelectorAll('.' + LINK_CLASS).forEach((el) => el.remove());
  }

  function applySetting(settings) {
    const shouldEnable = !!settings.showSearchLinks;
    if (shouldEnable === enabled) return;
    enabled = shouldEnable;
    if (enabled) {
      window.SCSMDom.rescan();
    } else {
      removeAllLinks();
    }
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
