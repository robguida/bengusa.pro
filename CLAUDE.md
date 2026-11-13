# bengusa.pro — Project notes

## What this is

The public website for **bengUSA.pro**, a RandBMedia brand (RandBMedia is Rob's own company with his wife — not client work). Its job is to sell the brand's apps. **Version 1 is a full redesign that launches as a waitlist** (plus an email list and a Contact page). The store comes later. **The v1 spec is `docs/requirements.md`. Read it before any product work.**

The first code was built by an outside developer (Fojle Rabbi). It is being replaced. **The new site is not live yet: it is deployed only after Rob has reviewed it** (Rob, 2026-11-02). Spec section 9 records what was there at the start.

## Rules for this project

- **Known context:** The LLC was dissolved 2026-08-12. The site uses the brand name only. Any legal-identity line gets a legal review of its wording first.
- **Not UCCS.** UCCS rules (standard AWS, client-data handling) do not apply.
- **Hosting: AWS Lightsail.** Not EC2, ALB or Route53. Load balancer, DNS and certs live in the Lightsail console. The README's "Deploy on Vercel" section does not apply.
    - **One approved exception:** Amazon SES (standard AWS) sends the contact-form mail. Rob let this default stand on 2026-10-05 (spec decision 12.b.iii).
- **Requirements change → the docs writer updates `docs/requirements.md`.**
- **Team agent names are allowed in this repo** (Rob, 2026-11-02: *"it is OK to have the agent names in this repo"*). The usual no-names rule for project repos does not apply here. Commits, comments and docs may name agents.
- **`./src` is the site. Only `./src` makes it to production** (its built pages, `src/out/`). It holds the site's `package.json`, lock file, `node_modules`, the site tools' settings files, `app/`, `lib/`, `content/`, `public/`, `dev.cmd` and `preview.cmd`.
    - **`tests/` and `scripts/` sit beside `src/` at the repo top, by Rob's word (2026-11-02):** they never go to production. `tests/` has its own small install (Playwright only, `tests/package.json`). `scripts/` uses Node built-ins only and has no install. There is no `package.json` or `node_modules` at the repo top.
    - The repo top also holds `.github/` (GitHub only reads it there), `docs/`, `README.md`, `CLAUDE.md` and `.gitignore`.
    - ⛔ Never say a tool "must" sit at the top. Next.js, npm, ESLint and PostCSS want their settings beside `package.json`, wherever it is.
    - **History:** BUWEB-118 moved everything into `src/`; BUWEB-120 moved `tests/` and `scripts/` back out beside it. A live deploy takes only a commit that is on `main`.

## Git

- **`origin` = `git@github.com:robguida/bengusa.pro.git`** — private repo at https://github.com/robguida/bengusa.pro. Moved from Bitbucket on 2026-10-04 (Rob's decision).
- **Branches:** `develop` (**default**), `main`, and `maintaitenance` (spelled that way). All three track `origin`. GitHub deletes a PR's branch automatically once it is merged.
- A repo-local `core.sshCommand` makes git use the `robguida` GitHub key. Do not change it.
- **`bitbucket` remote:** the old Bitbucket repo, kept as a record only. It has never been fetched, so nobody knows yet whether it is newer than this copy.
- **Old branch refs `BUWEB-13`, `BUWEB-3` and `feature/BUWEB-4` exist only on this machine.** They were not pushed.
    - ⛔ **`feature/BUWEB-4` holds real people's personal details** (Digital Silk executives). Never merge, reuse or push it.

## Stack

*Layout below is the BUWEB-120 layout (the site in `src/`, `tests/` and `scripts/` beside it). Versions come from `src/package.json` and `tests/package.json`.*

- **Next.js 16.4.2** (App Router), **React 19.2.8**. JavaScript, not TypeScript (`src/jsconfig.json`).
- **Static export.** `output: 'export'` in `src/next.config.mjs`. The build writes plain files to `out/`. No Node server runs in production.
- **Tailwind CSS 4.3.3** via `@tailwindcss/postcss`. Theme colors and fonts live in `src/app/globals.css`. There is no `tailwind.config.js`.
- **Fonts:** Lexend and Oswald, kept as local files in `src/app/fonts/` (licence texts beside them). `src/app/layout.js` loads them with `next/font/local`. `README.md` has no "Add New FONT" section any more.
- **Icons:** `@heroicons/react`. **Lint:** ESLint 9 flat config (`src/eslint.config.mjs`; it lints `src/`, `scripts/` and `tests/`). **Tests:** Playwright 1.63.0 (`tests/package.json`) plus a Node settings test.
- **Path alias:** `@/*` → `./*`, relative to `src/`.
- **Node 24 (LTS).** `src/.nvmrc` names the exact version.

## Run it locally

Node is not on the system PATH. **Double-click `src\dev.cmd`.** It opens a console window and starts the dev server. Then open http://localhost:3000. Close the window to stop it.

To look at the real build, **double-click `src\preview.cmd`** the same way.

`dev.cmd` and `preview.cmd` are local helpers, not in the repo.

**Site commands run from `src/`** (in `src/package.json`):

- `npm run dev` — dev server.
- `npm run build` — the guarded build (`../scripts/build.mjs`). Never run `next build` on its own; it skips the checks.
- `npm start` — serves `src/out/` (`../scripts/serve-out.mjs`). Build first. `next start` does not work with a static export.
- `npm run lint` — ESLint over `src/`, `scripts/` and `tests/`.

**Easiest: double-click `tests\run-tests.cmd`.** It runs the full suite on the files as they are now, and installs what it needs on first run. `scripts\release\gate.cmd` is the stricter check of the last commit in a clean copy.

**Test commands run from `tests/`** (in `tests/package.json`):

- `npm test` — settings test, fresh build, then the browser tests.
- `npm run test:env` / `npm run test:e2e` — one part only.

Install with `npm ci`, not `npm install`: once in `src/`, once in `tests/`.

## Source layout

The repo top holds `src/`, `tests/`, `scripts/`, `docs/`, `.github/`, `README.md`, `.gitignore` and this `CLAUDE.md`.

Inside `src/` (the site):

- `package.json`, `package-lock.json`, `.nvmrc`, `.env.template`, `next.config.mjs`, `eslint.config.mjs`, `jsconfig.json`, `postcss.config.mjs` — the site's install and tool settings.
- `app/layout.js` — root layout: fonts, header, footer.
- `app/page.js` — **Home, one of two live pages** (Home and Privacy; one-page site since 2026-11-02, Privacy back on 2026-11-06): hero, "Apps coming soon!" with the Our U.S. Debt block under it (lead-in, h3, one paragraph, link to https://bengusa.pro/ourusdebt/ that opens in a new tab (`target="_blank"`, `rel="noopener"`); words in `content/site-words.json` under `usDebtPromo`; BUWEB-128), then the About body (`components/AboutBody.js`) under an "About Us" h2. `app/not-found.js` is the 404 page: it sends every other address to Home with a meta refresh (0 s), with a "Go to the home page" link as fallback.
- `app/privacy/` — the Privacy page, **live** since 2026-11-06 (BUWEB-125), linked in the footer.
- `app/_parked/` — pages built but not live yet: `apps/[slug]/`, `contact/` and `about/`. Switches: `showApps`, `showContact` and `showUsDebtPromo` (the Our U.S. Debt block; true; ships only after bengusa.pro/ourusdebt/ is live and Rob says go) are in `content/site-settings.json`; `SHOW_ABOUT` and `SHOW_PRIVACY` are constants in `src/lib/site.js` (`SHOW_ABOUT` false, `SHOW_PRIVACY` true). To bring a parked page back, turn its switch on AND move its folder out of `_parked/`.
- Hidden on Home by a setting, words kept: `showOwnWords` in `content/about-words.json` (the founders' "In ... own words" blocks) and `showOffGridExplained` in `content/site-words.json` (the "Off-grid, explained" section).
- `app/components/` — shared components: AboutBody, AppCard, AppName, KeepWhole, OffGridBadge, OffGridHeading, OffGridLegend, OffGridTip, PageIntro, SiteFooter, and `header/` (LogoMark, SiteHeader, Wordmark).
- `lib/` — helpers: `apps.js`, `content.js`, `site.js`, `site-settings.mjs`.
- `content/` — the app list and the site words. App names come from here, not from page code.
- `public/` — images and the favicon. Only files on `tests/fixtures/public-allowlist.txt` may be here.

Beside `src/`:

- `tests/` — the test suite, with its own `package.json`, lock file and `playwright.config.mjs`. Its throwaway site copies go in `src/.fixture-sites/` (git-ignored).
- `scripts/` — the guarded build, the static server, the release gate, packaging and the deploy script. Node built-ins only.
- `docs/` — project docs. `docs/requirements.md` is the v1 spec. `docs/assets/header-shape.png` is Rob's header sketch.

## Config and secrets

- No environment variables are needed yet. `src/.env.template` is the template. Real values go in `src/.env.local`.
- `.gitignore` now covers every `.env*` file except `.env.template`, so `.env.local` is ignored.
- Both lock files, `src/package-lock.json` and `tests/package-lock.json`, are tracked in git.
- `NEXT_PUBLIC_*` values are baked into the browser bundle at build time. Never put a secret in one. Changing one needs a rebuild.
- The old maintenance-mode switch (`NEXT_PUBLIC_MAINTENANCE_MODE`) is gone.

---
Last updated 2026-11-13 (BUWEB-128: Our U.S. Debt block on Home, switch `showUsDebtPromo`, link to bengusa.pro/ourusdebt/ in a new tab, see spec 19.n).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `src/node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `src/node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
