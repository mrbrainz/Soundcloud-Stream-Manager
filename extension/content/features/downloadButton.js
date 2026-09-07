// "Show legacy download button" feature: adds a Download link to the
// shared icon row (lib/iconRow.js, same row searchLinks.js uses) for any
// track the API confirms is downloadable - matching v1's behavior of only
// showing the button when a check against the track's `downloadable` flag
// says yes, rather than showing it unconditionally. See board card #13/#38
// and docs/context.md.
//
// Resolves the open question carried over from planning: live-verified
// (#38) that SoundCloud no longer returns a `download_url` field from
// /resolve or /tracks/{id} at all, even for a genuinely downloadable
// track. The real link now comes from a separate call,
// GET /tracks/{id}/download, which 401s under a plain client_id - it
// needs the real OAuth Authorization header (lib/api.js's
// getDownloadRedirectUrl() sends it via SCSMAuth.authHeaders()).
(function () {
  'use strict';

  const BTN_CLASS = 'scsm-download-button';
  let enabled = false;

  function renderButton(row, redirectUrl) {
    if (window.SCSMRowState.isMinimized(row)) return;

    const container = window.SCSMIconRow.getOrCreateIconRow(row);
    if (container.querySelector('.' + BTN_CLASS)) return; // idempotent

    const link = window.SCSMIconRow.createIconButton({
      extraClass: BTN_CLASS,
      href: redirectUrl,
      title: 'Download (legacy)',
      badgeText: '↓', // fallback if the icon asset is ever missing
      badgeColor: '#64748B',
      iconUrl: chrome.runtime.getURL('icons/services/icon-download.png'),
    });
    container.appendChild(link);
  }

  async function evaluate(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (!row || window.SCSMRowState.isMinimized(row)) return;
    if (window.SCSMIconRow.getOrCreateIconRow(row).querySelector('.' + BTN_CLASS)) return;

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled || !track || !track.downloadable) return;

    const redirectUrl = await window.SCSMApi.getDownloadRedirectUrl(track.id);
    if (!enabled || !redirectUrl) return;
    renderButton(row, redirectUrl);
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
    const shouldEnable = !!settings.showDownloadButton && window.SCSMDom.isPageTypeEnabled(settings);
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
    window.SCSMDom.onPageTypeChange(() => window.SCSMSettings.get().then(applySetting));
  }
})();
