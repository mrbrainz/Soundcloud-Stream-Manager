// Shared settings schema + live-apply storage. One chrome.storage.local
// object holds every feature's on/off state and threshold, defaulting to
// everything off (30 days / 25 minutes thresholds) until the user opts in
// via the popup. See the "Settings schema + live-apply storage" board card
// and docs/context.md.
//
// "Live-apply" means: the popup calls set(), which writes to
// chrome.storage.local; every open SoundCloud tab's content script is
// already subscribed via chrome.storage.onChanged (wired up below) and
// gets the new merged settings object immediately, no page refresh needed.
(function () {
  'use strict';

  const STORAGE_KEY = 'scsm_settings_v1';

  const DEFAULTS = Object.freeze({
    showRepostAge: false,
    showPlaylistMembership: false,
    hideOldTracks: false,
    hideOldTracksDays: 30,
    hideLongTracks: false,
    hideLongTracksMinutes: 25,
    hideTracksInPlaylist: false,
    hideGenres: false,
    hiddenGenres: Object.freeze([]),
    showSearchLinks: false,
    showDownloadButton: false,
    // Which page types every feature is allowed to run on (#65) - see
    // lib/dom.js's pageType()/isPageTypeEnabled(). Defaults to all of
    // them so this is additive: an existing install picks up the new
    // setting with today's behavior unchanged until the user actually
    // narrows it down in the popup.
    enabledPageTypes: Object.freeze(['feed', 'discover', 'track', 'profile', 'playlist']),
  });

  function get() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = (result && result[STORAGE_KEY]) || {};
        resolve(Object.assign({}, DEFAULTS, stored));
      });
    });
  }

  // Merges `partial` into whatever's currently stored (not a full
  // replace) - callers (the popup's toggles/inputs) only ever change one
  // setting at a time and shouldn't need to know the rest of the shape.
  async function set(partial) {
    const current = await get();
    const next = Object.assign({}, current, partial);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: next }, () => resolve(next));
    });
  }

  const listeners = [];
  // callback(nextSettings) - fired whenever ANY tab/popup changes settings,
  // including the tab/context that made the change itself (that's how
  // chrome.storage.onChanged works, and it's what makes a single onChange
  // subscription enough for a feature to both apply its initial state and
  // react to later toggles).
  function onChange(callback) {
    listeners.push(callback);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
    const next = Object.assign({}, DEFAULTS, changes[STORAGE_KEY].newValue || {});
    listeners.forEach((cb) => {
      try {
        cb(next);
      } catch (e) {
        console.error('[SCSM settings] onChange callback failed', e);
      }
    });
  });

  window.SCSMSettings = { DEFAULTS, get, set, onChange };
})();
