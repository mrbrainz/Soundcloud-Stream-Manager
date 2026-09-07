// "Add to hidden genres" hover affordance (#54): shows a small button next
// to a track's genre tag pill (live-verified structure -
// `a.soundTitle__tag` inside `div.soundTitle__tagContainer`, holding the
// genre's display text, e.g. "Future Garage") - clicking it appends that
// genre to the same `hiddenGenres` list #53's hide-filter reads, via
// lib/settings.js, live-applying immediately like every other setting.
// Clicking it again (once the genre's already on the list) REMOVES it,
// so the same button doubles as a quick undo without a trip to the popup.
//
// Deliberately independent of the hideGenres (filter enable) toggle - this
// is just a fast path for building the SAME list the popup's free-text
// input manages (#53), not a separate feature that needs its own on/off
// switch. Always on, low-friction: the button only becomes visible on
// hover of the tag, so it adds no visual noise the rest of the time.
//
// Three icon states (all pure CSS, no mouse-tracking JS needed):
// - not yet hidden: a crossed-out eye ("hide this genre").
// - already hidden, not hovering the button itself: a checkmark ("yep,
//   this one's hidden").
// - already hidden, HOVERING the button: an open eye ("click to unhide") -
//   swapping the checkmark for an eye on hover is what actually signals
//   the click now means "show these again", not "hide more".
(function () {
  'use strict';

  const TAG_SELECTOR = 'a.soundTitle__tag';
  const BTN_CLASS = 'scsm-genre-add-btn';
  const ADDED_CLASS = BTN_CLASS + '--added';

  let hiddenGenresLower = [];
  let pageTypeEnabled = true;

  // Feather-style icon paths (MIT-licensed shapes, redrawn inline rather
  // than pulled from a library - three tiny 24x24 viewBox SVGs, sized down
  // via CSS). currentColor so they inherit the button's own color.
  const ICON_EYE_SLASH =
    '<svg class="scsm-genre-icon scsm-genre-icon-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const ICON_CHECK =
    '<svg class="scsm-genre-icon scsm-genre-icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const ICON_EYE =
    '<svg class="scsm-genre-icon scsm-genre-icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  // A real <style> tag, not inline styles - :hover-revealing the button
  // only when the tag pill itself is hovered, and swapping the checkmark
  // for an eye on a DIRECT hover of the already-added button, both need
  // CSS rules inline styles on individual elements can't express.
  function injectStyles() {
    if (document.getElementById('scsm-genre-add-style')) return;
    const style = document.createElement('style');
    style.id = 'scsm-genre-add-style';
    style.textContent = `
      .${BTN_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        margin-left: 4px;
        border-radius: 50%;
        background: #ff2ec4;
        color: #fff;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.1s ease;
        vertical-align: middle;
        border: none;
        padding: 0;
      }
      .soundTitle__tagContainer:hover .${BTN_CLASS},
      .${BTN_CLASS}:hover,
      .${BTN_CLASS}:focus {
        opacity: 1;
      }
      .${BTN_CLASS}.${ADDED_CLASS} {
        background: #8b5cf6;
      }
      .scsm-genre-icon {
        width: 9px;
        height: 9px;
        display: none;
      }
      .${BTN_CLASS} .scsm-genre-icon-hide { display: block; }
      .${BTN_CLASS}.${ADDED_CLASS} .scsm-genre-icon-hide { display: none; }
      .${BTN_CLASS}.${ADDED_CLASS} .scsm-genre-icon-check { display: block; }
      .${BTN_CLASS}.${ADDED_CLASS}:hover .scsm-genre-icon-check { display: none; }
      .${BTN_CLASS}.${ADDED_CLASS}:hover .scsm-genre-icon-eye { display: block; }
    `;
    document.head.appendChild(style);
  }

  function isHidden(genre) {
    return hiddenGenresLower.includes(genre.toLowerCase());
  }

  function applyButtonState(btn, genre) {
    const added = isHidden(genre);
    btn.classList.toggle(ADDED_CLASS, added);
    btn.title = added ? `"${genre}" is hidden - hover and click to show it again` : `Hide "${genre}" tracks`;
  }

  async function addGenre(genre) {
    const settings = await window.SCSMSettings.get();
    const existing = settings.hiddenGenres || [];
    // Case-insensitive de-dupe, matching popup.js's own add-genre logic -
    // this and the popup's free-text input write to the same list.
    if (existing.some((g) => g.toLowerCase() === genre.toLowerCase())) return;
    await window.SCSMSettings.set({ hiddenGenres: [...existing, genre] });
  }

  async function removeGenre(genre) {
    const settings = await window.SCSMSettings.get();
    const existing = settings.hiddenGenres || [];
    const next = existing.filter((g) => g.toLowerCase() !== genre.toLowerCase());
    if (next.length !== existing.length) {
      await window.SCSMSettings.set({ hiddenGenres: next });
    }
  }

  function annotateTag(tagEl) {
    if (tagEl.dataset.scsmGenreBtn === 'true') return; // idempotent
    // Sidebar modules (e.g. "New tracks") can carry the same tag markup -
    // see #50: only the main stream/search list should get feature
    // treatment.
    if (window.SCSMDom.isInSidebar(tagEl)) return;

    const genre = tagEl.textContent.trim();
    if (!genre) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.innerHTML = ICON_EYE_SLASH + ICON_CHECK + ICON_EYE;
    applyButtonState(btn, genre);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.classList.contains(ADDED_CLASS)) {
        removeGenre(genre);
      } else {
        addGenre(genre);
      }
      // A clicked <button> keeps browser focus after the click, and the
      // CSS below shows the button while :focus for keyboard users - left
      // unblurred, a MOUSE click would leave it visually stuck open
      // (opacity 1) until something else steals focus, instead of only
      // showing on an actual hover as intended.
      btn.blur();
    });

    tagEl.insertAdjacentElement('afterend', btn);
    tagEl.dataset.scsmGenreBtn = 'true';
  }

  // Re-checks every already-annotated tag's button against the CURRENT
  // hidden-genres list - needed when the list changes elsewhere (the
  // popup's own add/remove, or this same feature adding one) so an
  // already-visible "+" flips to "✓" (or back) without needing a rescan.
  function refreshAllButtons() {
    document.querySelectorAll(TAG_SELECTOR).forEach((tagEl) => {
      const btn = tagEl.nextElementSibling;
      if (!btn || !btn.classList.contains(BTN_CLASS)) return;
      applyButtonState(btn, tagEl.textContent.trim());
    });
  }

  function onDirty(dirtyNodes) {
    if (!pageTypeEnabled) return;
    dirtyNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!node) return;
      if (node.matches && node.matches(TAG_SELECTOR)) annotateTag(node);
      if (node.querySelectorAll) node.querySelectorAll(TAG_SELECTOR).forEach(annotateTag);
    });
  }

  function applySetting(settings) {
    hiddenGenresLower = (Array.isArray(settings.hiddenGenres) ? settings.hiddenGenres : []).map((g) => String(g).toLowerCase());
    // No settings toggle of its own (see the file comment) - #65's
    // page-type scoping is the one thing that CAN turn this off.
    const wasEnabled = pageTypeEnabled;
    pageTypeEnabled = window.SCSMDom.isPageTypeEnabled(settings);
    if (!pageTypeEnabled) {
      document.querySelectorAll('.' + BTN_CLASS).forEach((el) => el.remove());
      document.querySelectorAll(TAG_SELECTOR).forEach((tagEl) => delete tagEl.dataset.scsmGenreBtn);
      return;
    }
    refreshAllButtons();
    if (!wasEnabled) window.SCSMDom.rescan();
  }

  if (window.SCSMDom.isRelevantFrame()) {
    injectStyles();
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
    window.SCSMDom.onPageTypeChange(() => window.SCSMSettings.get().then(applySetting));
  }
})();
