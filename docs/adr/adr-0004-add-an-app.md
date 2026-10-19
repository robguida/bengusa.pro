# ADR-0004: Adding an app — one app list, a permanent ID list, three statuses

- **Status:** Accepted
- **Date:** 2026-10-05
- **Supersedes:** the rule that the app IDs must be exactly `catche`, `timetracker` and `vault` (design doc rev 3, LR-29d). **Amends** ADR-0002, Decision 1.
- **Author:** Principal architect
- **Ticket:** BUWEB-100 rev 4 (built in BUWEB-106 and BUWEB-107b)
- **Amended 2026-10-05 (design rev 5):** the showcase rules (8.c), no "Try it" card (3.a), two more reserved words (6.c), three more build checks (6.h–j), and IDs permanent once they reach the server (6, last line). The form contract is unchanged.
- **Amended again 2026-10-05:** who retires an app (8.c.7). An app with a list needs Rob's go and an email to its list. A case-A app past 90 days is retired by the product lead, with no email and no go from Rob. Replaces "Rob decides every retirement (he emails the list)". Roles now stand in for names throughout. No rule changed except 8.c.7.
- **Amended a third time 2026-10-05 (project-lead ruling):** a case-A app that is cancelled or shelved may be retired by the product lead at any time, with no go from Rob (8.c.7). The status table in Decision 3 is now indented under item 3, so its note "a." no longer shows as a code block.

## Context

1. v1 launches with three apps: Catche, TimeTracker and Vault. More are queued (Claire, then Life Log). Each joins only after it clears the listing bar (spec 16.e).
2. Until now, the build accepted exactly those three app IDs. So every new app meant a new form contract, the architect's sign-off, and code and test changes: about 4 hours of engineering per app.
3. **Decided 2026-10-05** (team default, spec 16): launch with the three apps; show apps in a grid that grows, not a carousel; build the add-an-app path now, before the signup code.
4. **What must still hold:**
    - **a.** An app ID is never renamed, removed or reused, because each person's join dates are stored under it (ADR-0002, Decision 1.e).
    - **b.** Every app people can pick must deliver what the perk terms promise: a free beta seat and an early-bird discount (spec 13.f.i).

## Decision

1. **One app list:** `content/apps.json`. The site and the form server both read it.
    - **a.** One entry per app ever published. Each has a permanent `id`, a `status`, the long and short display names, the Off-grid flag, and two perk flags (`sold`, `freeBeta`).
    - **b.** The list's order is the display order everywhere: cards, menus, footer, the signup picker, and the "You're on the list for" line in emails.
2. **One permanent ID list:** `content/app-ids.ledger`. Every app ID ever published, one per line, oldest first. It only grows.
3. **Three statuses:**

    | Status | On the site | In the signup picker | Can be picked |
    |---|---|---|---|
    | `open` | card, page, menus | yes | yes |
    | `showcase` | card, page, menus (what the card may hold: spec open item 19) | no | no |
    | `retired` | nowhere | no | no; earlier picks keep their dates |

    - **a.** **Showcase is only for a real app we will sell** (8.c.1). **A free or already-live product gets no card in the app grid, in any status. There is no "Try it" status or flag.** If Rob ever wants one shown, it is a plain link outside the grid, with words the legal reviewer clears. It never enters the app list.

4. **The perk rule. An app is `open` (pickable) only if it can honour BOTH perks:** we will sell it (the early-bird discount) **and** it will have a free beta (early access). Otherwise it is not pickable.
    - **a.** The `sold` and `freeBeta` flags are true only while a **new** picker could still get that perk. The build refuses an `open` app unless both are true.
    - **b.** **Why:** the perk terms promise both perks for every pickable app, and they name no app. This rule is what lets a new app join without a new consent version.
5. **How a status may change.**
    - **a.** `retired` is final. Bringing a retired ID back needs the architect and a new decision record.
    - **b.** `open` and `showcase` may switch either way, through the steps in item 8. A new app starts as `open` or `showcase`.
    - **c.** Why `open` may become `showcase`: when an app goes on public sale and its beta ends, a new picker can no longer get either perk. It leaves the picker but keeps its card. Without this, a successful app would have to be retired off its own site.
