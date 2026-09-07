// Shared inline icon-row container, per the SCSM 2.0 planning decision
// that search links and the legacy download button live in ONE row of
// icons per track, not two separate rows. getOrCreateIconRow(row) is
// idempotent - every feature that wants to add an icon calls it and gets
// the same container back, appending its own icon without knowing or
// caring what else is already in there. See board cards #12/#40 and
// docs/context.md.
(function () {
  'use strict';

  const CONTAINER_CLASS = 'scsm-icon-row';

  function getOrCreateIconRow(row) {
    // Search all descendants, not just direct children - the container
    // may now be nested wherever SoundCloud's own action row lives (see
    // below), not necessarily a direct child of `row`. Minimizing the row
    // still hides it correctly either way, since rowState.minimize() moves
    // row's direct children (and everything nested inside them) into its
    // hidden wrapper wholesale.
    let container = row.querySelector('.' + CONTAINER_CLASS);
    if (container) return container;

    container = document.createElement('div');
    // Reuses SoundCloud's own button-group classes so our buttons inherit
    // its native dark pill styling automatically, instead of needing our
    // own CSS to approximate it - confirmed live (#40) real structure:
    // div.soundActions.sc-button-toolbar > div.sc-button-group > button
    // .sc-button.sc-button-secondary...
    container.className = CONTAINER_CLASS + ' sc-button-group sc-button-group-medium';

    // 3px gap from SoundCloud's own like/repost/share row above, so the
    // icon row visually separates from it instead of sitting flush
    // against it (#68) - applies in BOTH insertion paths now; previously
    // only the fallback path (no .soundActions) got any spacing at all.
    container.style.marginTop = '3px';

    const soundActions = row.querySelector('.soundActions');
    if (soundActions) {
      // Sit immediately after SoundCloud's own like/repost/share row,
      // reading as part of the same action area instead of a separate
      // line of plain text below the whole card (the original complaint).
      soundActions.insertAdjacentElement('afterend', container);
    } else {
      // Fallback for a page shape without that structure (e.g. a
      // simplified test fixture) - append directly to the row like before.
      row.appendChild(container);
    }
    return container;
  }

  // Builds one native-looking icon button for the row above: reuses
  // SoundCloud's own sc-button classes for sizing/hover states. Prefers a
  // real icon image (iconUrl) when given one - see extension/icons/services/
  // (#68) - falling back to the colored-initial badge (badgeText/
  // badgeColor) from #40 when a platform has no icon asset available yet,
  // so nothing regresses to a blank button.
  function createIconButton({ extraClass, href, title, badgeText, badgeColor, iconUrl }) {
    const link = document.createElement('a');
    link.className = 'sc-button sc-button-secondary sc-button-small sc-button-responsive' + (extraClass ? ' ' + extraClass : '');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = title;
    link.style.display = 'inline-flex';
    link.style.alignItems = 'center';
    link.style.justifyContent = 'center';
    link.style.padding = '0';
    link.style.width = '28px';
    link.style.minWidth = '28px';

    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = '';
      img.style.width = '16px';
      img.style.height = '16px';
      img.style.borderRadius = '3px';
      img.setAttribute('aria-hidden', 'true');
      link.appendChild(img);
    } else {
      const badge = document.createElement('span');
      badge.textContent = badgeText;
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.width = '16px';
      badge.style.height = '16px';
      badge.style.borderRadius = '50%';
      badge.style.backgroundColor = badgeColor;
      badge.style.color = '#fff';
      badge.style.fontSize = '9px';
      badge.style.fontWeight = 'bold';
      badge.style.lineHeight = '1';
      badge.setAttribute('aria-hidden', 'true');
      link.appendChild(badge);
    }

    // Don't let the click bubble into the row's own click-to-play handler.
    link.addEventListener('click', (e) => e.stopPropagation());
    return link;
  }

  window.SCSMIconRow = { getOrCreateIconRow, createIconButton };
})();
