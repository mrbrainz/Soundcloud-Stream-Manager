# Soundcloud Stream Manager (SCSM) — context & working instructions

Read this first. It front-loads everything a fresh session needs so you don't
burn tokens re-exploring. The active backlog lives on the GitHub Project board
([github.com/users/mrbrainz/projects/2](https://github.com/users/mrbrainz/projects/2),
"SCSM 2.0") — `gh project item-list 2 --owner mrbrainz` to read it. Four
statuses, left to right: **Backlog** (parked — flagged as maybe not needed, or
not yet prioritized), **Ready** (queued, pick from here), **In Progress**,
**Done**.

## What this is

A Manifest V3 Chrome extension (`extension/`) that lets a user prune their
SoundCloud stream in real time via a popup of feature toggles — every setting
live-applies immediately to any open `soundcloud.com` tab, no page refresh
needed. See [README.md](../README.md) for the user-facing feature list and
install steps, and [extension/README.md](../extension/README.md) for the
extension's own directory breakdown.

This replaced an older bookmarklet-based v1 that injected a floating panel
onto the page and had decayed against SoundCloud's current frontend/API. That
history lives on in `git log`, [`src/`](../src), [`index.html`](../index.html),
and [`stylesheets/`](../stylesheets) as reference only — none of it is part of
the active codebase. Don't assume v1's approach carries forward; the extension
was built fresh, informed by the working Tampermonkey scripts in
[`references/`](../references) (see below), not by porting v1's code.

## Architecture

- **`extension/manifest.json`** — permissions, content-script matches. Two
  `content_scripts` entries: one running in the page's **MAIN** world
  (`content/mainWorldBridge.js`, `document_start`), the rest in the default
  **isolated** world (`document_idle`). This split matters a lot — see
  "Isolated vs. main world" below.
- **`extension/popup/`** — the toolbar popup (`popup.html`/`.css`/`.js`):
  one toggle row per feature, some with a threshold input or a free-text
  list (hidden genres). Styled in a dark neon "brainrot" aesthetic.
  `popup.js` wires each row's checkbox/input straight to `lib/settings.js` —
  no local state of its own.
- **`extension/content/features/`** — one file per feature, each an IIFE that
  self-registers via `window.SCSMDom.onScan()` and
  `window.SCSMSettings.onChange()` and does nothing until its own setting(s)
  say to. Current features: `repostAge.js`, `playlistMembership.js`,
  `hideOldTracks.js`, `hideLongTracks.js`, `hideInPlaylistTracks.js`,
  `hideGenreTracks.js`, `hoverAddGenre.js` (the genre filter's "add from the
  feed" affordance), `searchLinks.js`, `downloadButton.js`.
- **`extension/lib/`** — shared infrastructure every feature builds on:
  - `settings.js` — the single `chrome.storage.local` settings object
    (schema/defaults + `get`/`set`/`onChange`), the "live-apply" mechanism.
  - `auth.js` — reads `client_id`/user id (bridged from the main world, see
    below) and the `oauth_token` cookie.
  - `api.js` — the shared per-track metadata cache (`chrome.storage.local`,
    versioned key — bump it whenever `storeTrack()`'s normalized shape gains
    a field, or old cached entries silently keep missing it for their
    30-day TTL) plus a concurrency-limited request queue, so N features
    resolving the same track share one cache entry and one in-flight call.
  - `dom.js` — the one shared MutationObserver + debounce loop
    (`onScan`/`rescan`) every feature subscribes to instead of installing
    its own, plus page-shape helpers (`findTrackAnchors`, `isInSidebar`,
    `isRelevantFrame`, permalink parsing).
  - `rowState.js` — the shared minimize/show row treatment. A hidden row
    collapses to one summary line + a "show" link rather than disappearing.
    Tracks a **set** of reasons per row (not just one), since a row can
    trip more than one hide filter at once — see `minimize`/`unapplyReason`/
    `isDismissed`/`clearDismissed`.
  - `iconRow.js` — the shared per-track icon row (`searchLinks.js` and
    `downloadButton.js` both append into the same container instead of each
    rendering its own row).
- **`extension/icons/`** — toolbar/store icons.
- **`extension/test/`** — the mock test harness (see below).

### Isolated vs. main world

The single most-repeated root cause of live bugs in this codebase: a content
script's default **isolated world** shares the DOM with the page but gets a
completely separate set of JS globals/built-ins — `window.__sc_hydration` and
any patch to `XMLHttpRequest.prototype` made from the isolated world are both
invisible to the page's own (**main world**) code, and vice versa. Two things
only `content/mainWorldBridge.js` (which explicitly runs in the main world)
can do, bridging the result to the isolated world via the DOM (the one thing
both worlds actually share):
- Read `window.__sc_hydration` for `client_id`/user id, publishing them onto
  `document.documentElement.dataset` for `lib/auth.js` to read back.
- Patch `XMLHttpRequest` to observe the page's own playlist add/remove/
  create/delete calls, publishing a `scsm:playlist-sync` `CustomEvent` on
  `document` for `content/features/playlistMembership.js` to react to (DOM
  events, unlike JS globals, cross the world boundary).

Before assuming any new feature can read a page global or patch a page API
directly from an isolated-world content script file, check whether it needs
the same main-world bridge treatment.

## Test workflow

`extension/test/` holds a mock harness: static HTML fixtures
(`test/fixtures/*.html`) that load real, unmodified extension source against
mocked `chrome.storage`, `fetch`, `window.__sc_hydration`, and cookies
(`test/mocks/`) — no live SoundCloud or installed extension needed. Run
`extension/test/no-cache-server.py <port> extension` (a plain
`python3 -m http.server` sends cache headers the Browser tool's disk cache
takes too literally across edits — this one always sends
`Cache-Control: no-store`) and open a fixture at
`http://localhost:<port>/test/fixtures/<name>.html` in the Browser tool; each
one renders PASS/FAIL lines for its own assertions plus an `ALL PASSED`/`N
FAILED` summary, and logs the same to the console.

This is the primary way changes get verified — most PRs land on mock-harness
coverage alone. Reach for live verification via Claude in Chrome (against
real soundcloud.com) specifically when: the mock's assumptions about a live
API/DOM shape need confirming or re-confirming (SoundCloud's frontend has
changed more than once mid-project), or when a fix depends on the
isolated/main-world split in a way a single-realm fixture page can't
reproduce (the fixtures load every script into one JS realm, so they can't
by themselves catch a bug that only manifests across worlds — see above).
Reloading the unpacked extension itself (`chrome://extensions`) needs the
user; this session's browser tooling can't drive that page.

## Per-PR workflow

0. Pick the next item from **Ready** (or **Backlog** if the user names it
   directly) and move its card to **In Progress** before starting.
1. `git checkout master && git pull`, then `git checkout -b <type>/<name>`.
2. Implement — keep edits **surgical**.
3. Verify: run/extend the relevant mock-harness fixture(s); add live
   verification via Claude in Chrome when the change touches something a
   single-realm fixture can't prove (see above). For a UI/visual change,
   actually look at it rendered, not just at passing assertions.
4. Commit (footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`),
   push, `gh pr create` (PR body includes `Closes #<issue>` when there's a
   board item, footer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
5. **Stop** — the user merges and says "continue" (or reports it's still
   buggy — fix on the same PR/branch rather than opening a new one for the
   same card).
6. On "continue": pull `master`, and move the board card to **Done**
   (`Closes #<issue>` in the PR body does this automatically on merge;
   otherwise `gh project item-edit`/board UI). Then pick the next card.

## Terminology

- **Feature** — one file under `extension/content/features/`, gated behind
  its own `lib/settings.js` key(s), independent of every other feature.
- **Reason** — the short key a hide filter tags a row with in
  `lib/rowState.js` (e.g. `'old'`, `'long'`, `'genre'`) when it minimizes
  that row, paired with a human-readable phrase combined into the row's
  visible label alongside any other active filter's reason.
- **Minimize / restore** — `lib/rowState.js`'s vocabulary for collapsing a
  row to a summary line vs. putting its real content back.
- **Repost** — a track a followed user reshared rather than uploaded
  themselves; SoundCloud renders these with a `sc-ministats-reposts` marker
  (feed/search page shape) or a `"Reposted X ago"` a11y label
  (`repostAge.js`'s target).
- **Standalone page** — `soundcloud.com/<artist>/<track-or-set>` rendered
  inside SoundCloud's own same-origin `webiIframe` (a `/n/...`-prefixed
  route internally) — has no `a.soundTitle__title` anchors, unlike
  feed/library/search rows; `lib/dom.js`'s `standalonePermalinkPath()`
  handles this shape specifically.
- **Murk** — v1-only slang (`totalMurkHandler`, `shpKillMixes`, etc.) for
  "hide/remove a stream item," kept here only so old commit history/`git
  blame` on the pre-extension code makes sense. Not used anywhere in
  `extension/`.

## Reference material

[`references/`](../references) holds two working Tampermonkey userscripts
(SoundCloud Repost Age, SoundCloud Playlist Membership) — see
[references/README.md](../references/README.md). They're the actual prior
art the extension's `lib/auth.js`/`lib/api.js` auth and caching approach was
adapted from (reading `client_id` live from `window.__sc_hydration` instead
of hardcoding it, authenticated `api-v2.soundcloud.com` calls via the
`oauth_token` cookie) — worth a look before touching either file.

## Token efficiency (priority)

- Don't re-read files you've seen; use `Read` with offset/limit and `grep`,
  not whole-file dumps.
- This repo is small — prefer direct `grep`/`find` over spawning explore
  subagents unless genuinely searching across many files.
- Plan first, execute lean.
