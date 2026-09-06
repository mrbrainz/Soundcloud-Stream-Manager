// "Show legacy download button" feature: adds a Download link to the
// shared icon row (lib/iconRow.js, same row searchLinks.js uses) for any
// track the API confirms is downloadable - matching v1's behavior of only
// showing the button when a check against the track's `downloadable` flag
// says yes, rather than showing it unconditionally. See board card #13
// and docs/context.md.
//
// OPEN QUESTION carried over from planning, not resolved by the mock
// harness (mocks always return whatever download_url the fixture data
// says): v1 built the download URL as `download_url?client_id=...` -
// needs live-verifying against real SoundCloud whether that still resolves
// under a plain client_id for a non-owned track, or whether it now
// requires the OAuth token too. If OAuth turns out to be required, a plain
// link click can't carry an Authorization header - the fetch-to-blob
// pattern (authenticated fetch, then a blob: URL) would be needed instead.
// Flag this for the cross-page manual verification pass (#15).
(function () {
  'use strict';

  const BTN_CLASS = 'scsm-download-button';
  let enabled = false;

  function renderButton(row, track) {
    if (!track || !track.downloadable || !track.downloadUrl) return;
    if (window.SCSMRowState.isMinimized(row)) return;

    const container = window.SCSMIconRow.getOrCreateIconRow(row);
    if (container.querySelector('.' + BTN_CLASS)) return; // idempotent

    const clientId = window.SCSMAuth.getClientId();
    if (!clientId) return;

    const link = document.createElement('a');
    link.className = BTN_CLASS;
    link.href = track.downloadUrl + '?client_id=' + encodeURIComponent(clientId);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Download';
    link.title = 'Download (legacy)';
    link.style.marginRight = '8px';
    link.style.fontSize = '11px';
    link.style.opacity = '0.7';
    link.addEventListener('click', (e) => e.stopPropagation());
    container.appendChild(link);
  }

  async function evaluate(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (!row || window.SCSMRowState.isMinimized(row)) return;
    if (window.SCSMIconRow.getOrCreateIconRow(row).querySelector('.' + BTN_CLASS)) return;

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled) return;
    renderButton(row, track); // no-ops on its own if the track isn't downloadable
  }

  function onDirty(dirtyNodes) {
    if (!enabled) return;
    dirtyNodes.forEach((node) => {
      window.SCSMDom.findTrackAnchors(node).forEach(evaluate);
    });
  }

  function removeAllButtons() {
    document.querySelectorAll('.' + BTN_CLASS).forEach((el) => el.remove());
  }

  function applySetting(settings) {
    const shouldEnable = !!settings.showDownloadButton;
    if (shouldEnable === enabled) return;
    enabled = shouldEnable;
    if (enabled) {
      window.SCSMDom.rescan();
    } else {
      removeAllButtons();
    }
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
