# Feed Blocker

A Chrome extension that hides distracting content on YouTube (homepage feed, sidebar recommendations, optionally end-screen suggestions) and replaces the feed with a synced to-do list.

## Project structure

```
feed-blocker/
├── extension/       ← the extension (load this in Chrome, zip for store)
├── dev-assets/      ← docs, store-assets, privacy policy
├── README.md
└── .gitignore
```

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `extension` folder
5. **Pin the extension**: Click the puzzle-piece icon in the toolbar, then click the pin next to "Feed Blocker" so it appears in the toolbar
6. **Refresh YouTube**: If you had YouTube open before loading the extension, refresh the page (Cmd/Ctrl+R) for blocking to take effect

## Usage

- **Popup**: Click the extension icon to configure mode (Always / Schedule / Off), set weekday/weekend schedules, toggle end-of-video blocking, and snooze.
- **Homepage**: When blocking is active, the feed is hidden and replaced with a to-do list. Search and navigation remain fully functional.
- **Schedule**: Block during work hours (e.g., 8am–5pm on weekdays) and allow leisure browsing outside those hours.

## Publishing to Chrome Web Store

1. **Before submitting**: Replace the Buy Me a Coffee URL in `extension/popup/popup.html` with your profile link (e.g. `https://buymeacoffee.com/yourusername`).
2. **Privacy policy**: Host `dev-assets/docs/privacy.html` on your site (e.g. `https://pierredemontalte.dev/feed-blocker/privacy`) and use that URL in the store listing.
3. **Store copy**: See `dev-assets/docs/STORE_LISTING.md` for description, permissions justification, and other listing content.
4. **Testing**: Run through `dev-assets/docs/TESTING_CHECKLIST.md` before submission.
5. **Package**: Zip the `extension` folder and upload to the store.
6. **Submit**: Upload at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
