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

A browser test never waits a set time and then measures. It waits for the state it needs: `settle()` in `support/site.mjs` waits until React has started the page and nothing is still moving, and `expectLogoPx()` waits until the logo reaches its end size. The load event alone is not enough, because on a busy machine React starts the page after it. Popup tests first wait until every popup has its `data-state` (`popupsLive()` in `support/offgrid.mjs`): before that, a tap goes to the browser's own popover switch, not the page's script.

To prove a change keeps it that way, run with the page's start-up slowed down. It must stay green:

`E2E_SLOW_START_MS=150 npx playwright test tests/e2e --repeat-each=5`

## What is checked

- **Build** (`checks/build-output.spec.mjs`): every route is static (○ or ●) and every page exists; no `freeBeta`, `templatesCheckedAt`, `sold` key or retired app ID in `out/`; no outside web addresses, Google fonts, "LLC", email addresses, old-site content or Vault's retired lines ("doesn't wear the Off-grid badge", the old sync card note) in `out/`; `public/` holds only the files in `fixtures/public-allowlist.txt`.
- **HTTP** (`checks/http.spec.mjs`): every page returns 200; every old-site address (`fixtures/old-addresses.txt`) returns 404; the local server's own rules.
- **Browsers** (`e2e/`): desktop Chromium, iPhone (WebKit) and Android Chrome at 390px, then all three again with reduce-motion on.
    - Header end sizes: docked 92px (computer) / 58px (phone), 2× today's logo (spec 6.c); Home starts big; with reduce-motion it starts docked and never moves.
    - Header shrink path: scrolling Home down and back up a few px at a time, the tab's bottom edge moves exactly with the page (no jump) and the logo only shrinks on the way down. At 2× the computer bar stops at its 64px minimum before the logo is docked, and the test checks that this path is walked.
    - No sideways scroll on phones, menu closed or open.
    - Footer with the Privacy link on every page; menus open, Escape closes them and puts focus back.
    - Home (`e2e/home.spec.mjs`): the hero reads "Makers of Off-grid apps." (lowercase "apps"), with "Off-grid" green and on one line at every width; the navy subline comes next, about 45% of the hero's size; the app grid comes directly after. The grid heading is "Meet our Off-grid apps"; the "More in the works" tile never says Off-grid. Catche, TimeTracker and Vault each wear the badge with the short form on the card.
    - App pages (`e2e/app-pages.spec.mjs`): each app page shows the legend with its connects box directly below, word for word. Vault's page goes legend, connects box, sync line, trust line, and "Cloud-killers" is in its legend only.
    - Off-grid popup (`e2e/offgrid-popup.spec.mjs`): the approved words exactly, and a badge popup's link to its app's box; hover (computer), keyboard focus and tap open it; Esc closes it and puts focus back; a tap outside closes it; one open at a time; opening it moves nothing on the page; with reduce-motion it does not animate; with scripts off its words are in the page and the browser's own popover opens and closes it.
    - Colours (`e2e/colours.spec.mjs`, spec 6.f): no red anywhere outside the logo art (the signup button, BUWEB-107, will be the one exception: add its hook to `RED_ALLOWED`); green only on Off-grid triggers; an open popup is a navy box with white words.
    - The expected words and colours are in `support/words.mjs`, copied from the spec. Tests never read them from `content/`, so a content edit that drifts from the spec turns a test red. When the spec's words change, change that file in the same commit.
    - Every browser test fails if any request tries to leave the local server (it is blocked) or any JavaScript error happens.
    - No 404s while browsing.
- **Heading guard** (`checks/heading-guard.spec.mjs`, spec 17.b.i): a test-only build where one card has no badge shows "Meet our apps". It copies the site into `test-results/`, takes the badge off one card in the copy's app list (an open card, then a showcase card), builds the copy with the same build script and opens it in a browser on its own port. `src/` and `content/` are never touched. Adds about 10 seconds per case.
- **Settings** (`env/env.test.mjs`): no `NEXT_PUBLIC_*` in the source, no `process.env` in `src/` or `content/`, and a build with fake values bakes none of them into `out/`.

## Known: several tests time out together on the laptop

If a few tests fail at once with `page.goto: Test timeout of 30000ms exceeded`, the laptop stalled, not the site. Seen on 2026-10-06 with 4 workers: every connection to a local server, even an idle one the tests never used, stalled for 10 to 30 seconds at a time. With `--workers=2` the same runs were clean, and faster. Rerun with `npx playwright test --workers=2`. CI (Linux) is not affected.

## Known: the Windows build bug

Next 16.3.8 on **Windows** writes some page-data files under the wrong names, so the browser gets 404s for them (links still work; prefetch is lost). A Linux build is correct.

On Windows, when the build has this bug, "no 404s while browsing" is marked **expected to fail** (Playwright counts an expected failure as passed), and a second test checks that every 404 is this bug and nothing else. On Linux (CI, WSL) the first test must pass. `E2E_STRICT_404=1` makes it strict on Windows too. Never deploy a Windows build without fixing the file names.

## Ready for later tickets

`fakes/fake-mail-api.mjs` is a fake mail / list provider for BUWEB-107, 108 and 110. It records requests in memory, hides secret headers, and never sends anything. Test addresses use `@example.test`.
