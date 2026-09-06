# SCSM 2.0 — Chrome Extension

Manifest V3 Chrome Extension rebuild of Soundcloud Stream Manager, replacing
the old on-page bookmarklet panel with a popup-driven control panel. See
[../docs/context.md](../docs/context.md) for background, and the
[SCSM 2.0 board](https://github.com/users/mrbrainz/projects/2) for the
build plan.

Personal use only for now — not published to the Chrome Web Store.

## Load it unpacked

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `extension/` folder.
4. Visit [soundcloud.com](https://soundcloud.com) and open the extension's
   popup from the toolbar.

## Layout

- `manifest.json` — extension manifest (permissions, content script matches).
- `popup/` — the toolbar popup (feature toggles + thresholds).
- `content/` — content script injected into soundcloud.com pages.
- `lib/` — shared code used by both the content script and popup (settings
  schema, auth/API helpers, DOM-matching layer).
- `icons/` — toolbar/store icons (currently plain placeholders).
