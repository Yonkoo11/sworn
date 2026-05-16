# Sworn browser extension

Highlights `sworn://r/<chatId>` URLs on every webpage and adds a one-click
verify badge. The extension never performs verification itself; it routes
to the public verifier at <https://yonkoo11.github.io/sworn/>.

## Install (developer mode)

**Chrome / Brave / Edge:**

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked**, point at this directory.
4. Pin the extension to the toolbar.

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**, select `manifest.json`.

## What you get

- Every page that mentions `sworn://r/<chatId>` shows a teal pill next to
  the URL. Clicking it opens the verifier with the chatId pre-loaded.
- The popup (toolbar icon) lets you paste any chatId or `sworn://r/…` URL
  and open the verifier in a new tab.
- No tracking. The extension touches no network beyond the public verifier
  and 0G Galileo explorer URLs (`host_permissions` lists exactly those).

## Files

```
manifest.json   — manifest v3
content.js      — DOM walker + badge injector
content.css     — badge styles
popup.html      — toolbar UI
popup.js        — chatId → verifier-page redirect
popup.css       — shared styles
options.html    — settings page (V1: read-only info)
icons/          — SVG icons
```

## License

MIT.
