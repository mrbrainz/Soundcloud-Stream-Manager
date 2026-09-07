// "Hide tracks longer than X minutes" feature: minimizes any track row
// whose duration (from the shared lib/api.js metadata cache - the same
// cache hideOldTracks.js and repostAge.js read from, so having all three
// on doesn't triple the API calls for a track they all look at) exceeds
// the configured threshold. Mirrors hideOldTracks.js's structure exactly;
// see board card #11 and docs/context.md.
//
// A row matching more than one hide filter at once (e.g. also too old, or
// also already in a playlist) stays hidden until EVERY filter's reason has
// cleared - see lib/rowState.js's multi-reason tracking (#64).
(function () {
  'use strict';

  const REASON = 'long';
  let enabled = false;
  let thresholdMinutes = 25;

  function titleFor(track, anchor) {
    return (track && track.title) || anchor.textContent.trim();
  }

  // Just this filter's own reason phrase - lib/rowState.js combines it with
  // any other active filter's reason into one label. Recomputed (and the
  // visible label updated) any time evaluate() re-minimizes an
  // already-minimized row, so if the threshold changes later the displayed
  // reason stays current too.
  function reasonTextFor() {
    return `longer than ${thresholdMinutes} minute${thresholdMinutes === 1 ? '' : 's'}`;
  }

  async function evaluate(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (!row) return;

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled || !track || typeof track.duration !== 'number') return;

    const durationMinutes = track.duration / 60000;
    if (durationMinutes > thresholdMinutes) {
      // The user explicitly clicked "show" to override this - don't
      // immediately re-minimize it on the rescan that click itself
      // triggers (see the "hidden track's show link doesn't restore the
      // row" bug). Stays dismissed until the feature is toggled off/on.
      if (window.SCSMRowState.isDismissed(row, REASON)) return;
      window.SCSMRowState.minimize(row, titleFor(track, anchor), { reason: REASON, reasonText: reasonTextFor() });
    } else if (window.SCSMRowState.isMinimized(row)) {
      // The threshold was raised since this row was last evaluated and it
      // no longer qualifies - drop just this filter's reason. If another
      // filter's reason is still active, the row stays hidden under that one.
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
    const shouldEnable = !!settings.hideLongTracks && window.SCSMDom.isPageTypeEnabled(settings);
    const thresholdChanged = settings.hideLongTracksMinutes !== thresholdMinutes;
    thresholdMinutes = settings.hideLongTracksMinutes;

    if (!shouldEnable) {
      if (enabled) {
        enabled = false;
        restoreOwnRows();
      }
      return;
    }

    const justEnabled = !enabled;
    enabled = true;
    // A full rescan is needed both when freshly turned on (process
    // everything already on the page) and when only the threshold changed
    // while already on (previously-hidden rows may now be within range, or
    // vice versa) - findTrackAnchors still finds a minimized row's anchor
    // since minimizing hides it, not removes it.
    if (justEnabled || thresholdChanged) {
      window.SCSMDom.rescan();
    }
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
