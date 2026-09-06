// Popup entry point. Wires the toggles/threshold inputs in popup.html to
// lib/settings.js - see the "Popup UI shell" board card.
(function () {
  'use strict';

  const TOGGLE_IDS = [
    'showRepostAge',
    'showPlaylistMembership',
    'hideOldTracks',
    'hideLongTracks',
    'showSearchLinks',
    'showDownloadButton',
  ];
  // Which toggle each threshold input belongs to, so its enabled/disabled
  // state (and only that) tracks the toggle without needing its own entry
  // in TOGGLE_IDS.
  const THRESHOLD_IDS = {
    hideOldTracks: 'hideOldTracksDays',
    hideLongTracks: 'hideLongTracksMinutes',
  };

  function applyToForm(settings) {
    TOGGLE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.checked !== settings[id]) el.checked = settings[id];
    });
    Object.entries(THRESHOLD_IDS).forEach(([toggleId, thresholdId]) => {
      const thresholdEl = document.getElementById(thresholdId);
      if (!thresholdEl) return;
      // Don't clobber a value the user is actively typing into.
      if (document.activeElement !== thresholdEl) thresholdEl.value = settings[thresholdId];
      thresholdEl.disabled = !settings[toggleId];
    });
  }

  async function init() {
    const settings = await window.SCSMSettings.get();
    applyToForm(settings);

    TOGGLE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        window.SCSMSettings.set({ [id]: el.checked });
      });
    });

    Object.values(THRESHOLD_IDS).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const n = parseInt(el.value, 10);
        if (Number.isFinite(n) && n > 0) {
          window.SCSMSettings.set({ [id]: n });
        }
      });
    });

    // Live-apply both ways: reflect settings changed elsewhere (e.g. a
    // future "reset to defaults" affordance) back into this popup's form
    // too, not just write one-way.
    window.SCSMSettings.onChange(applyToForm);
  }

  init();
})();
