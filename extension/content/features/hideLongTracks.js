// "Hide tracks longer than X minutes" feature: minimizes any track row
// whose duration (from the shared lib/api.js metadata cache - the same
// cache hideOldTracks.js and repostAge.js read from, so having all three
// on doesn't triple the API calls for a track they all look at) exceeds
// the configured threshold. Mirrors hideOldTracks.js's structure exactly;
// see board card #11 and docs/context.md.
//
// Same known limitation as hideOldTracks.js: a row matching both hide
// filters gets whichever "reason" tag was written last - see that file's
// comment for detail. Acceptable for the MVP.
(function () {
  'use strict';

  const REASON = 'long';
  let enabled = false;
  let thresholdMinutes = 25;

  function labelFor(track, anchor) {
    return (track && track.title) || anchor.textContent.trim();
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
      window.SCSMRowState.minimize(row, labelFor(track, anchor), { reason: REASON });
    } else if (window.SCSMRowState.isMinimized(row) && row.dataset.scsmMinimizeReason === REASON) {
      // The threshold was raised since this row was last evaluated and it
      // no longer qualifies - put it back.
      window.SCSMRowState.restore(row);
    }
  }

  function onDirty(dirtyNodes) {
    if (!enabled) return;
    dirtyNodes.forEach((node) => {
      window.SCSMDom.findTrackAnchors(node).forEach(evaluate);
    });
  }

  function restoreOwnRows() {
    document.querySelectorAll(`[data-scsm-minimize-reason="${REASON}"]`).forEach((row) => window.SCSMRowState.restore(row));
  }

  function applySetting(settings) {
    const shouldEnable = !!settings.hideLongTracks;
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
