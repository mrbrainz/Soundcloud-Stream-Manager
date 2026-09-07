// Popup entry point. Wires the toggles/threshold inputs in popup.html to
// lib/settings.js - see the "Popup UI shell" board card.
(function () {
  'use strict';

  const TOGGLE_IDS = [
    'showRepostAge',
    'showPlaylistMembership',
    'hideOldTracks',
    'hideLongTracks',
    'hideTracksInPlaylist',
    'hideGenres',
    'showSearchLinks',
    'showDownloadButton',
  ];
  // Which toggle each threshold input belongs to, so its "not active yet"
  // styling (and only that) tracks the toggle without needing its own
  // entry in TOGGLE_IDS.
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
      // Deliberately NOT `.disabled` - a user should be able to set their
      // preferred threshold before turning the feature on, not be forced
      // to enable it first just to type a number. The dimmed style is a
      // "doesn't apply yet" hint only, not a block on editing.
      thresholdEl.classList.toggle('threshold--inactive', !settings[toggleId]);
    });
    renderGenreChips(settings.hiddenGenres);
  }

  // The hidden-genres chip list is fully derived from settings - re-render
  // wholesale on every apply rather than diffing, same as everything else
  // in this popup. Each chip's own "×" reads the CURRENT settings at click
  // time (not a value captured at render time) so a rapid-fire series of
  // removals still targets the right list.
  function renderGenreChips(genres) {
    const container = document.getElementById('hiddenGenreChips');
    if (!container) return;
    container.innerHTML = '';
    (genres || []).forEach((genre) => {
      const chip = document.createElement('span');
      chip.className = 'genre-chip';

      const label = document.createElement('span');
      label.textContent = genre;
      chip.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `Remove ${genre} from hidden genres`);
      removeBtn.addEventListener('click', async () => {
        const settings = await window.SCSMSettings.get();
        const next = (settings.hiddenGenres || []).filter((g) => g !== genre);
        window.SCSMSettings.set({ hiddenGenres: next });
      });
      chip.appendChild(removeBtn);

      container.appendChild(chip);
    });
  }

  function initGenreInput() {
    const input = document.getElementById('hiddenGenreInput');
    const addBtn = document.getElementById('hiddenGenreAdd');
    if (!input || !addBtn) return;

    async function addGenre() {
      const value = input.value.trim();
      if (!value) return;
      const settings = await window.SCSMSettings.get();
      const existing = settings.hiddenGenres || [];
      // Case-insensitive de-dupe - "Techno" and "techno" shouldn't both
      // end up in the list as separate entries.
      const alreadyThere = existing.some((g) => g.toLowerCase() === value.toLowerCase());
      if (!alreadyThere) {
        await window.SCSMSettings.set({ hiddenGenres: [...existing, value] });
      }
      input.value = '';
    }

    addBtn.addEventListener('click', addGenre);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addGenre();
      }
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

  // Hovering "SCSM" shows images/fellow-kids.webp following the cursor -
  // a pure easter egg, no settings involved. Positioned via inline
  // top/left (not CSS :hover) so it can track mousemove, and un-hidden
  // only for the duration of the hover.
  function initHoverEasterEgg() {
    const titleblock = document.getElementById('titleblock');
    const egg = document.getElementById('hoverEasterEgg');
    if (!titleblock || !egg) return;

    function moveTo(e) {
      egg.style.left = e.clientX + 12 + 'px';
      egg.style.top = e.clientY + 12 + 'px';
    }

    titleblock.addEventListener('mouseenter', (e) => {
      egg.hidden = false;
      moveTo(e);
    });
    titleblock.addEventListener('mousemove', moveTo);
    titleblock.addEventListener('mouseleave', () => {
      egg.hidden = true;
    });
  }

  init();
  initGenreInput();
  initHoverEasterEgg();
})();
