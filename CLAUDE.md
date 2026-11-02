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
- **`./src` is the root of the project. Always, in every Rob project** (Rob, 2026-11-02). **Only `./src` makes it to production.** Other folders stay in the repo for the next programmer. The top folder holds only project folders that are not code: `.github/` (GitHub only reads it there), `docs/`, `README.md`, `CLAUDE.md`, `.gitignore`. Anything that gets installed or runs code lives in `./src`: `package.json`, the lock file, `node_modules`, every tool's settings file, `public/`, `content/`, `scripts/`, `tests/`, `dev.cmd`, `preview.cmd`.
    - ⛔ Never say a tool "must" sit at the top. Next.js, npm, ESLint, Playwright and PostCSS want their settings beside `package.json`, wherever it is.
    - **The move is done (BUWEB-118, merged into `develop` 2026-11-02).** It must reach `main` before the next live deploy; until then the deploy refuses to run.

## Git

- **`origin` = `git@github.com:robguida/bengusa.pro.git`** — private repo at https://github.com/robguida/bengusa.pro. Moved from Bitbucket on 2026-10-04 (Rob's decision).
- **Branches:** `develop` (**default**), `main`, and `maintaitenance` (spelled that way). All three track `origin`. GitHub deletes a PR's branch automatically once it is merged.
- A repo-local `core.sshCommand` makes git use the `robguida` GitHub key. Do not change it.
- **`bitbucket` remote:** the old Bitbucket repo, kept as a record only. It has never been fetched, so nobody knows yet whether it is newer than this copy.
- **Old branch refs `BUWEB-13`, `BUWEB-3` and `feature/BUWEB-4` exist only on this machine.** They were not pushed.
    - ⛔ **`feature/BUWEB-4` holds real people's personal details** (Digital Silk executives). Never merge, reuse or push it.

## Stack

*Layout below is the BUWEB-118 layout (everything under `src/`). Versions come from `src/package.json`.*

- **Next.js 16.4.2** (App Router), **React 19.2.8**. JavaScript, not TypeScript (`src/jsconfig.json`).
- **Static export.** `output: 'export'` in `src/next.config.mjs`. The build writes plain files to `out/`. No Node server runs in production.
- **Tailwind CSS 4.3.3** via `@tailwindcss/postcss`. Theme colors and fonts live in `src/app/globals.css`. There is no `tailwind.config.js`.
- **Fonts:** Lexend and Oswald, kept as local files in `src/app/fonts/` (licence texts beside them). `src/app/layout.js` loads them with `next/font/local`. `README.md` has no "Add New FONT" section any more.
- **Icons:** `@heroicons/react`. **Lint:** ESLint 9 flat config (`src/eslint.config.mjs`). **Tests:** Playwright 1.63.0 plus a Node settings test.
- **Path alias:** `@/*` → `./*`, relative to `src/`.
- **Node 24 (LTS).** `src/.nvmrc` names the exact version.

## Run it locally

Node is not on the system PATH. **Double-click `src\dev.cmd`.** It opens a console window and starts the dev server. Then open http://localhost:3000. Close the window to stop it.

To look at the real build, **double-click `src\preview.cmd`** the same way.

`dev.cmd` and `preview.cmd` are local helpers, not in the repo.

**Run every npm command from `src/`.** All of these are in `src/package.json`:

- `npm run dev` — dev server.
- `npm run build` — the guarded build (`scripts/build.mjs`). Never run `next build` on its own; it skips the checks.
- `npm start` — serves `out/` (`scripts/serve-out.mjs`). Build first. `next start` does not work with a static export.
- `npm run lint` — ESLint.
- `npm test` — settings test, fresh build, then the browser tests.
- Install with `npm ci`, not `npm install`.

## Source layout

Everything below is inside `src/`. The repo top holds only `.github/`, `docs/`, `README.md` and `.gitignore` (plus this `CLAUDE.md`).

- `package.json`, `package-lock.json`, `.nvmrc`, `.env.template`, `next.config.mjs`, `eslint.config.mjs`, `jsconfig.json`, `postcss.config.mjs`, `playwright.config.mjs` — project root and tool settings.
- `app/layout.js` — root layout: fonts, header, footer.
- `app/page.js` — home page. Other live pages: `app/about/`, `app/privacy/`, plus `app/not-found.js`.
- `app/_parked/` — pages built but not live yet: `apps/[slug]/` and `contact/`.
- `app/components/` — shared components: AppCard, AppName, KeepWhole, OffGridBadge, OffGridHeading, OffGridLegend, OffGridTip, PageIntro, SiteFooter, and `header/` (LogoMark, SiteHeader, Wordmark).
- `lib/` — helpers: `apps.js`, `content.js`, `site.js`, `site-settings.mjs`.
- `content/` — the app list and the site words. App names come from here, not from page code.
- `public/` — images and the favicon. Only files on the test allow-list may be here.
- `scripts/` — the guarded build, the static server, the release gate and the deploy script.
- `tests/` — the test suite.
- `docs/` (repo top, not in `src/`) — project docs. `docs/requirements.md` is the v1 spec. `docs/assets/header-shape.png` is Rob's header sketch.

## Config and secrets

- No environment variables are needed yet. `src/.env.template` is the template. Real values go in `src/.env.local`.
- `.gitignore` now covers every `.env*` file except `.env.template`, so `.env.local` is ignored.
- The lock file `src/package-lock.json` is tracked in git now.
- `NEXT_PUBLIC_*` values are baked into the browser bundle at build time. Never put a secret in one. Changing one needs a rebuild.
- The old maintenance-mode switch (`NEXT_PUBLIC_MAINTENANCE_MODE`) is gone.

---
Last updated 2026-11-02.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `src/node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `src/node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
