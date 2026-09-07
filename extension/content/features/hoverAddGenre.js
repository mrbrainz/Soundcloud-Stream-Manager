// "Add to hidden genres" hover affordance (#54): shows a small "+" button
// next to a track's genre tag pill (live-verified structure -
// `a.soundTitle__tag` inside `div.soundTitle__tagContainer`, holding the
// genre's display text, e.g. "Future Garage") - clicking it appends that
// genre to the same `hiddenGenres` list #53's hide-filter reads, via
// lib/settings.js, live-applying immediately like every other setting.
//
// Deliberately independent of the hideGenres (filter enable) toggle - this
// is just a fast path for building the SAME list the popup's free-text
// input manages (#53), not a separate feature that needs its own on/off
// switch. Always on, low-friction: the "+" only becomes visible on hover
// of the tag, so it adds no visual noise the rest of the time.
(function () {
  'use strict';

  const TAG_SELECTOR = 'a.soundTitle__tag';
  const BTN_CLASS = 'scsm-genre-add-btn';
  const ADDED_CLASS = BTN_CLASS + '--added';

  let hiddenGenresLower = [];

  // A real <style> tag, not inline styles - :hover-revealing the "+" only
  // when the tag pill itself is hovered needs a CSS rule, which inline
  // styles on individual elements can't express.
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
        font-size: 10px;
        line-height: 1;
        font-weight: bold;
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
        cursor: default;
      }
    `;
    document.head.appendChild(style);
  }

  function isHidden(genre) {
    return hiddenGenresLower.includes(genre.toLowerCase());
  }

  function applyButtonState(btn, genre) {
    const added = isHidden(genre);
    btn.classList.toggle(ADDED_CLASS, added);
    btn.textContent = added ? '✓' : '+';
    btn.title = added ? `"${genre}" is already hidden` : `Hide "${genre}" tracks`;
  }

  async function addGenre(genre) {
    const settings = await window.SCSMSettings.get();
    const existing = settings.hiddenGenres || [];
    // Case-insensitive de-dupe, matching popup.js's own add-genre logic -
    // this and the popup's free-text input write to the same list.
    if (existing.some((g) => g.toLowerCase() === genre.toLowerCase())) return;
    await window.SCSMSettings.set({ hiddenGenres: [...existing, genre] });
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
    applyButtonState(btn, genre);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addGenre(genre);
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
    dirtyNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!node) return;
      if (node.matches && node.matches(TAG_SELECTOR)) annotateTag(node);
      if (node.querySelectorAll) node.querySelectorAll(TAG_SELECTOR).forEach(annotateTag);
    });
  }

  function applySetting(settings) {
    hiddenGenresLower = (Array.isArray(settings.hiddenGenres) ? settings.hiddenGenres : []).map((g) => String(g).toLowerCase());
    refreshAllButtons();
  }

  if (window.SCSMDom.isRelevantFrame()) {
    injectStyles();
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
