# Soundcloud Stream Manager (SCSM) 2.0

A Chrome extension by [Mr Brainz](http://djbrainz.com) for pruning your SoundCloud
stream in real time — hide the noise, keep the signal.

This is a from-scratch Manifest V3 rebuild. The original SCSM was a bookmarklet
that injected a floating panel onto `soundcloud.com` (see `git log` /
[`references/`](references) for that history); it no longer worked against
SoundCloud's current frontend and has been fully replaced by the extension in
[`extension/`](extension).

## Features

Toggle any of these from the extension's popup — every setting live-applies
immediately, no page refresh needed:

- **Show repost age** — annotates "Reposted X ago" text with how old the
  track's *original* upload actually is.
- **Show playlist membership** — badges each track with which of your own
  playlists already contain it.
- **Hide tracks older than X days** — collapses any track (repost or
  original upload) past a configurable age.
- **Hide tracks longer than X minutes** — collapses anything past a
  configurable length, e.g. to skip full mixes.
- **Hide tracks already in a playlist** — collapses anything you've already
  sorted into one of your own playlists.
- **Hide tracks by genre** — collapses anything tagged with a genre on your
  hidden list; hover a genre tag on any track for a one-click "hide this
  genre" shortcut, no need to open the popup.
- **Show search links** — adds one-click search links to Deezer, Apple
  Music, Beatport, and Spotify for each track.
- **Show legacy download button** — restores a direct download link for any
  track SoundCloud itself allows downloading.

A hidden track isn't removed — it collapses to a single summary line (title
+ why it was hidden) with a "show" link that restores it on demand.

## Install (personal use)

Not published to the Chrome Web Store — load it unpacked:

1. Download the latest release from the
   [Releases tab](https://github.com/mrbrainz/Soundcloud-Stream-Manager/releases/latest)
   and unzip it.
2. Go to `chrome://extensions`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the unzipped folder.
5. Visit [soundcloud.com](https://soundcloud.com) and open the extension's
   popup from the toolbar to turn features on.

Building from a clone instead of a release zip? Select the
[`extension/`](extension) folder in step 4 instead.

See [`extension/README.md`](extension/README.md) for the extension's
internal layout, and [`docs/context.md`](docs/context.md) for the full
technical/working-context picture (architecture, terminology, the build
workflow, and the active backlog on the
[SCSM 2.0 board](https://github.com/users/mrbrainz/projects/2)).