6. **The build checks** (on the developer's machine, in CI, and before every deploy). The build fails unless:
    - **a.** The app list and the ID list hold the same IDs, each once.
    - **b.** The ID list starts with the previous ID list, line for line. New IDs are added only at the end. So no ID is ever removed, renamed or reordered.
    - **c.** Every ID is 3 to 20 characters: lowercase letters and digits, starting with a letter. It is not one of the reserved words `news`, `home`, `wid`, `src`, `consent`, `confirm`, `confirmed`, `constructor`, `prototype`.
    - **d.** Every status is `open`, `showcase` or `retired`, and every entry has its names and flags.
    - **e.** A retired app is still retired.
    - **f.** Every `open` app has both perk flags true.
    - **g.** At most 10 apps are `open`. Raising that is a form-contract change. Lowering it is not.
    - **h.** No person's record could outgrow the list service: the largest possible record (12 fixed fields, plus 4 for every ID ever issued) stays under the limit the vendor check measured, with a margin. When this check fails, the vendor check is re-run before another ID is added.
    - **i.** An app that becomes `open` carries the date its email-template check was done (step a.5). Re-opening an app needs a fresh date.
    - **j.** Both files are plain: UTF-8, LF line endings, no field repeated inside an entry.
    - The form server runs the checks that need no history when it starts, and refuses to start if one fails.
    - **An ID that has reached the server is permanent,** even if that release is rolled back or never goes live. The deploy checks compare against every ID ever deployed, not only the releases served today.
7. **The signup picker** is a plain list of tick boxes, one per `open` app, all visible and all unticked. It is never inside a slider, a carousel, a "show more" or a scrolling box.
8. **The steps.**
    - **a. Adding an app** (after it clears the listing bar, spec 16.e):
        1. Rob supplies the facts: what the app is, its platform, paid or free, whether it will have a free beta, what it connects to, and who owns the code and the name.
        2. The legal reviewer clears the listing bar and the claims, and sets the badge. The product lead applies the perk rule (item 4): `open` or `showcase`. If `open`, the product lead sets its early-access milestone (spec 3.e.v).
        3. The project lead confirms the new ID: it meets item 6.c and is not already in the ID list. **This is the one permanent choice.** It may be the working name; it never has to match a later name.
        4. The copywriter writes the card and page words. Rob approves them.
        5. **If `open`:** Rob or the ops engineer adds the app's line to each Buttondown email template that lists picks. A test signup on the preview site shows the app's name. **This is done before the release that opens the app goes live.** Otherwise someone could pick the app and get a confirm email that doesn't show it. The engineer's change (step 6) records the date of this check in the app's entry (6.i).
        6. An engineer adds, in one change: the app-list entry, the new line at the end of the ID list, the page content and the images. The build checks pass.
        7. The docs writer adds the app to the spec (4.a, must-have 18, and the perk-email order).
    - **b. Opening a showcase app:** steps a.2 (perk rule and milestone) and a.5 (template lines) first. Then one change sets the status to `open`, both flags to true, and the template-check date. An app that was open before comes back only under 8.c.5.
    - **c. Showcase: when an app moves, and what showcase is never for** (the legal showcase ruling 3 and the product showcase rule, 2026-10-05; spec 16.d.iii and 16.i):
        1. **Showcase is for two moments only.** **Case A:** the app cleared the listing bar, but the product lead can't set its early-access milestone yet, so it can't promise a new picker a beta seat. **Case B:** the app was open, and a new picker can no longer get both perks (it went on public sale, or its beta ended).
        2. **Open → showcase, no later than the day the early-bird codes go out.** Everyone on the app's list gets the early-bird code before the public sale opens. The release that sets the app to `showcase` (and `sold` to false) is live no later than the day those codes are sent, so nobody can join a list whose head start is gone. Rob sends the codes only after the live site shows that release. Before it ships, the product lead confirms how the people already on the list get their perks. Their picks and dates stay.
        3. **Late confirms still count.** A person who picked the app while it was open, but confirms after it moved, still gets the code. Their join date is filled whatever the app's status is now.
        4. **Showcase is never a parking spot.** A cancelled or shelved app is retired (step d), and Rob emails its list the "we'll tell you" email (spec 13.f.iii). The same email goes out if a promised perk won't happen at all for its list (no beta ever, or no discount), even if the app stays.
        5. **Back to open only with something new.** After its public sale, an app returns to open only if a new version or platform will be sold before the public at a discount, with a free beta. The card and the picker name the new thing. Otherwise both perks would be empty. It follows step b.
        6. **Case A time limit.** A case-A app still without a milestone after 90 days on the site is retired (step d). Nobody can be on its list, so no email is needed. Its ID stays reserved.
        7. **Who decides.** The product lead sets open or showcase at every add and every move. The legal reviewer clears the card words. The project lead runs each move as one change. Rob decides any exception to the listing bar. **Retiring an app:**
            - **An app with a list** (it was open at some point) is retired only with Rob's go, and Rob emails that app's list first (step d).
            - **A case-A app** (it never opened, so nobody is on its list) is retired by the product lead after 90 days on the site with no milestone (8.c.6). No email, and no go from Rob.
            - **A case-A app that is cancelled or shelved** may be retired by the product lead at any time, before day 90 too. No go from Rob: he sees it as an FYI in the weekly status report. Retirement is final (5.a). *(Project-lead ruling 2026-10-05.)*
            - Each app's status is one line in the weekly status report. Rob sees each move as an FYI.
        8. A move between open and showcase needs no new consent version and no notice email to the people already on the list.
    - **d. Retiring an app** (cancelled, shelved or withdrawn, or a case-A app past 90 days): Rob tells the people on its list, as the perk terms promise (spec 13.f.iii), in an email to that app's list only (13.f.vii). An app that was never open has no list, so no email. Then one change sets it to `retired`. Its page is removed and its old address redirects. The ID stays reserved forever.
    - **e. Renaming an app:** only the display names change (ADR-0002, Decision 1.e). The legal reviewer's "NewName (was OldName)" line is email-template wording only. The ID never changes.
9. **No page, email or legal text lists every app by name**, except text built from the app list. So adding an app changes no other copy.

## Alternatives considered

1. **Keep the fixed set of three.** Every new app would need a new form contract, the architect's sign-off, and about 4 hours of engineering. Rejected: it costs more from the first app added.
2. **An app list with no separate ID list** (compare the app list with its previous version). It works, but it mixes frequent wording edits with the rare permanent act of issuing an ID, and gives the admin scripts no single list of every ID ever used. Rejected: the ID list makes issuing an ID a one-line change that a reviewer can't miss.
3. **A carousel.** Rejected on usability grounds (spec 16.h). It does not change this record, except that the picker rule (item 7) forbids putting choices inside one.
4. **The list service's own tags for each app.** Already rejected in ADR-0002: picks are our own fields, written only by our server.

## Consequences

1. **Adding an app later:** about 1 hour of engineering plus 3–4 hours of words, legal and product work. No form-contract change, no new consent version, no architect sign-off.
2. **One-time cost now:** about 7 hours of team effort (about 3.5–4 hours wall-clock), before the signup code starts. It is off the launch's critical path. **Rev 5** adds about 3.75 hours of build and review work for the extra checks, so about 4.5–5 hours wall-clock for the whole path.
3. **Each new ID's spelling is permanent.** The build checks its format, and the steps name it.
4. **Email templates can't loop over apps,** so each `open` app needs its own line in each template that lists picks, live before the app opens (step a.5).
5. **The checks can't tell "the same app, renamed" from "a different app given an old ID".** The written rule (an ID is never given to another app) and the claims check cover that.
6. **People on a retired app's list are told,** and their records keep their dates. A pick made while the app was open still gets its join date, and its perks, if the person confirms after the app moves to showcase or retires.
7. **Showcase can't hide a broken promise.** A cancelled app is retired and its list is told. A case-A card with no milestone leaves the site after 90 days. An app leaves the picker before its early-bird codes go out.
8. **The success counts** count picks on any app that is not retired. People whose only picks are on retired apps are reported on their own line.
9. **Reversibility:** the app list and the statuses are a two-way door (an edit, within the checks). Each ID is a one-way door.
