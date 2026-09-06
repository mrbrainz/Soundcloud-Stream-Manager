// Shared inline icon-row container, per the SCSM 2.0 planning decision
// that search links and the legacy download button live in ONE row of
// icons per track, not two separate rows. getOrCreateIconRow(row) is
// idempotent - every feature that wants to add an icon calls it and gets
// the same container back, appending its own icon without knowing or
// caring what else is already in there. See board card #12 and
// docs/context.md.
(function () {
  'use strict';

  const CONTAINER_CLASS = 'scsm-icon-row';

  function getOrCreateIconRow(row) {
    let container = row.querySelector(':scope > .' + CONTAINER_CLASS);
    if (!container) {
      container = document.createElement('div');
      container.className = CONTAINER_CLASS;
      container.style.marginTop = '4px';
      row.appendChild(container);
    }
    return container;
  }

  window.SCSMIconRow = { getOrCreateIconRow };
})();
