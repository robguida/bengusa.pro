# ADR-0002: Signup list — one hosted list, Buttondown, server-owned fields

- **Status:** Accepted
- **Date:** 2026-10-05 (updated the same day after the security and privacy reviews, and again for the welcome email and fixed tag IDs)
- **Amended by:** ADR-0004 (adding an app), 2026-10-05. Decision 1 and 1.e below carry the change.
- **Supersedes:** the 2026-10-04 draft recommendation (self-hosted listmonk sending through Amazon SES)
- **Author:** Principal architect
- **Ticket:** BUWEB-100 (built in BUWEB-107b)

## Context

1. **What v1 collects:** a waitlist for three apps (Catche, TimeTracker, Vault) and a general news list.
2. **What must hold:**
    - **a.** Provable consent, through double opt-in.
    - **b.** A fair early-bird order: one first-join date per app, and the join date is the confirm date.
    - **c.** Add-only picks.
    - **d.** One unsubscribe that stops everything.
    - **e.** No tracking pixels, to keep the site's Off-grid promise.
3. **The owner's ruling:** the list lives at a hosted list service with tracking off. That removes a database from our server and keeps public email sending off our own account.

## Decision

1. **One list, one record per email** (trimmed and lowercased). Picks are tags: `news`, plus one tag per app ID in the app ledger (ADR-0004; at launch `catche`, `timetracker`, `vault`). They are stored as provider metadata fields that only our form API writes:
    - **a.** For each tag: first asked for, consent version shown, and join date. Each is set once.
    - **b.** For the person: a random waitlist ID, the first and latest consent (time + version), the first confirm time, the source page, the last confirm-email time, and the times of the last three confirm emails.
    - **c.** Join dates are never overwritten by any request, re-signup, re-confirm or unsubscribe.
    - **d.** A pick the person was never shown in a confirm email they clicked is marked "unverified" (its join date equals its request time). Unverified picks are counted apart from picks confirmed by email.
    - **e.** **Each tag is a fixed ID that never changes.** Renaming an app (Catche and Vault both carry working names) changes only the name people see, in the site's app list and the email wording. No app name is stored on a record. So every join date survives a rename. An ID is never reused for another app. New app IDs join through ADR-0004; the list of IDs only ever grows.
2. **Provider: Buttondown.**
    - **a.** **How a signup flows:**
        - **i.** Our server creates a waiting record.
        - **ii.** Buttondown sends its built-in confirmation email.
        - **iii.** A signed `subscriber.confirmed` webhook tells our server to write the join dates.
        - **iv.** Unsubscribe is Buttondown's one-click link and RFC 8058 headers.
        - **v.** Our server only ever creates waiting (unconfirmed) records and has no delete call. Deletes happen only through admin scripts run from the owner's machine.
        - **vi.** At most three confirm emails go to one address in any 30 days.
        - **vii.** The confirm email's "Not you? Remove this address" link unsubscribes the address. It does not delete it at click time.
    - **b.** **Settings:**
        - **i.** Tracking is off account-wide.
        - **ii.** Private mode is on, so there are no public sign-ups that bypass our server.
        - **iii.** The archive is private.
        - **iv.** The server's key is Subscribers-only.
        - **v.** Two-step login is required.
        - **vi.** No visitor IP is sent to Buttondown.
        - **vii.** **Welcome email: off by default.** It is turned on only if the pre-build check passes, with approved wording, and only if it needs no more expensive plan than the confirm email does. When on, it is sent only when a person confirms. A restore or import never sends it.
        - **viii.** Every list email's footer says, in effect, "Didn't sign up for this? Unsubscribe below." So the first email after a person confirms always carries it, with or without a welcome email.
