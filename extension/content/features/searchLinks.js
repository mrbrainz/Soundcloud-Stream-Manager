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

  // iconUrl points at a real per-platform icon bundled under
  // extension/icons/services/ (#68) - declared web-accessible in
  // manifest.json so a content-script-injected <img> can load it via a
  // chrome-extension:// URL. badge/badgeColor are the #40 fallback (a
  // colored-initial stand-in, not a trademarked mark) for any platform
  // that ever loses its icon asset - lib/iconRow.js's createIconButton
  // uses one or the other, never both.
  const PLATFORMS = [
    { key: 'deezer', label: 'Deezer', badge: 'D', color: '#A855F7', icon: 'icon-deezer.png', urlFor: (q) => 'https://www.deezer.com/search/' + encodeURIComponent(q) },
    { key: 'appleMusic', label: 'Apple Music', badge: 'AM', color: '#FB4570', icon: 'icon-apple-music.png', urlFor: (q) => 'https://music.apple.com/search?term=' + encodeURIComponent(q) },
    { key: 'beatport', label: 'Beatport', badge: 'B', color: '#10B981', icon: 'icon-beatport.png', urlFor: (q) => 'https://www.beatport.com/search?q=' + encodeURIComponent(q) },
    { key: 'spotify', label: 'Spotify', badge: 'S', color: '#22C55E', icon: 'icon-spotify.png', urlFor: (q) => 'https://open.spotify.com/search/' + encodeURIComponent(q) },
  ];

  let enabled = false;

  // Matches v1's Deezer-tweak method (see README.md): strip everything but
  // alphanumerics/spaces, then collapse repeated whitespace.
  function buildQuery(track, anchor) {
    const title = (track && track.title) || anchor.textContent.trim();
    const artist = track && track.artist;
    // Uploaders who set a real artist name (see lib/api.js's
    // publisher_metadata.artist preference) very often ALSO bake it into
    // the title itself (confirmed live - #36/#37: "Neumonic - Massive"
    // with artist "Neumonic"), which would otherwise duplicate it in the
    // query ("Neumonic Neumonic Massive"). Skip prepending when the title
    // already contains the artist name anywhere, case-insensitively.
    const titleAlreadyHasArtist = artist && title.toLowerCase().includes(artist.toLowerCase());
    const raw = artist && !titleAlreadyHasArtist ? `${artist} ${title}` : title;
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

      const link = window.SCSMIconRow.createIconButton({
        extraClass: LINK_CLASS + ' ' + cls,
        href: platform.urlFor(query),
        title: 'Search "' + query + '" on ' + platform.label,
        badgeText: platform.badge,
        badgeColor: platform.color,
        iconUrl: chrome.runtime.getURL('icons/services/' + platform.icon),
      });
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
    const shouldEnable = !!settings.showSearchLinks && window.SCSMDom.isPageTypeEnabled(settings);
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
    window.SCSMDom.onPageTypeChange(() => window.SCSMSettings.get().then(applySetting));
  }
})();
