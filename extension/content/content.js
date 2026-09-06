// Content script entry point.
// Scaffolded here (empty implementation) so manifest.json has a stable file
// to load; per-feature logic lands in its own board card. Logs auth/API/DOM
// wiring for now so loading this file (in the real extension or a test
// fixture) proves lib/auth.js, lib/api.js, and lib/dom.js are reachable and
// returning real values.
console.log('[SCSM] content script loaded on', location.href);

if (window.SCSMDom.isRelevantFrame()) {
  console.log('[SCSM] client_id:', window.SCSMAuth.getClientId(), '| user id:', window.SCSMAuth.getMyUserId());

  window.SCSMSettings.get().then((settings) => console.log('[SCSM] settings loaded:', settings));
  window.SCSMSettings.onChange((settings) => console.log('[SCSM] settings changed:', settings));

  window.SCSMDom.onScan((dirtyNodes) => {
    const anchors = dirtyNodes.flatMap((node) => window.SCSMDom.findTrackAnchors(node));
    if (anchors.length) {
      console.log(
        '[SCSM] found track anchors:',
        anchors.map((a) => window.SCSMDom.permalinkPathFromHref(a.getAttribute('href')))
      );
    }
  });

  if (!document.querySelector('a.soundTitle__title[href]')) {
    console.log('[SCSM] standalone page permalink:', window.SCSMDom.standalonePermalinkPath());
  }
} else {
  console.log('[SCSM] not a relevant frame, skipping');
}
