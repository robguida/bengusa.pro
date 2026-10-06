# Tests

The tests check the **real production build** (the static files in `out/`), served on this PC only. They never use the dev server.

## Run them

Node must be on the PATH for the window (see `dev.cmd` for how).

| Command | What it does |
|---|---|
| `npm test` | Everything, in order: the settings test, a fresh build, then the browser tests. |
| `npm run test:env` | Settings test only. It does its own build with fake values, then **deletes** that `out/`. Run it before `npm run build`. |
| `npm run build` | Builds `out/`. Fails if a page is not static, or if a list-only field or a retired app ID reaches `out/`. |
| `npm run test:e2e` | Browser tests against the current `out/`. Build first. |
| `npm start` | Serves `out/` at http://127.0.0.1:3000/ to look at the build by hand. If `dev.cmd` is running, use another port: `npm start -- --port 3001`. |

First time on a machine, install the test browsers once (they go outside the project): `npx playwright install chromium webkit`. On Linux CI add `--with-deps`.

Telemetry is off in every test and build script (`NEXT_TELEMETRY_DISABLED=1`).

## No fixed waits

A browser test never waits a set time and then measures. It waits for the state it needs: `settle()` in `support/site.mjs` waits until React has started the page and nothing is still moving, and `expectLogoPx()` waits until the logo reaches its end size. The load event alone is not enough, because on a busy machine React starts the page after it.

To prove a change keeps it that way, run with the page's start-up slowed down. It must stay green:

`E2E_SLOW_START_MS=150 npx playwright test tests/e2e --repeat-each=5`

## What is checked

- **Build** (`checks/build-output.spec.mjs`): every route is static (○ or ●) and every page exists; no `freeBeta`, `templatesCheckedAt`, `sold` key or retired app ID in `out/`; no outside web addresses, Google fonts, "LLC", email addresses or old-site content in `out/`; `public/` holds only the files in `fixtures/public-allowlist.txt`.
- **HTTP** (`checks/http.spec.mjs`): every page returns 200; every old-site address (`fixtures/old-addresses.txt`) returns 404; the local server's own rules.
- **Browsers** (`e2e/`): desktop Chromium, iPhone (WebKit) and Android Chrome at 390px, then all three again with reduce-motion on.
    - Header end sizes: docked 115px (computer) / 69px (phone); Home starts big; with reduce-motion it starts docked and never moves.
    - No sideways scroll on phones, menu closed or open.
    - Footer with the Privacy link on every page; menus open, Escape closes them and puts focus back.
    - Every browser test fails if any request tries to leave the local server (it is blocked) or any JavaScript error happens.
    - No 404s while browsing.
- **Settings** (`env/env.test.mjs`): no `NEXT_PUBLIC_*` in the source, no `process.env` in `src/` or `content/`, and a build with fake values bakes none of them into `out/`.

## Known: the Windows build bug

Next 16.3.8 on **Windows** writes some page-data files under the wrong names, so the browser gets 404s for them (links still work; prefetch is lost). A Linux build is correct.

On Windows, when the build has this bug, "no 404s while browsing" is marked **expected to fail** (Playwright counts an expected failure as passed), and a second test checks that every 404 is this bug and nothing else. On Linux (CI, WSL) the first test must pass. `E2E_STRICT_404=1` makes it strict on Windows too. Never deploy a Windows build without fixing the file names.

## Ready for later tickets

`fakes/fake-mail-api.mjs` is a fake mail / list provider for BUWEB-107, 108 and 110. It records requests in memory, hides secret headers, and never sends anything. Test addresses use `@example.test`.
