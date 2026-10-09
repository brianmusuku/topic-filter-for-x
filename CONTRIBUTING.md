# Contributing

Thanks for helping improve Topic Filter for X.

## Before you start

- Search existing issues before opening a new one.
- For security-sensitive problems, use the private security-reporting channel
  configured by the repository host instead of posting details publicly.
- Never commit API keys, cookies, account data, screenshots containing private
  posts, or generated browser-extension bundles.

## Local workflow

1. Load the repository as an unpacked extension in a Chromium-based browser.
2. Make a focused change.
3. Reload the extension and refresh X.
4. Exercise the affected behavior on Home, Search, Explore, or Lists as
   appropriate.
5. Run the syntax and manifest checks from the README.

## Pull requests

Please include:

- A short explanation of the user-visible change.
- The routes and browser/version you tested, when relevant.
- Any screenshots or reproduction steps needed to understand a UI change.
- Notes about changes to permissions, data handling, or TypeSafe requests.

Keep pull requests small and avoid unrelated formatting changes. Since X's DOM
is not a stable public API, explain any selector changes and include a manual
test case for them.

## Code conventions

- Use plain browser JavaScript and the existing module-by-file/IIFE style.
- Keep the extension fail-open when classification cannot complete.
- Preserve keyboard accessibility and reduced-motion behavior in the panel.
- Keep user data local except for the classification request documented in the
  README.
