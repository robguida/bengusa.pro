# ADR-0003: Hosting — static export plus a small form API on the site's own Lightsail instance

- **Status:** Accepted
- **Date:** 2026-10-05 (shape first proposed 2026-10-04; unchanged)
- **Author:** Principal architect
- **Ticket:** BUWEB-100 (built in BUWEB-104a, 105b, 106, 107)

## Context

1. The public pages need no server code.
2. The old Next.js version had a critical server-side flaw, so a Next server is exposure we do not need.
3. Rob-owned products run on AWS Lightsail. The one approved exception is Amazon SES, for contact-form mail.
4. What Rob tests on the preview must be exactly what goes live.
5. The site must load no third-party scripts and set no cookies.

## Decision

1. **Shape:**
    - **a.** `next build` with `output: 'export'` (plus `images.unoptimized: true` and `trailingSlash: true`) produces plain files.
    - **b.** One small Node form API (built-in `node:http`, plus the SES client) handles `/api/form-token`, `/api/signup`, `/api/contact`, `/api/health` and the list webhook. **The server never runs Next.js.**
2. **Host:**
    - **a.** The site's own 1 GB Lightsail instance. Apache serves the files, proxies `/api/` to the form API on 127.0.0.1, does the redirects, sets the security headers, and handles TLS with Let's Encrypt.
    - **b.** No load balancer and no CDN. Apache overwrites the client-IP header the API trusts.
    - **c.** The preview and live sites sit on the same box, as two vhosts and two API processes. The preview is password-locked and sends a noindex header.
3. **Build once:**
    - **a.** No `NEXT_PUBLIC_` variables at all; a build check enforces it.
    - **b.** Releases build from a clean commit with `npm ci`.
    - **c.** One artifact per release: site + API + a SHA-256 manifest + a build ID, shown in `version.txt` and `/api/health`.
    - **d.** Preview gets it first. Live is a switch to the same release folder, and only to the build ID that was approved.
    - **e.** Everything that differs between the two environments lives in server config: the Apache vhost and the API's env file.
4. **CSP:** static pages cannot carry per-request nonces.
    - **a.** A post-build step hashes every inline script and writes a per-page CSP meta tag (`script-src 'self'` + hashes). It fails the build on inline event handlers.
    - **b.** Apache adds only the parts a meta tag cannot carry: `frame-ancestors`, plus `object-src`, `base-uri` and `form-action`.
    - **c.** Fallback, only with written security acceptance: `script-src 'self' 'unsafe-inline'`.
5. **Secrets:**
    - **a.** Per-environment env files under `/etc/bengusa/`, root-owned and readable only by that environment's own service user. Never in git, the build or logs.
    - **b.** Each environment has its own SES key. It may send only plain (non-raw) email, only from `contact@bengusa.pro`, and only to the configured address (IAM conditions). SES stays in sandbox mode.
    - **c.** The list key is one per environment and Subscribers-only.
    - **d.** The form API refuses to start on live unless it is set to the real list service and real mail sending.
6. **Contact delivery:**
    - **a.** The destination is one server setting. While it is empty, the API answers `contact_unavailable`, and the Contact page cannot launch.
    - **b.** Everything else can be tested without a real inbox, through the SES mailbox simulator and a fake mail server.

## Alternatives considered

1. **A Next.js server (`next start` or standalone).** Rejected. It means server-side exposure for brochure pages, more memory, and per-request work that only nonce-CSP would justify.
2. **Sharing an existing small box.** Rejected. It would put the site's keys next to other apps, and leaves no room for the API.
3. **A Lightsail load balancer or CDN.** Rejected for v1: $18/mo, no host-based routing, no safety gain for one small site.
4. **A Lightsail container service.** Rejected. No lasting disk, and more moving parts than one instance.

## Consequences

1. Very little runs on the server, so a framework flaw cannot reach the public pages.
2. Rob tests the exact files that go live. Launch proof is `version.txt`, `/api/health` and the approved build ID all matching.
3. **Two-way door:** a later store phase can add a Node server beside these files.
