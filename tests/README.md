# Tests

The tests check the **real production build** (the static files in `out/`), served on this PC only. They never use the dev server.

## Run them

Node must be on the PATH for the window (see `dev.cmd` for how).

| Command | What it does |
|---|---|
| `npm test` | Everything, in order: the settings test, a fresh build, then the browser tests. |
| `npm run test:env` | Settings test only. It does its own build with fake values, then **deletes** that `out/`. Run it before `npm run build`. |
| `npm run build` | Builds `out/`. Fails if a page is not static, if a list-only field or a retired app ID reaches `out/`, or if the app list fails the content check (every problem is listed at once). |
| `npm run test:e2e` | Browser tests against the current `out/`. Build first. |
| `npm start` | Serves `out/` at http://127.0.0.1:3000/ to look at the build by hand. If `dev.cmd` is running, use another port: `npm start -- --port 3001`. |

First time on a machine, install the test browsers once (they go outside the project): `npx playwright install chromium webkit`. On Linux CI add `--with-deps`.

Telemetry is off in every test and build script (`NEXT_TELEMETRY_DISABLED=1`).

## No fixed waits

A browser test never waits a set time and then measures. It waits for the state it needs: `settle()` in `support/site.mjs` waits until React has started the page and nothing is still moving, and `expectLogoPx()` waits until the logo reaches its end size. The load event alone is not enough, because on a busy machine React starts the page after it. Popup tests first wait until every popup has its `data-state` (`popupsLive()` in `support/offgrid.mjs`): before that, a tap goes to the browser's own popover switch, not the page's script.

The popup's own timers (it opens 150 ms after the mouse arrives, and closes 300 ms after it leaves) are driven with Playwright's fake clock (`page.clock`), never waited for: the test freezes the page's time and moves it on with `page.clock.runFor()`.

Each page load has its own 15 s limit (set in `support/site.mjs`), shorter than any test's. A load that stalls fails on its own and names the page.

To prove a change keeps it that way, run with the page's start-up slowed down. It must stay green:

`E2E_SLOW_START_MS=150 npx playwright test tests/e2e --repeat-each=5`

## What is checked

