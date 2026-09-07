// Reusable "minimize / show" row treatment, shared by all three hide-filters
// (hide tracks older than X days, hide tracks longer than X minutes, hide
// tracks already in a playlist) so none of them reimplements it - see the
// "Reusable minimize/show row component" board card. Per the SCSM 2.0
// planning decision, a track that trips a filter is NOT removed from the
// DOM and NOT faded - it's collapsed down to a single line (a caller-
// supplied title plus why it's hidden) with a "show" link that restores
// the row exactly as it was.
//
// A row can trip MULTIPLE filters at once (e.g. both too long AND already
// in a playlist) - this module tracks a SET of reasons per row, not just
// one, and only fully restores a row once every reason that applied to it
// has been either cleared by its own filter or dismissed by the user. An
// earlier single-reason version of this file caused #64: clicking "show"
// only ever recorded ONE reason as dismissed, so whichever OTHER filter
// still matched would immediately re-minimize the row under its own
// reason on the very rescan the "show" click itself triggers - the
// displayed reason would flip-flop between filters and the row could never
// actually stay visible.
//
// Deliberately doesn't know anything about SoundCloud's markup, reposts, or
// what "old"/"long"/"in a playlist" mean - it just hides a row's real
// children behind a wrapper and swaps in a summary line, which any feature
// can call given a row element, a title, and its own reason key + human
// text.
(function () {
  'use strict';

  const ORIGINAL_CLASS = 'scsm-row-original';
  const SUMMARY_CLASS = 'scsm-row-summary';

  function isMinimized(rowEl) {
    return rowEl.dataset.scsmMinimized === 'true';
  }

  // ---- per-row reason bookkeeping ----
  // scsmReasons: JSON map of reasonKey -> human reasonText, e.g.
  // {"old":"older than 30 days","inPlaylist":"already in a playlist"} -
  // the source of truth for what's currently hiding this row and what the
  // combined label should say.
  // scsmReasonKeys: the SAME keys as scsmReasons, but also duplicated into
  // a plain space-separated attribute so a CSS attribute selector
  // ([data-scsm-reason-keys~="old"]) can find "every row I (hideOldTracks)
  // currently have a reason on" without every feature having to parse JSON
  // just to build a selector - restoreOwnRows() in each feature needs
  // exactly that.
  function getReasons(rowEl) {
    try {
      return JSON.parse(rowEl.dataset.scsmReasons || '{}');
    } catch (e) {
      return {};
    }
  }

  function setReasons(rowEl, reasons) {
    const keys = Object.keys(reasons);
    if (keys.length === 0) {
      delete rowEl.dataset.scsmReasons;
      delete rowEl.dataset.scsmReasonKeys;
      return;
    }
    rowEl.dataset.scsmReasons = JSON.stringify(reasons);
    rowEl.dataset.scsmReasonKeys = keys.join(' ');
  }

  function getDismissedReasons(rowEl) {
    return (rowEl.dataset.scsmDismissedReasons || '').split(' ').filter(Boolean);
  }

  function setDismissedReasons(rowEl, keys) {
    if (keys.length === 0) {
      delete rowEl.dataset.scsmDismissedReasons;
    } else {
      rowEl.dataset.scsmDismissedReasons = keys.join(' ');
    }
  }

  function combinedLabel(title, reasons) {
    const texts = Object.values(reasons);
    if (texts.length === 0) return title;
    return `${title} — hidden: ${texts.join(', ')}`;
  }

  function renderLabel(rowEl) {
    const summary = rowEl.querySelector(':scope > .' + SUMMARY_CLASS);
    if (!summary) return;
    const label = combinedLabel(rowEl.dataset.scsmTitle || '', getReasons(rowEl));
    if (summary.dataset.label !== label) {
      summary.dataset.label = label;
      summary.querySelector('.scsm-row-summary-text').textContent = label;
    }
  }

  // title: the track title (or anchor text fallback) - the same across
  // every filter that hides this row, so it's stored once and reused as
  // more reasons get added.
  // opts.reason: this filter's own short, stable key (e.g. 'old', 'long',
  // 'inPlaylist') - used for isDismissed()/unapplyReason()/restoreOwnRows()
  // lookups.
  // opts.reasonText: the human-readable phrase for THIS reason alone (e.g.
  // "older than 30 days") - combined with every other active reason's text
  // into one label, not shown alone.
  function minimize(rowEl, title, opts) {
    opts = opts || {};
    const reason = opts.reason;
    const reasonText = opts.reasonText || reason || '';

    const reasons = getReasons(rowEl);
    if (reason) reasons[reason] = reasonText;
    setReasons(rowEl, reasons);
    rowEl.dataset.scsmTitle = title;

    if (isMinimized(rowEl)) {
      // Already minimized (by this filter or another one) - just keep the
      // combined label current, don't re-hide already-hidden content.
      renderLabel(rowEl);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = ORIGINAL_CLASS;
    wrapper.style.display = 'none';
    while (rowEl.firstChild) {
      wrapper.appendChild(rowEl.firstChild);
    }
    rowEl.appendChild(wrapper);

    const labelText = combinedLabel(title, reasons);
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
      // A manual "show" click is a user override, not just an unwrap: mark
      // EVERY reason currently active on this row as dismissed (not just
      // one - see #64) BEFORE restoring, so no filter that matched it
      // immediately re-minimizes the row right back on the rescan
      // restore() itself triggers.
      const activeKeys = Object.keys(getReasons(rowEl));
      if (activeKeys.length) {
        const dismissed = new Set(getDismissedReasons(rowEl));
        activeKeys.forEach((k) => dismissed.add(k));
        setDismissedReasons(rowEl, [...dismissed]);
      }
      restore(rowEl);
    });
    summary.appendChild(showLink);

    rowEl.appendChild(summary);
    rowEl.dataset.scsmMinimized = 'true';
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
    setReasons(rowEl, {});
    delete rowEl.dataset.scsmTitle;

    // Other features (search links, download button) deliberately skip
    // rendering into a minimized row - trigger a rescan so anything that
    // held off while this row was hidden gets a chance to annotate it now
    // that it's visible again. Guarded since some callers (e.g. this
    // module's own fixture) use rowState in isolation without lib/dom.js.
    if (window.SCSMDom) window.SCSMDom.rescan();
  }

  // A filter calls this when ITS OWN condition no longer matches (e.g. the
  // threshold was raised past this row's age) - removes just that one
  // reason from the set. If no reason remains, the row is fully restored;
  // if other filters' reasons are still outstanding, the row STAYS hidden
  // (with an updated label) instead of springing back open under a
  // condition that still applies - this is the other half of #64's fix.
  function unapplyReason(rowEl, reason) {
    if (!isMinimized(rowEl)) return;
    const reasons = getReasons(rowEl);
    if (!(reason in reasons)) return;
    delete reasons[reason];
    setReasons(rowEl, reasons);
    if (Object.keys(reasons).length === 0) {
      restore(rowEl);
    } else {
      renderLabel(rowEl);
    }
  }

  // Whether the user explicitly clicked "show" to override this SPECIFIC
  // reason - a filter should check this before re-minimizing a row for the
  // same reason on a later rescan (a rescan the user's own click triggers,
  // via restore() above).
  function isDismissed(rowEl, reason) {
    return getDismissedReasons(rowEl).includes(reason);
  }

  // Clears the dismissal for one reason (used by a filter's own
  // restoreOwnRows() when the filter itself is toggled off - a fresh
  // enable/disable cycle gives THAT filter's dismissals a clean slate,
  // without touching any other filter's still-active dismissals).
  function clearDismissed(rowEl, reason) {
    const remaining = getDismissedReasons(rowEl).filter((k) => k !== reason);
    setDismissedReasons(rowEl, remaining);
  }

  window.SCSMRowState = { minimize, restore, unapplyReason, isMinimized, isDismissed, clearDismissed };
})();
