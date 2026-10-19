# ADR-0001: Rebuild the site in place

- **Status:** Accepted
- **Date:** 2026-10-05 (first proposed 2026-10-04)
- **Author:** Principal architect
- **Ticket:** BUWEB-100 (carried out in BUWEB-104a)

## Context

The existing code came from an outside developer. It is about 2,300 lines. About 1,280 of them are a home page built from another company's text and other brands' logos. v1 replaces about 90% of the content and redesigns every page: a new header, footer, menu and contact form. Nothing live runs this code. Next.js 15.3.1 also carries a critical server-side flaw, so the framework has to be upgraded anyway.

## Decision

Rebuild in place: the same repository, with a fresh app on an upgraded framework.

1. **Keep only:**
    - **a.** The Next.js + Tailwind v4 setup (upgraded to next 16.3.8, react 19.2.8, tailwind 4.3.3).
    - **b.** The `:root` colour tokens in `globals.css`.
    - **c.** The `next/font` setup, trimmed to the weights in use.
    - **d.** The logo SVGs and `favicon.ico`.
    - **e.** The config files (`jsconfig.json`, ESLint, PostCSS).
2. **Delete everything else in one sweep:**
    - **a.** All old pages, components and images.
    - **b.** `tailwind.config.js` (Tailwind v4 never loaded it).
    - **c.** The maintenance-mode switch and its `NEXT_PUBLIC_` variable.
3. **Copy in only named files.** Never copy the old `public/` folder in bulk.
4. **Housekeeping in the same ticket:**
    - **a.** Commit `package-lock.json`.
    - **b.** Ignore every `.env*` file except `.env.template`.
    - **c.** Turn on static export (see ADR-0003).

## Alternatives considered

1. **Reuse and edit the old pages.** Rejected. Almost every line is replaced anyway, and every kept file has to be reviewed as if it were new. Hidden dead code (unused menu copies, a debug log, an animation that is never defined) makes it slower than starting clean.
2. **A brand-new repository.** Rejected. It loses the history and the remote setup for no gain.

## Consequences

1. Borrowed text and logos leave by deletion. A launch check compares `public/` against an allow-list.
2. The upgrade is cheap now, on an empty shell, and would be rework once pages exist.
3. **Two-way door:** the old code stays in git history.
