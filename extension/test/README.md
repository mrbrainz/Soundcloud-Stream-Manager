# Mock test harness

Lets most SCSM 2.0 development and manual verification happen without
touching `soundcloud.com` — no live rate limits, no needing genuinely-aged
or genuinely-long tracks in a real account, and no risk of SoundCloud's own
markup shifting mid-development the way it did under SCSM v1. See
[docs/context.md](../../docs/context.md) and board card
["Design a mock-based test approach"](https://github.com/mrbrainz/Soundcloud-Stream-Manager/issues/16).

This complements, not replaces, [#15's live cross-page verification
pass](https://github.com/mrbrainz/Soundcloud-Stream-Manager/issues/15) —
that stays as the final real-world check before calling a feature done.

## How it works

Each fixture in `fixtures/` is a plain static HTML page that:

1. Reproduces one real SoundCloud page shape's markup (see below).
2. Loads the mocks (`mocks/chrome-mock.js`, `mocks/data.js`,
   `mocks/sc-api-mock.js`).
3. Loads the **real, unmodified** extension source files
   (`extension/lib/*.js`, `extension/content/content.js`) via plain
   `<script>` tags, in the same order `manifest.json` does.

Because the mocks install `window.chrome.storage`, `window.fetch`,
`window.__sc_hydration`, and the `oauth_token` cookie before the real source
loads, that source has no idea it isn't running as a content script on
`soundcloud.com` — nothing in `extension/lib` or `extension/content` needs
mock-awareness or test-only branches.

## Running it

Any static file server works, rooted at `extension/` (not `extension/test/`
— the fixtures' `../../lib/...` script paths need `lib/` and `content/` to
be reachable as siblings of `test/`):

```bash
cd extension && python3 -m http.server 8765
```

Then open `http://localhost:8765/test/` and click into a fixture. Open devtools:
`mocks/sc-api-mock.js` runs a self-test against every mocked endpoint on
load and logs pass/fail, so a broken mock or a typo'd fixture permalink
fails loudly instead of a feature silently getting no data.

(Opening the fixtures directly via `file://` also works for the DOM/mock
parts, but `history.replaceState`, used by `standalone-track.html` to fake
its own permalink path, and some `fetch` behavior are more reliable served
over `http://`.)

## Page shapes covered

- **`fixtures/feed.html`** — the feed/library/search row shape:
  `li.soundList__item` + `a.soundTitle__title[href]`, `sc-ministats-reposts`
  marking a repost, and a `relativeTime`/`sc-visuallyhidden` "Reposted X
  ago" structure matching what
  [`references/soundcloud-repost-age.user.js`](../../references/soundcloud-repost-age.user.js)
  expects. Feed, library, and search all share this shape, so one fixture
  covers all three.
- **`fixtures/api-selfcheck.html`** — not a page-shape fixture; asserts
  `lib/auth.js` and `lib/api.js`'s actual return values against every
  scenario in `mocks/data.js` (correctness, not just reachability — compare
  `mocks/sc-api-mock.js`'s own self-test, which only checks the mocked
  endpoints themselves respond).
- **`fixtures/settings-selfcheck.html`** — not a page-shape fixture;
  asserts `lib/settings.js`'s defaults, that `set()` merges rather than
  replaces, and that `onChange` fires with the fully-merged settings object
  for every `set()` call.
- **`fixtures/dom-selfcheck.html`** — not a page-shape fixture; asserts
  `lib/dom.js`'s row matching (`findTrackAnchors`, `permalinkPathFromHref`)
  and its shared scan loop (`onScan`, `rescan`), including that a
  dynamically-added row is picked up by the MutationObserver batch.
- **`fixtures/standalone-track.html`** — the standalone
  `soundcloud.com/artist/track` page shape: SoundCloud renders this inside a
  same-origin `webiIframe` with a plain `<h1>` and no
  `a.soundTitle__title` anchors at all. The fixture rewrites its own URL via
  `history.replaceState` before the mocks load, so `location.pathname` —
  what the real code reads as the permalink on this page shape — reports
  whatever fixture track path you want to test.

## Mock data

`mocks/data.js` is the single source of truth for fixture scenarios, keyed
by permalink path:

| Scenario | Path | Exercises |
|---|---|---|
| Old repost | `/testartist/old-repost-track` | hide-old-tracks filter, large repost age |
| Recent repost | `/testartist/recent-repost-track` | repost age display, should NOT hide |
| Long mix | `/testartist/long-mix` | hide-long-tracks filter |
| Short + downloadable | `/testartist/short-downloadable-track` | download button, search links, should NOT hide |
| In 2 playlists | `/testartist/in-playlist-track` | playlist membership badge |

To add a new scenario: add an entry to `mocks/data.js`'s `tracks` (and
`playlistsPage` if it should belong to a playlist), then reference its
permalink path from a fixture's markup. No other file needs to change.

## What's mocked vs. real

- **Mocked:** `window.fetch` for anything hitting `api-v2.soundcloud.com`
  (`/resolve`, `/tracks/{id}`, `/users/{id}/playlists`),
  `window.__sc_hydration`, the `oauth_token` cookie, and
  `chrome.storage.local`/`chrome.storage.onChanged`.
- **Real:** every file under `extension/lib/` and `extension/content/` —
  the actual feature logic, unmodified.
- **Not covered here:** the popup (`extension/popup/`) isn't wired into
  these fixtures yet since it renders in its own extension-popup context
  rather than a content-script page; revisit once the "Popup UI shell" card
  lands and there's real toggle logic to exercise.
