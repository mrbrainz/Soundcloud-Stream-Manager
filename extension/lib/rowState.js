// Reusable "minimize / show" row treatment, shared by both hide-filters
// (hide tracks older than X days, hide tracks longer than X minutes) so
// neither reimplements it - see the "Reusable minimize/show row component"
// board card. Per the SCSM 2.0 planning decision, a track that trips a
// filter is NOT removed from the DOM and NOT faded - it's collapsed down to
// a single line (a caller-supplied label, typically "Artist – Title") with
// a "show" link that restores the row exactly as it was.
//
// Deliberately doesn't know anything about SoundCloud's markup, reposts, or
// what "old"/"long" mean - it just hides a row's real children behind a
// wrapper and swaps in a summary line, which any feature can call given a
// row element and a label string.
(function () {
  'use strict';

  const ORIGINAL_CLASS = 'scsm-row-original';
  const SUMMARY_CLASS = 'scsm-row-summary';

  function isMinimized(rowEl) {
    return rowEl.dataset.scsmMinimized === 'true';
  }

  function minimize(rowEl, labelText, opts) {
    opts = opts || {};

    if (isMinimized(rowEl)) {
      // Already minimized - just keep the label current (e.g. metadata
      // resolved after the row was first minimized) rather than re-hiding
      // already-hidden content.
      const summary = rowEl.querySelector(':scope > .' + SUMMARY_CLASS);
      if (summary && summary.dataset.label !== labelText) {
        summary.dataset.label = labelText;
        summary.querySelector('.scsm-row-summary-text').textContent = labelText;
      }
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = ORIGINAL_CLASS;
    wrapper.style.display = 'none';
    while (rowEl.firstChild) {
      wrapper.appendChild(rowEl.firstChild);
    }
    rowEl.appendChild(wrapper);

    const summary = document.createElement('div');
    summary.className = SUMMARY_CLASS;
    summary.dataset.label = labelText;
    summary.style.opacity = '0.7';
    summary.style.fontSize = '12px';
    summary.style.padding = '4px 0';

    const text = document.createElement('span');
    text.className = 'scsm-row-summary-text';
    text.textContent = labelText;
    summary.appendChild(text);

    summary.appendChild(document.createTextNode(' — '));

    const showLink = document.createElement('a');
    showLink.href = '#';
    showLink.className = 'scsm-row-show-link';
    showLink.textContent = 'show';
    showLink.style.color = '#3fa9f5';
    showLink.addEventListener('click', (e) => {
      e.preventDefault();
      restore(rowEl);
    });
    summary.appendChild(showLink);

    rowEl.appendChild(summary);
    rowEl.dataset.scsmMinimized = 'true';
    if (opts.reason) rowEl.dataset.scsmMinimizeReason = opts.reason;
  }

  function restore(rowEl) {
    if (!isMinimized(rowEl)) return;

    const summary = rowEl.querySelector(':scope > .' + SUMMARY_CLASS);
    if (summary) summary.remove();

    const wrapper = rowEl.querySelector(':scope > .' + ORIGINAL_CLASS);
    if (wrapper) {
      while (wrapper.firstChild) {
        rowEl.appendChild(wrapper.firstChild);
      }
      wrapper.remove();
    }

    delete rowEl.dataset.scsmMinimized;
    delete rowEl.dataset.scsmMinimizeReason;

    // Other features (search links, download button) deliberately skip
    // rendering into a minimized row - trigger a rescan so anything that
    // held off while this row was hidden gets a chance to annotate it now
    // that it's visible again. Guarded since some callers (e.g. this
    // module's own fixture) use rowState in isolation without lib/dom.js.
    if (window.SCSMDom) window.SCSMDom.rescan();
  }

  window.SCSMRowState = { minimize, restore, isMinimized };
})();