3. **Fallback: Mailcoach Cloud** (EU), behind the same five-call provider seam. It is used only if Buttondown fails the pre-build checks, limits the account, or changes its terms.
4. Contact messages are not part of the list. See ADR-0003.
5. **How long records are kept** (privacy ruling, 2026-10-05). A monthly admin run deletes:
    - **a.** Never-confirmed waiting records, 30 days after their last confirm email.
    - **b.** Never-confirmed records that were removed ("Not you", unsubscribe, bounce), 90 days after removal. 30 days if the provider's link acts the moment it is opened.
    - **c.** Confirmed-then-unsubscribed records, 3 years after the unsubscribe date. Until then they are kept only to honour the opt-out, prove consent and give a returning person their place back. They are never emailed or counted.
    - **d.** A deletion request removes a record at once.
    - **e.** The same run saves an export into the owner's encrypted vault and keeps only the latest 3. A restore never re-subscribes or re-adds anyone.

## Criteria and why Buttondown

**Hard criteria:**
1. A data agreement, a sub-processor list and a transfer basis.
2. Delete a person through the API.
3. Built-in double opt-in and a do-not-mail list.
4. Open and click tracking off for the whole account.
5. RFC 8058 one-click unsubscribe.
6. Custom fields we write, plus a full export with dates and consent.
7. A narrow API key and two-step login.
8. No ads in our emails.
9. No annual contract.
10. A free plan that fits a launch waitlist.

**How Buttondown scores:**
- It meets 1–7 and 9.
- It half-meets 8: no ads, but a small "Buttondown" footer mention until its top plan.
- It half-meets 10: free up to 100 confirmed subscribers, then $9/mo.

**Rivals with bigger free plans failed a privacy-critical criterion:**
- **Brevo:** link tracking cannot be turned off below Enterprise.
- **EmailOctopus:** tracking on by default and off only per campaign; an all-access API key.
- **MailerLite:** click tracking stays on.
- **Kit:** a tracking pixel in every email, and no API delete.
- **Loops:** marketing tracking on; double opt-in only through its forms.
- **Mailjet:** double opt-in only through its widget; no narrow keys.
- **Resend:** no built-in double opt-in.
- **Keila and Mailcoach:** no free plan.

## Alternatives considered

1. **Self-hosted listmonk + Amazon SES on our server.** Rejected by the owner's ruling. It needs SES production approval for public mail, a database to secure and back up, and more code.
2. **Our own SQLite tables on the server.** Rejected for the same reasons, plus backups and a restore test.
3. **Two lists (waitlist + news).** Rejected. One person would have two consents and two unsubscribe states.

## Consequences

1. **Little code:** one signup endpoint and one webhook handler. No unsubscribe or confirm endpoints of our own, and no database on our server.
2. **Cost:** at most $9/mo up to 1,000 people.
    - **a.** The confirm email must carry the postal address and a "Not you? Remove this address" link (Canada's anti-spam law).
    - **b.** Buttondown allows custom confirm-email wording only on paid plans. So the $9 plan is likely needed from launch.
    - **c.** If the standard email can carry both, it is $0 until 100 confirmed people.
3. **One accepted gap:** a person who has already confirmed and adds an app gets it at once, with no new confirm email. Buttondown cannot send that email to a confirmed subscriber, and a second sender would cost more than it is worth. Accepted after review, on these rules:
    - **a.** The pick is marked unverified and counted apart (Decision 1.d).
    - **b.** Every perk or early-access email names the app and points to the Contact page if that is wrong.
    - **c.** v1 runs no provider automations on tag or field changes. The only exception is the welcome email (Decision 2.b.vii), which is sent only when a person confirms, never when an app is added.
    - **d.** Store phase: a news-only person whose only app pick is unverified gets no perk email until they reply YES.
4. **Before signup code is written:** a 3–3.5 hour check on the real newsletter confirms about fifteen vendor behaviours (private-mode sign-ups, re-confirm after unsubscribe, webhook signing, metadata writes, key scope, postal-address requirement, redirects, what the "Not you" link does, plan-limit counting, free-plan features, the welcome email). A failure in the core four triggers the fallback.
5. **Reversibility:**
    - **a.** The provider is a two-way door: export + import + a new adapter.
    - **b.** The field set is a **one-way door.** Dates and consent facts not captured at signup cannot be rebuilt, so the field set is frozen now. The tag IDs are part of it. App names are not.
    - **c.** The welcome email is a two-way door: one setting.
