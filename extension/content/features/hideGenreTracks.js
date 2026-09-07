// "Hide tracks by genre" feature: minimizes any track row whose `genre`
// field (present on the /resolve and /tracks/{id} API payload - confirmed
// live during #38's investigation) case-insensitively matches an entry in
// the user's configured hidden-genre list. Follows the same minimize/show
// pattern as hideOldTracks.js/hideLongTracks.js/hideInPlaylistTracks.js,
// and shares lib/rowState.js's multi-reason tracking (#64) so a row that
// also matches another filter stays correctly hidden/shown alongside it.
// See board card #53. The 1-click "add to hidden genres" affordance from
// the feed is tracked separately (#54) - this card is just the filter +
// the popup's free-text list management.
(function () {
  'use strict';

  const REASON = 'genre';
  let enabled = false;
  let hiddenGenresLower = [];

  function titleFor(track, anchor) {
    return (track && track.title) || anchor.textContent.trim();
  }

  // Returns the track's ORIGINAL-cased genre string if it matches the
  // hidden list (case-insensitively), so the reason text can show the
  // genre the way SoundCloud itself displays it, not the lowercased
  // comparison form.
  function matchedGenre(track) {
    if (!track || !track.genre) return null;
    return hiddenGenresLower.includes(track.genre.toLowerCase()) ? track.genre : null;
  }

  async function evaluate(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (!row) return;

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled || !track) return;

    const genre = matchedGenre(track);
    if (genre) {
      // See hideOldTracks.js's identical guard: a user who clicked "show"
      // to override this shouldn't have it immediately re-minimized by the
      // rescan that click itself triggers.
      if (window.SCSMRowState.isDismissed(row, REASON)) return;
      window.SCSMRowState.minimize(row, titleFor(track, anchor), { reason: REASON, reasonText: `tagged "${genre}"` });
    } else if (window.SCSMRowState.isMinimized(row)) {
      // The genre list changed (or the track's genre isn't on it) since
      // this row was last evaluated - drop just this filter's reason. If
      // another filter's reason is still active, the row stays hidden
      // under that one.
      window.SCSMRowState.unapplyReason(row, REASON);
    }
  }

  function onDirty(dirtyNodes) {
    if (!enabled) return;
    dirtyNodes.forEach((node) => {
      window.SCSMDom.findTrackAnchors(node).forEach(evaluate);
    });
  }

  function restoreOwnRows() {
    // ~= matches one whitespace-separated token in the attribute - a row
    // can carry more than one filter's reason key at once (#64).
    document.querySelectorAll(`[data-scsm-reason-keys~="${REASON}"]`).forEach((row) => window.SCSMRowState.unapplyReason(row, REASON));
    // A full off/on cycle is a clean slate - a row the user dismissed
    // under the old session shouldn't stay permanently immune.
    document.querySelectorAll(`[data-scsm-dismissed-reasons~="${REASON}"]`).forEach((row) => window.SCSMRowState.clearDismissed(row, REASON));
  }

  function applySetting(settings) {
    const shouldEnable = !!settings.hideGenres && window.SCSMDom.isPageTypeEnabled(settings);
    const nextGenresLower = (Array.isArray(settings.hiddenGenres) ? settings.hiddenGenres : []).map((g) => String(g).toLowerCase());
    const genresChanged = JSON.stringify(nextGenresLower) !== JSON.stringify(hiddenGenresLower);
    hiddenGenresLower = nextGenresLower;

    if (!shouldEnable) {
      if (enabled) {
        enabled = false;
        restoreOwnRows();
      }
      return;
    }

    const justEnabled = !enabled;
    enabled = true;

    // The hidden-genre LIST changing (as opposed to a numeric threshold
    // nudging up or down) is a much more deliberate "start over" action -
    // most visibly via #54's hover button, which lets a genre be removed
    // and re-added within seconds. Without this, re-adding a genre a row
    // was PREVIOUSLY dismissed under (via that row's own "show" link,
    // while the genre was still on the list at the time) would silently
    // stay immune, since dismissal otherwise only clears on a full
    // enable/disable cycle - clearing it here instead means toggling a
    // genre off and back on always re-hides matching rows right away, no
    // stale per-row exception surviving the round trip.
    if (genresChanged) {
      document.querySelectorAll(`[data-scsm-dismissed-reasons~="${REASON}"]`).forEach((row) => window.SCSMRowState.clearDismissed(row, REASON));
    }

    // A full rescan is needed both when freshly turned on (process
    // everything already on the page) and when only the genre list changed
    // while already on (previously-hidden rows may no longer match, or a
    // newly-added genre may now match rows that were left alone before) -
    // findTrackAnchors still finds a minimized row's anchor since
    // minimizing hides it, not removes it.
    if (justEnabled || genresChanged) {
      window.SCSMDom.rescan();
    }
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
    window.SCSMDom.onPageTypeChange(() => window.SCSMSettings.get().then(applySetting));
  }
})();
