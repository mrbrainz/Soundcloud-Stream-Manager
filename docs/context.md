# Soundcloud Stream Manager (SCSM) — context & working instructions

Read this first. It front-loads everything a fresh session needs so you don't
burn tokens re-exploring. The active backlog lives on the GitHub Project board
([github.com/users/mrbrainz/projects/2](https://github.com/users/mrbrainz/projects/2),
"SCSM 2.0") — `gh project item-list 2 --owner mrbrainz` to read it. Four
statuses, left to right: **Backlog** (parked — flagged as maybe not needed, or
not yet prioritized), **Ready** (queued, pick from here), **In Progress**,
**Done**.

## What this is

A browser bookmarklet that injects a floating control panel onto a user's
SoundCloud stream page, letting them prune it in real time: remove reposts (or
non-reposts), remove tracks over/under a length, remove tracks older than N
days, jump to the next track, copy the "now playing" URL, search the current
track on Deezer. Ships as a static site on GitHub Pages
([mrbrainz.github.io/Soundcloud-Stream-Manager](https://mrbrainz.github.io/Soundcloud-Stream-Manager))
that hosts the landing page and the script the bookmarklet loads.

**Status: planning SCSM 2.0.** The existing (v1) implementation has decayed —
SoundCloud has changed its frontend and API surface repeatedly since this was
last actively maintained, and the panel currently shows the user a hardcoded
"this is broken" alert. Nothing about the v2 rebuild (stack, whether to keep
the bookmarklet delivery model, whether to keep scraping SoundCloud's DOM at
all) has been decided yet — that's what the board is for. Don't assume the v1
approach carries forward; treat it as reference/prior art, not a foundation.

## Reference material

[`references/`](../references) holds two working Tampermonkey userscripts
(SoundCloud Repost Age, SoundCloud Playlist Membership) kept as prior art —
see [references/README.md](../references/README.md). They demonstrate a
current, working approach to the same class of problem SCSM v1 rotted on:
reading `client_id` live from `window.__sc_hydration` instead of hardcoding
it, authenticated `api-v2.soundcloud.com` calls via the `oauth_token` cookie,
and DOM/MutationObserver patterns tuned to SoundCloud's current markup. Worth
consulting before deciding SCSM 2.0's own approach to auth and DOM matching.

## Terminology

- **Bookmarklet** — the `javascript:` URI in [README.md](../README.md) and
  [index.html](../index.html) users drag to their bookmarks bar. Injects a
  `<script>` tag pointing at `src/scsm-min.js` (with a cache-busting random
  query param) into whatever page they're on.
- **Panel** / **console** (`#murkconsole` in the code) — the floating UI box
  the bookmarklet injects into the stream sidebar, with the checkboxes/buttons
  for each filter.
- **Stream** — SoundCloud's `/feed` page (what SoundCloud's own UI calls
  "Stream"); the only page the panel activates on (v1 also special-cased the
  now-deleted local test fixture `sclayouttest.html`).
- **Murk** — the informal verb used throughout v1's code/function names
  (`totalMurkHandler`, `repostMurkHandler`, `shpKillMixes`, etc.) for "hide/
  remove a stream item." Not SoundCloud terminology — an in-joke from the
  original author, kept here only so old code/commit history makes sense.
- **Repost** — a track a followed user reshared rather than uploaded
  themselves; SoundCloud renders these with a `sc-ministats-reposts` marker,
  which v1 used to distinguish reposts from original uploads.

## Stack & layout (v1, current)

- **`index.html`** + [`stylesheets/`](../stylesheets) — the GitHub Pages
  landing site: usage instructions, the drag-to-bookmark link, GA tracking,
  download/view-on-GitHub buttons. Jekyll-theme scaffold (unminified
  `stylesheets/github-dark.css`/`print.css` are leftover theme assets, not
  hand-maintained).
- **[`src/scsm.js`](../src/scsm.js)** — the actual bookmarklet logic,
  vanilla JS + jQuery 1.11.1 (bootstrapped from Google's CDN if not already
  present on the page). No build step.
- **[`src/scsm-min.js`](../src/scsm-min.js)** — the file the bookmarklet
  actually loads in production. Currently just a straight copy of `scsm.js`
  (not actually minified) — there is no build/minify step in this repo; it's
  manually kept in sync.
- **[`javascripts/main.js`](../javascripts/main.js)** — an unused stub
  (`console.log('This would be the main JS file.')`) left over from the
  GitHub Pages Jekyll theme scaffold. Not wired into anything.
- No package.json, no test suite, no CI — this is a hand-edited static site.

## Known breakage / why v1 rotted

- **Hardcoded API auth.** Track metadata (upload date, duration,
  downloadable flag) comes from `api.soundcloud.com/resolve.json` with a
  hardcoded `client_id`. SoundCloud has tightened public API access over the
  years; this is a likely point of failure and probably can't just be
  patched with a new ID without checking current ToS/available auth.
- **Brittle CSS-class coupling.** Selectors like `li.soundList__item`,
  `.playbackSoundBadge__titleLink`, `.sound__coverArt` are tied to a specific
  SoundCloud frontend build. Every SoundCloud redesign has silently broken a
  chunk of functionality — verify current class names against the live DOM
  before assuming any v1 selector still works.
- **`startmurk()` in `scsm.js`** currently pops a hardcoded
  `window.alert(...)` dated 13/08/2021 telling users the panel is broken.
  That's the visible symptom of the above two issues.

## Per-PR workflow (once implementation starts)

0. Pick the next item from **Ready** (not Backlog — those are parked/
   unprioritized) and move its card to **In Progress** (`gh project
   item-edit`, or via the board UI) before starting.
1. `git checkout master && git pull`, then `git checkout -b feature/<name>`.
2. Implement — keep edits **surgical**.
3. Verify by loading the bookmarklet against a real SoundCloud stream page
   (there's no automated test harness here) — check the golden path and at
   least one edge case per filter touched.
4. Commit (footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`),
   push, `gh pr create` (PR body includes `Closes #<issue>` if it's a board
   item, footer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
5. **Stop** — the user merges and says "continue".
6. On "continue": pull `master`, and move the board card to **Done**
   (merging with `Closes #<issue>` in the PR body does this automatically;
   otherwise `gh project item-edit`/board UI).

## Token efficiency (priority)

- Don't re-read files you've seen; use `Read` with offset/limit and `grep`,
  not whole-file dumps.
- This repo is small — prefer direct `grep`/`find` over spawning explore
  subagents unless genuinely searching across many files.
- Plan first, execute lean.
