# bengusa.pro

The public website for **bengUSA.pro**, a RandBMedia brand. Its job is to sell the brand's apps. Version 1 launches as a waitlist, with an email list and a Contact page. The store comes later.

bengUSA.pro is a brand name, not a company. The site never says "LLC", "Inc." or "company".

## What it is built with

- **Next.js 16** (App Router), built as a **static export** (`output: 'export'` in `next.config.mjs`). The build writes plain files to `out/`. No Node server runs in production.
- **React 19**, in JavaScript, not TypeScript. The path alias `@/*` points to `src/*` (`jsconfig.json`).
- **Tailwind CSS 4**, through `@tailwindcss/postcss`. Theme colours and fonts are set in `src/app/globals.css`.
- **Two brand fonts, Lexend and Oswald.** The font files and their licence texts (SIL Open Font License) are in `src/app/fonts/`. `src/app/layout.js` loads them with `next/font/local`.
- **Playwright** for the browser tests, and **ESLint 9** for lint.
- **Hosting:** the site's own small AWS Lightsail server, which serves the files in `out/`.

## Before you start

- **Node 24 (LTS).** `.nvmrc` names the exact version.
- Install packages with `npm ci`, not `npm install`, so `package-lock.json` decides every version.
- First time on a machine, install the test browsers once: `npx playwright install chromium webkit`.
- If Node is not on your system PATH, add it for the console window first. `scripts/release/gate.cmd` shows how.

## Run it

| Task | Command | What it does |
|---|---|---|
| Work on the site | Double-click `dev.cmd`, then open http://localhost:3000 | Starts the dev server on this PC only. Close the window to stop it. |
| Run every test | `npm test` | Runs the settings test, a fresh build, then the browser tests. |
| Build | `npm run build` | The guarded build. It writes `out/`, then fails if a page is not static, a page is missing, or a field that must stay private reaches `out/`. |
| Look at the build | `npm start` | Serves `out/` at http://127.0.0.1:3000/, the way the real web server does. Build first. |
| Lint | `npm run lint` | Runs ESLint over the whole project. |

- **Never run `next build` on its own.** It skips the checks. Always build with `npm run build`.
- **`next start` does not work** with a static export. `npm start` runs `scripts/serve-out.mjs` instead.
- **`dev.cmd` is a local helper, not part of the repo** (git ignores it). It adds Node to the PATH for its window, then runs `npm run dev -- -H 127.0.0.1`. Without it, run that command in a window that has Node on the PATH.
- If the dev server is running, give `npm start` another port: `npm start -- --port 3001`.

## Where things live

| Path | What it holds |
|---|---|
| `src/app/` | The pages, the root layout and the shared components. |
| `src/app/fonts/` | The two font files and their licence texts. |
| `content/` | The app list (`apps.json`), the permanent app ID list (`app-ids.ledger`) and the site words. App names come from here, not from page code. |
| `public/` | Images and the favicon. Only files on the test allow-list (`tests/fixtures/public-allowlist.txt`) may be here. |
| `tests/` | The test suite. How to run it and what it checks: [`tests/README.md`](tests/README.md). |
| `scripts/` | The guarded build, the static server, the local release gate and the deploy script. |
| `docs/` | The version 1 spec, [`docs/requirements.md`](docs/requirements.md), and the decision records in [`docs/adr/`](docs/adr/). Read the spec before any product work. |

## Checks and releases

- **CI** (`.github/workflows/ci.yml`) runs lint, the full test suite against the production build, and the dependency audits on every push. It never deploys.
- **The local release gate** (double-click `scripts/release/gate.cmd`) runs the same checks, in the same order, on a fresh copy of the last commit.
- **Deploys run from the laptop** with `scripts/deploy/deploy.mjs`: preview first, then live, with the same tested build. Live accepts only a commit that is on `main`.
- **Windows build bug:** Next 16.3.8 on Windows writes some page-data files in `out/` under the wrong names. A Linux build is correct. Never deploy a Windows build as it is. Details: [`tests/README.md`](tests/README.md).

## Settings and secrets

- No environment variables are needed yet. `.env.template` is the template. Real values go in `.env.local`, which git ignores.
- `NEXT_PUBLIC_*` values are baked into the browser files at build time. Never put a secret in one.
- Telemetry is off in every build and test script.

## Branches

- `develop` is the default branch. New work branches from it.
- `main` is what goes live.
