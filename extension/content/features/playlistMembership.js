// "Show playlist membership" feature: badges track titles across
// feed/library/search and the standalone track/playlist page with which of
// your own playlists already contain them - adapted from
// references/soundcloud-playlist-membership.user.js, but writing crawled
// membership into the shared lib/api.js metadata cache (its reserved
// `playlists` slot) instead of a separate parallel index, and gated on the
// showPlaylistMembership popup setting instead of always running. See
// board card #9 and docs/context.md.
(function () {
  'use strict';

  const BADGE_CLASS = 'scsm-playlist-badge';
  const PAGE_SIZE = 10;
  const PAGE_DELAY_MS = 250; // be polite between pagination requests, matching the reference script

  let enabled = false;
  let crawledOnce = false;
  let xhrPatched = false;

  // Local bookkeeping of playlist -> track id membership, used only to
  // diff PUT bodies against their previous state and to recompute a
  // track's full membership list when one playlist changes. NOT the
  // source of truth for what gets displayed - that's always
  // lib/api.js's cache, kept in sync via setPlaylistsForTrackId.
  let knownPlaylists = {}; // playlistId -> { title, trackIds: number[] }

  // ---------- crawl: GET /users/{me}/playlists, paginated ----------
  async function crawlPlaylists() {
    const clientId = window.SCSMAuth.getClientId();
    const myId = window.SCSMAuth.getMyUserId();
    if (!clientId || !myId) return;

    const freshKnown = {};
    const trackToPlaylists = {}; // trackId -> [{id, title}]
    let offset = 0;

    for (;;) {
      const url =
        `https://api-v2.soundcloud.com/users/${myId}/playlists` +
        `?client_id=${clientId}&limit=${PAGE_SIZE}&offset=${offset}&linked_partitioning=1&app_locale=en`;
      let res;
      try {
        res = await fetch(url, { credentials: 'include', headers: window.SCSMAuth.authHeaders() });
      } catch (e) {
        break;
      }
      if (!res.ok) break;
      let data;
      try {
        data = await res.json();
      } catch (e) {
        break;
      }
      const collection = Array.isArray(data.collection) ? data.collection : [];
      if (collection.length === 0) break;

      for (const playlist of collection) {
        const pid = playlist.id;
        const trackIds = [];
        const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
        for (const t of tracks) {
          if (typeof t.id !== 'number') continue;
          trackIds.push(t.id);
          (trackToPlaylists[t.id] = trackToPlaylists[t.id] || []).push({ id: pid, title: playlist.title });
        }
        freshKnown[pid] = { title: playlist.title, trackIds };
      }

      if (collection.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }

    knownPlaylists = freshKnown;
    for (const [trackIdStr, playlists] of Object.entries(trackToPlaylists)) {
      await window.SCSMApi.setPlaylistsForTrackId(Number(trackIdStr), playlists);
    }
  }

  // ---------- keep membership in sync with your own add/remove/create/delete ----------
  // Confirmed live (see the reference script): adding/removing a track is
  // PUT /playlists/{id} with the FULL new track id list, not a single
  // add/remove op. Creation is POST /playlists (no id suffix); deletion is
  // DELETE /playlists/{id}.
  const PLAYLIST_ID_RE = /\/playlists\/(\d+)(?:\?|$)/;
  const PLAYLIST_CREATE_RE = /\/playlists\/?(?:\?|$)/;

  function membershipFor(trackId) {
    const memberships = [];
    for (const [pid, pdata] of Object.entries(knownPlaylists)) {
      if (pdata.trackIds.includes(trackId)) memberships.push({ id: Number(pid), title: pdata.title });
    }
    return memberships;
  }

  async function applyPlaylistTrackIds(playlistId, trackIds, title) {
    const prev = knownPlaylists[playlistId];
    const prevSet = new Set(prev ? prev.trackIds : []);
    const nextSet = new Set(trackIds);
    const changedTrackIds = [...new Set([...prevSet, ...nextSet])].filter((id) => prevSet.has(id) !== nextSet.has(id));

    knownPlaylists[playlistId] = {
      title: title || (prev && prev.title) || '(untitled)',
      trackIds: [...nextSet],
    };

    for (const trackId of changedTrackIds) {
      await window.SCSMApi.setPlaylistsForTrackId(trackId, membershipFor(trackId));
    }
    if (enabled) window.SCSMDom.rescan();
  }

  async function removePlaylistFromIndex(playlistId) {
    const prev = knownPlaylists[playlistId];
    if (!prev) return;
    delete knownPlaylists[playlistId];
    for (const trackId of prev.trackIds) {
      await window.SCSMApi.setPlaylistsForTrackId(trackId, membershipFor(trackId));
    }
    if (enabled) window.SCSMDom.rescan();
  }

  function patchXHR() {
    const OrigXHR = window.XMLHttpRequest;
    const origOpen = OrigXHR.prototype.open;
    const origSend = OrigXHR.prototype.send;

    OrigXHR.prototype.open = function (method, url, ...rest) {
      this.__scsmMethod = method;
      this.__scsmUrl = url;
      return origOpen.call(this, method, url, ...rest);
    };

    OrigXHR.prototype.send = function (body) {
      const method = (this.__scsmMethod || '').toUpperCase();
      const url = this.__scsmUrl || '';

      if (typeof url === 'string' && url.includes('api-v2.soundcloud.com/playlists')) {
        const idMatch = url.match(PLAYLIST_ID_RE);

        if (method === 'PUT' && idMatch) {
          const playlistId = Number(idMatch[1]);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try {
              const parsed = JSON.parse(body);
              const trackIds = parsed && parsed.playlist && Array.isArray(parsed.playlist.tracks) ? parsed.playlist.tracks : null;
              if (trackIds) applyPlaylistTrackIds(playlistId, trackIds);
            } catch (e) {
              console.warn('[SCSM playlist membership] could not parse PUT body for sync', e);
            }
          });
        } else if (method === 'DELETE' && idMatch) {
          const playlistId = Number(idMatch[1]);
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            removePlaylistFromIndex(playlistId);
          });
        } else if (method === 'POST' && !idMatch && PLAYLIST_CREATE_RE.test(url)) {
          this.addEventListener('load', () => {
            if (this.status < 200 || this.status >= 300) return;
            try {
              const created = JSON.parse(this.responseText);
              if (created && typeof created.id === 'number') {
                const tracks = Array.isArray(created.tracks) ? created.tracks : [];
                const trackIds = tracks.map((t) => t.id).filter((id) => typeof id === 'number');
                applyPlaylistTrackIds(created.id, trackIds, created.title);
              }
            } catch (e) {
              console.warn('[SCSM playlist membership] could not parse playlist-create response for sync', e);
            }
          });
        }
      }

      return origSend.call(this, body);
    };
  }

  // ---------- DOM annotation ----------
  function renderLabel(playlists) {
    return playlists.length === 1 ? `✓ in "${playlists[0].title}"` : `✓ in ${playlists.length} playlists`;
  }

  function applyBadge(attachAfter, playlists) {
    const existing = attachAfter.nextElementSibling && attachAfter.nextElementSibling.classList.contains(BADGE_CLASS)
      ? attachAfter.nextElementSibling
      : null;

    if (!playlists || playlists.length === 0) {
      if (existing) existing.remove();
      return;
    }

    const label = renderLabel(playlists);
    if (existing) {
      if (existing.dataset.label !== label) {
        existing.dataset.label = label;
        existing.textContent = ' ' + label;
        existing.title = 'In your playlist' + (playlists.length > 1 ? 's' : '') + ':\n' + playlists.map((p) => p.title).join('\n');
      }
      return;
    }

    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    span.dataset.label = label;
    span.textContent = ' ' + label;
    span.style.opacity = '0.75';
    span.style.color = '#3fa9f5';
    span.title = 'In your playlist' + (playlists.length > 1 ? 's' : '') + ':\n' + playlists.map((p) => p.title).join('\n');
    attachAfter.insertAdjacentElement('afterend', span);
  }

  async function annotateAnchor(anchor) {
    if (!enabled) return;
    const row = window.SCSMDom.findRowForAnchor(anchor);
    if (row && window.SCSMRowState.isMinimized(row)) return;

    const path = window.SCSMDom.permalinkPathFromHref(anchor.getAttribute('href'));
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled) return;
    applyBadge(anchor, track && track.playlists);
  }

  async function annotateStandalonePage() {
    if (!enabled) return;
    if (document.querySelector('a.soundTitle__title[href]')) return; // this page shape has real anchors - annotateAnchor's job
    const h1 = document.querySelector('h1');
    if (!h1) return;

    const path = window.SCSMDom.standalonePermalinkPath();
    const track = await window.SCSMApi.resolveByPermalinkPath(path);
    if (!enabled) return;
    applyBadge(h1, track && track.playlists);
  }

  function onDirty(dirtyNodes) {
    if (!enabled) return;
    dirtyNodes.forEach((node) => {
      window.SCSMDom.findTrackAnchors(node).forEach(annotateAnchor);
    });
    annotateStandalonePage();
  }

  function removeAllBadges() {
    document.querySelectorAll('.' + BADGE_CLASS).forEach((el) => el.remove());
  }

  async function applySetting(settings) {
    const shouldEnable = !!settings.showPlaylistMembership;
    if (shouldEnable === enabled) return;
    enabled = shouldEnable;

    if (!enabled) {
      removeAllBadges();
      return;
    }

    // The XHR patch and the crawl are both side effects a user who's never
    // turned this on shouldn't pay for - install/run them lazily, once,
    // the first time the feature is actually enabled.
    if (!xhrPatched) {
      patchXHR();
      xhrPatched = true;
    }
    if (!crawledOnce) {
      crawledOnce = true;
      await crawlPlaylists();
    }
    window.SCSMDom.rescan();
    annotateStandalonePage();
  }

  if (window.SCSMDom.isRelevantFrame()) {
    window.SCSMDom.onScan(onDirty);
    window.SCSMSettings.get().then(applySetting);
    window.SCSMSettings.onChange(applySetting);
  }
})();