- **Build** (`checks/build-output.spec.mjs`): every route is static (○ or ●) and every page exists; no `freeBeta`, `templatesCheckedAt`, `sold` key or retired app ID in `out/`; no outside web addresses, Google fonts, "LLC", email addresses, old-site content or Vault's retired lines ("doesn't wear the Off-grid badge", the old sync card note) in `out/`; `public/` holds only the files in `fixtures/public-allowlist.txt`.
- **HTTP** (`checks/http.spec.mjs`): every page returns 200; every old-site address (`fixtures/old-addresses.txt`) returns 404; the local server's own rules.
- **Browsers** (`e2e/`): desktop Chromium, iPhone (WebKit) and Android Chrome at 390px, then all three again with reduce-motion on.
    - Header end sizes: the docked logo is 115px (computer) / 69px (phone), 2.5× today's logo, and the docked "bengUSA.pro" lettering keeps its 2× size, 29px (computer) / 24px (phone) (spec 6.c, acceptance check 2). Home starts big, with the lettering at 61.63px at 1280px and 23.91px at 390px; with reduce-motion it starts docked and neither the logo nor the lettering ever changes size.
    - Header shrink path: scrolling Home down and back up a few px at a time, the tab's bottom edge moves exactly with the page (no jump), the logo only shrinks on the way down, and the lettering never jumps (at most 0.5px per px of scroll) and ends at its docked size. On a phone the bar stops at its 52px minimum before the logo is docked; at 2.5× the computer bar never reaches its 64px minimum (it stops at 71.5px). The test checks which of the two paths is walked.
    - The lettering through the whole shrink (spec 6.c), read at every 2px of scroll from the top of Home to docked: on a phone 390px or 430px wide it stays 24px (the build draws 23.91px) the whole way and is never bigger; on a 360px phone, too narrow for 24px at the top, it never shrinks and is never above 24px, and reaches 23.91px docked; on a computer (760px and 1280px) it only shrinks, with no bump, from 37.88px / 61.63px to 29.44px docked. The drawn sizes are in `WORD` and `WORD_PATH` in `support/site.mjs`.
    - No sideways scroll on phones, menu closed or open.
    - Footer with the Privacy link on every page; menus open, Escape closes them and puts focus back.
    - Home (`e2e/home.spec.mjs`): the hero reads "Makers of Off-grid apps." (lowercase "apps"), with "Off-grid" green and on one line at every width; the navy subline is the hero heading's next paragraph (only the hero word's hidden popup box sits between them), about 45% of the hero's size. Then, in this order with nothing in between (spec 17.a.v, acceptance check 25.a): the hero, then the "Off-grid, explained" section (its heading, the badge, and the Home legend word for word, "Each app's page lists what it connects to." included), then the app grid. That section's heading is plain (no popup word, and no popup box after it), and "Cloud-killers" appears on Home exactly once, in that section, never in the hero. The grid heading is "Meet our Off-grid apps"; the "More in the works" tile never says Off-grid. Catche, TimeTracker and Vault each wear the badge with the short form on the card.
    - Headings (`e2e/home.spec.mjs`): the hero and grid headings hold only their own words, even in their full text (`textContent`, what a crawler reads). Each popup box sits right after its heading, and no heading on Home holds a popup box, so an open box never becomes part of a heading.
    - App pages (`e2e/app-pages.spec.mjs`): each app page shows the legend with its connects box directly below, word for word. Vault's page goes legend, connects box, trust line, sync line (13.e.ii). The two lines sit under "Where your vault lives", side by side in the same size and style with no words between them, and neither is ever inside the legend or its section. "Cloud-killers" is in Vault's legend only.
    - Brand terms kept whole (`e2e/keep-whole.spec.mjs`): "Off-grid" and "Cloud-killers" never break at the hyphen on Home or any app page (the legend on Home and on each app page, the "Off-grid, explained" heading, the short line, the sync line), at 1280px and 390px and the other widths each screen type is used at. Every copy is also in no-wrap text, so it holds at any width.
    - Off-grid popup (`e2e/offgrid-popup.spec.mjs`): the approved words exactly, and a badge popup's link to its app's box (the badge in Home's "Off-grid, explained" section has no link, like the hero and heading words), checked softly so one bad popup never hides the rest; every badge keeps its words beside it with no tap: the short form, or the full legend for a badge in an "Off-grid, explained" section, whose heading is plain on every page (acceptance check 25.c); hover (computer), keyboard focus and tap open it; the mouse can move from the trigger into the box (and onto its link) and the box stays open past the 300 ms grace, and a click on a box opened by hover keeps it open (WCAG 1.4.13, on a fake clock); Esc closes it and puts focus back; a tap outside closes it; one open at a time; opening it moves nothing on the page; with reduce-motion it does not animate; with scripts off its words are in the page and the browser's own popover opens and closes it.
    - Colours (`e2e/colours.spec.mjs`, spec 6.f): no red anywhere outside the logo art (the signup button, BUWEB-107, will be the one exception: add its hook to `RED_ALLOWED`); green only on Off-grid triggers; in Home's "Off-grid, explained" section the badge is green, the heading and legend words are navy, and there is no red; an open popup is a navy box with white words.
    - The expected words and colours are in `support/words.mjs`, copied from the spec. Tests never read them from `content/`, so a content edit that drifts from the spec turns a test red. When the spec's words change, change that file in the same commit.
    - Every browser test fails if any request tries to leave the local server (it is blocked) or any JavaScript error happens. The block is a Playwright route, which makes the browser pause every request, local ones too, until it is let through. No route pattern avoids that in Playwright 1.63, so the guard stays as it is (the reason is in `support/site.mjs`).
    - The footer is checked one page per test, waiting only for the page's HTML, so a stalled file costs one page and the report names it.
    - No 404s while browsing.
- **Heading guard** (`checks/heading-guard.spec.mjs`, spec 17.b.i): a test-only build where one card has no badge shows "Meet our apps". It copies the site into `test-results/` (`support/fixture-site.mjs`), takes the badge off one card in the copy's app list (an open card, then a showcase card), builds the copy with the same build script and opens it in a browser on its own port. `src/` and `content/` are never touched. Adds about 10 seconds per case.
- **Content check** (`checks/content-check.spec.mjs`): the build's check of the app list (`src/lib/apps.js`). A test-only build with two bad apps fails once, and its one report names both. A test-only build where an Off-grid app has no connects line fails, for that reason. Same copy-and-build method as the heading guard; no browser.
- **Settings** (`env/env.test.mjs`): no `NEXT_PUBLIC_*` in the source, no `process.env` in `src/` or `content/`, and a build with fake values bakes none of them into `out/`.

## Known: the laptop stalls with too many browsers at once

Local runs use 2 workers (`playwright.config.mjs`); CI keeps Playwright's default. Seen on 2026-10-06 with 4 workers: every connection to a local server, even an idle one the tests never used, stalled for 10 to 30 seconds at a time, and several tests timed out together. With 2 the same runs were clean, and faster. If a few tests still fail at once with a page-load timeout, the laptop stalled, not the site: rerun with `npx playwright test --workers=1`. CI (Linux) is not affected.

## Known: the Windows build bug

Next 16.3.8 on **Windows** writes some page-data files under the wrong names, so the browser gets 404s for them (links still work; prefetch is lost). A Linux build is correct.

On Windows, when the build has this bug, "no 404s while browsing" is marked **expected to fail** (Playwright counts an expected failure as passed), and a second test checks that every 404 is this bug and nothing else. On Linux (CI, WSL) the first test must pass. `E2E_STRICT_404=1` makes it strict on Windows too. Never deploy a Windows build without fixing the file names.

## Ready for later tickets

`fakes/fake-mail-api.mjs` is a fake mail / list provider for BUWEB-107, 108 and 110. It records requests in memory, hides secret headers, and never sends anything. Test addresses use `@example.test`.
