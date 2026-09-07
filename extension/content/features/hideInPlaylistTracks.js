// "Hide tracks already in a playlist" feature: minimizes any track row
// that's already in one of the user's own playlists, so the stream reads
// as genuinely new/unsorted content. Follows the same minimize/show
// pattern as hideOldTracks.js/hideLongTracks.js, but reads membership data
// crawled by content/features/playlistMembership.js - deliberately via
// window.SCSMPlaylistMembership.ensureCrawled() rather than requiring that
// feature's own "show playlist membership" (badge display) toggle to also
// be on, per #52's own resolved open question: the crawl is a shared,
// cheap/lazy resource, not something this filter should have to piggyback
// a DISPLAY setting to get.
(function () {
  'use strict';

  const REASON = 'in-playlist';
  let enabled = false;

  function labelFor(track, anchor) {
    const title = (track && track.title) || anchor.textContent.trim();
    return `${title} — hidden: already in a playlist`;
  }

  async function evaluate(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (!row) return;

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled || !track) return;

    const inAnyPlaylist = Array.isArray(track.playlists) && track.playlists.length > 0;
    if (inAnyPlaylist) {
      // See hideOldTracks.js's identical guard: a user who clicked "show"
      // to override this shouldn't have it immediately re-minimized by the
      // rescan that click itself triggers.
      if (window.SCSMRowState.isDismissed(row, REASON)) return;
      window.SCSMRowState.minimize(row, labelFor(track, anchor), { reason: REASON });
    } else if (window.SCSMRowState.isMinimized(row) && row.dataset.scsmMinimizeReason === REASON) {
      // The track was removed from every playlist since this row was last
      // evaluated (playlistMembership.js's live sync updated the cache and
      // triggered a rescan) - it no longer qualifies, put it back.
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
    document.querySelectorAll(`[data-scsm-dismissed-reason="${REASON}"]`).forEach((row) => window.SCSMRowState.clearDismissed(row));
  }

  async function applySetting(settings) {
    const shouldEnable = !!settings.hideTracksInPlaylist;
    if (shouldEnable === enabled) return;

    if (!shouldEnable) {
      enabled = false;
      restoreOwnRows();
      return;
    }

    enabled = true;
    // The crawl needs the real client_id/user id from mainWorldBridge.js
    // and is itself paginated/network-bound - don't rescan until it's
    // actually populated the cache, or every row would evaluate against
    // empty membership data and get missed on this first pass.
    await window.SCSMPlaylistMembership.ensureCrawled();
    if (enabled) window.SCSMDom.rescan();
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
