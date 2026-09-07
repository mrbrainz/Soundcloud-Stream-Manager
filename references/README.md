# Reference scripts

Working Tampermonkey userscripts (not part of SCSM itself) kept here as prior
art for the SCSM 2.0 rebuild — see [../docs/context.md](../docs/context.md).

- **[soundcloud-repost-age.user.js](soundcloud-repost-age.user.js)** (v1.3.0)
  — annotates "Reposted X ago" in the feed with the track's actual original
  post date.
- **[soundcloud-playlist-membership.user.js](soundcloud-playlist-membership.user.js)** (v1.4.0)
  — badges track titles across feed/library/search with which of your own
  playlists already contain them.

Both are current, working proof of concept for the exact problem SCSM v1
rotted on: they read `client_id` live from SoundCloud's page hydration state
(`window.__sc_hydration`) instead of hardcoding one, use `oauth_token`
cookie + `api-v2.soundcloud.com` for authenticated calls, and use DOM/
MutationObserver patterns tuned to SoundCloud's *current* markup
(`a.soundTitle__title`, the `webiIframe` standalone track/playlist page,
hidden a11y spans). Worth mining for SCSM 2.0's approach to auth and DOM
matching rather than repeating v1's `resolve.json` + hardcoded `client_id`
pattern.

- **[popup-mockup-brainrot.html](popup-mockup-brainrot.html)** — standalone
  visual mockup of a "Gen-Z brainrot" reskin of the popup UI (same six
  settings as [popup.html](../extension/popup/popup.html), styled as neon
  toggle cards with slang copy). Not wired to any extension code, just a
  design pitch — open the file directly in a browser to view it.
