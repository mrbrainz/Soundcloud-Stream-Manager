// Content script entry point.
// Scaffolded here (empty implementation) so manifest.json has a stable file
// to load; the shared DOM-matching/annotate layer and per-feature logic
// land in their own board cards. Logs auth/API wiring for now so loading
// this file (in the real extension or a test fixture) proves lib/auth.js
// and lib/api.js are reachable and returning real values.
console.log('[SCSM] content script loaded on', location.href);
console.log('[SCSM] client_id:', window.SCSMAuth.getClientId(), '| user id:', window.SCSMAuth.getMyUserId());
