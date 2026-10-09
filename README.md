# Topic Filter for X

Topic Filter for X is a browser extension that hides posts outside the topics
you choose. It runs on X timelines, Search, Explore, and Lists, and uses
TypeSafe's Jev model to score each post against your topics.

This is an unpacked Manifest V3 extension. There is no build step and no
runtime dependency to install.

## Features

- Add one or more topics and keep posts matching any of them.
- Adjust match strength without sending new requests for already-scored posts.
- Classify post text, quoted posts, and image alt text.
- Cache scores for the current page session and limit requests to three at a time.
- Fail open when the API is unavailable, so an outage does not permanently hide
  your timeline.
- Match X's Light, Dim, and Lights out themes.
- Keep profiles, individual posts, notifications, and messages untouched.

## Requirements

- A Chromium-based browser with support for Manifest V3, such as Chrome, Edge,
  Brave, or Arc.
- A TypeSafe API key. Create one at
  <https://console.typesafe.ai/keys>.
- Access to `x.com` or `twitter.com`.

## Install for local use

1. Download or clone this repository.
2. Open your browser's extensions page (`chrome://extensions` in Chrome).
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository directory—the directory
   containing `manifest.json`.
5. Open or refresh X. The **Topic filter** card appears in the right sidebar,
   below the search box.
6. Add your TypeSafe API key, add at least one topic, and enable the filter.

When source files change, return to the extensions page and click the
extension's reload button, then refresh the X tab.

## Usage

Topics work best when they describe a concrete subject. For example,
`Formula 1 race results` is more precise than `sports`. A post is shown when
at least one topic reaches the selected match strength.

The **Match strength** slider controls the minimum Jev probability. Lower
values show more borderline matches; higher values are stricter. Because raw
scores are cached, moving the slider does not make another API request.

Turn the switch off to restore the normal timeline. The chevron collapses the
settings card.

The card keeps two counters. The line under the title shows how many posts were
filtered **this session** (since the browser started). The line at the bottom of
the settings shows how many were filtered **all time**. A post is counted once
per session no matter how often it scrolls back into view, and the all-time
total adds up each session's count. All X tabs count into the same numbers; a
background tab shows the latest values the next time it filters a post.

## Privacy and cost

The extension sends the text of posts it classifies to TypeSafe, together with
the author's handle and available image alt text. The TypeSafe API key is
stored in `chrome.storage.local` for this browser and is used by the extension
service worker; it is not placed in the X page. Review TypeSafe's policies
before using the extension with sensitive content.

The all-time counter is a single number saved in `chrome.storage.local`; the
session counter lives in `chrome.storage.session`. Neither is sent anywhere.

There is no analytics or telemetry code in this repository. Classification
requests are made for new readable posts while filtering is active. A narrow
filter can cause X to load more posts, which can increase API usage. Bare
image/video posts without text are hidden by default because they cannot be
reliably judged; set `SHOW_UNREADABLE` to `true` in `content/filter.js` if you
prefer to keep them visible.

## How it works

```text
X timeline
    │
    ▼
content/filter.js ── extracts post data, queues work, applies visibility
    │
    ▼
background.js ───── sends one Jev question per topic to TypeSafe
    │
    ▼
cached scores ────── reused when the threshold changes
```

| File                   | Purpose                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manifest.json`        | Manifest V3 permissions, service worker, content scripts, and icons.                                                                             |
| `background.js`        | Calls TypeSafe's `POST /v1/systemone` endpoint, keeps the API key out of the page context, and keeps the session and all-time filtered counters. |
| `content/filter.js`    | Extracts posts, manages the request queue/cache, and hides or reveals timeline cells.                                                            |
| `content/panel.js`     | Renders the settings card in a shadow DOM.                                                                                                       |
| `content/placement.js` | Places the card below X's search box.                                                                                                            |
| `content/store.js`     | Persists settings and synchronizes them across tabs.                                                                                             |
| `content/theme.js`     | Detects X's theme, accent color, and font.                                                                                                       |
| `content/main.js`      | Starts the panel, placement, and filtering lifecycle.                                                                                            |
| `icons/`               | Extension icons used by the browser.                                                                                                             |

The model question wording is defined in `buildQuestions()` in
`background.js`. X changes its markup periodically; the extension currently
relies on selectors including `sidebarColumn`, `cellInnerDiv`, `tweet`,
`tweetText`, `SearchBox_Search_Input`, and `SideNav_NewTweet_Button`.

## Development

There is no compilation step. Edit the JavaScript files, reload the extension
from the browser's extensions page, and refresh X.

Before opening a pull request, run the lightweight checks below from the
repository root:

```sh
python3 -m json.tool manifest.json >/dev/null
node --check background.js
for file in content/*.js; do node --check "$file"; done
```

Manual testing should cover enabling/disabling the filter, adding and removing
topics, changing the threshold, switching X themes, navigating between
supported routes, and handling an invalid or unavailable API key.

## Contributing

Bug reports and pull requests are welcome. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before making changes. Keep changes
focused, avoid introducing a build dependency unless it solves a clear
maintenance problem, and do not commit API keys or other private data.

For security-sensitive reports, do not include exploitable details in a public
issue. Contact the repository maintainer through the private security channel
configured for the hosting platform.

## Disclaimer

This project is an independent community extension and is not affiliated with,
endorsed by, or sponsored by X Corp., Twitter, or TypeSafe. X's interface and
markup can change without notice.

## License

Released under the [MIT License](LICENSE).
