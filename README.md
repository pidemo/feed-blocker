# Feed Blocker

A Chrome extension that hides distracting content on YouTube (homepage feed, sidebar recommendations, optionally end-screen suggestions) and replaces the feed with a synced to-do list.

[![Download in Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install%20Feed%20Blocker-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/feed-blocker/jmbpcjjjkehlnikobpdeegdmehghjjgb)

## Project structure

```
feed-blocker/
├── extension/       ← extension source code
├── docs/            ← privacy policy
├── README.md
├── LICENSE
└── package.json
```

## Installation

Install Feed Blocker from the Chrome Web Store:

https://chromewebstore.google.com/detail/feed-blocker/jmbpcjjjkehlnikobpdeegdmehghjjgb

## Usage

- **Popup**: Click the extension icon to configure mode (Always / Schedule / Off), set weekday/weekend schedules, toggle end-of-video blocking, and snooze.

## Support

- Questions, feedback, or bug reports: support@pierredemontalte.com

## Development

- This section is for local contributors working on the extension source.
- **Build**: `npm run build` — interactive flow: bump version, add changelog entry, create ZIP, optionally push to GitHub
- **Homepage**: When blocking is active, the feed is hidden and replaced with a to-do list. Search and navigation remain fully functional.
- **Schedule**: Block during work hours (e.g., 8am–5pm on weekdays) and allow leisure browsing outside those hours.
