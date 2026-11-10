# RECONNED — Data Protection Compliance Plan

**Status:** Phase 1 complete + T2.1, T2.2, T3.1 done (2026-08-04). Outstanding: the historical PII purge in T1.1 (manual, PostHog console); **`POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_IDS` still need setting in Coolify** — set locally only, and without them T2.2's analytics erasure is inert; session recordings may outlive person deletion (T2.2 residual risk); OneSignal subscriptions remain undeletable until `mail.ts` identifies users at send time (T2.2); and a pre-existing break in `api:generate-types` blocks the typed client from seeing new backend routes (T2.1).
**Owner:** Omar Žunić (natural person, sole data controller)
**Scope:** BiH Law on Personal Data Protection, *Official Gazette of BiH* No. 12/25 ("ZZLP") + Regulation (EU) 2016/679 ("GDPR")
**Last updated:** 2026-08-04

---

## 1. Legal position

### 1.1 Which law applies, and why

**ZZLP applies.** Art. 6(1) binds any controller with "registered office or establishment, **domicile or residence** in Bosnia and Herzegovina, regardless of whether the processing is carried out in Bosnia and Herzegovina or not." Having no legal entity changes nothing — residence in BiH is sufficient on its own.

**The personal/household exemption does not save us.** Art. 5(2) exempts processing "by a natural person solely for the purpose of personal or household activities." RECONNED is a public platform offering a service to an open user base, with third-party processors and analytics. This is settled ground in EU case law (*Lindqvist* C-101/01, *Ryneš* C-212/13) and the ZZLP wording is identical. The exemption is unavailable.

**GDPR probably also applies, separately.** Art. 3(2) GDPR catches non-EU controllers who offer services to data subjects in the EU. The platform serves BS/SR/EN locales in a region where Croatia and Slovenia are EU members and airsoft communities are cross-border. If EU users are targeted (not merely accidentally reachable), GDPR applies in parallel. See §7.1 — this is the biggest open question and it has a costly consequence (GDPR Art. 27 EU representative).

Practically: ZZLP is a near-verbatim GDPR transposition (it says so in Art. 1(2)), so **one set of engineering work satisfies both**. Only the paperwork differs.

### 1.2 Timeline

| Event | Date |
|---|---|
| Published, *Official Gazette of BiH* 12/25 | Feb 2025 |
| Entry into force (8 days after publication) | ~Feb 2025 |
| **Became applicable** (Art. 120: +210 days) | ~Sep 2025 — **already passed** |
| Agency subordinate legislation due (Art. 117: +210 days) | ~Sep 2025 — partly outstanding |
| **Compliance deadline for existing controllers** (Art. 116(2): +2 years) | **~Feb 2027** |

We are inside the transitional window but the law is live. Roughly six months of runway.

### 1.3 What personal liability actually looks like

This is the part that changes because there's no company.

Art. 113(4) and (5) impose fines on "the data controller and the processor." The percentage-of-turnover cap applies only "**in the case of an undertaking**" — as a natural person, only the flat BAM range applies:

| Breach | Fine range (natural person) |
|---|---|
| Arts. 7, 8, 9, 11 — principles, lawfulness, consent, special categories | **BAM 20,000 – 40,000,000** |
| Arts. 14–24 — data subject rights | **BAM 20,000 – 40,000,000** |
| Arts. 46–51 — unlawful international transfer | **BAM 20,000 – 40,000,000** |
| Arts. 10, 13, 27, 41, 44, 45 — child consent, by-design/by-default | **BAM 10,000 – 20,000,000** |

Art. 113(7)'s lower BAM 5,000–70,000 band is for "the responsible person" of a legal entity — it does not apply to us, since there's no entity to be responsible for. **The floor for the most likely violations is BAM 20,000, payable personally.** Art. 115 additionally reserves criminal liability for gross violations.

Two things soften this considerably, and both are reasons to execute this plan visibly:

- **Art. 113(1)** requires fines to be "effective, proportionate and dissuasive **in each individual case**."
- **Art. 113(2)** lists mandatory mitigating factors: (a) nature, scope and purpose of processing and number of data subjects; (b) whether the infringement was intentional or negligent; (c) mitigation actions taken; (d) technical and organisational measures under Arts. 27 and 34; (f) cooperation with the Agency; (h) whether the controller self-reported; (k) financial benefit gained.

A non-commercial hobby platform with a small user base, a written compliance plan, and a dated remediation log sits at the very bottom of every one of those factors. A dated `PLAN.md` in a public repo is itself evidence under 113(2)(c) and (d). An identical platform with no documentation and no consent flow is negligent under (b) and has nothing to show under (c) or (d).

Art. 113(3): multiple violations in related processing are capped at the amount for the most serious one — so we are not stacking.

### 1.4 What we do NOT have to do

Worth stating explicitly so we don't burn effort:

- **No registration with the Agency.** The old filing-system registration under the 49/06 law is gone — Art. 119(2) explicitly repeals the *Rulebook on the Method of Keeping and Form of Records of Personal Data Collections* (OG 52/09). The new law has no registration regime.
- **No Data Protection Officer.** Art. 39(1) triggers only for (a) public authorities, (b) core activity requiring "regular and systematic monitoring of a data subject **in large numbers**," or (c) large-scale special-category processing. A regional airsoft platform meets none. We will document this conclusion rather than ignore the question (§5.5).
- **Probably no DPIA.** Art. 37 is risk-triggered. No special categories under Art. 11, no systematic monitoring of a publicly accessible area, no automated decision-making with legal effect. Event geolocation plus behavioural analytics is borderline enough to justify a written negative screening, not a full assessment (§5.4).
- **No representative in BiH.** Art. 6(1) applies to us directly; the representative requirement is for controllers *outside* BiH.

---

## 2. Current state

Audited 2026-08-04 against `main` @ `494817ca`.

**Working:** account deletion with atomic club-ownership transfer (`apps/backend/src/routes/users.ts:1838`); per-field privacy controls with email/phone private by default (`apps/backend/src/lib/user-sanitization.ts`, `schema.ts:1074-1077`); PostHog hosted in the EU region; passwords and 2FA via better-auth; Turnstile on registration; an existing `deleteS3Files` helper (`apps/backend/src/lib/storage.ts:129`); a written privacy policy and ToS that are structurally sound.

**The gap is not that nothing exists — it's that consent, access/portability, retention and transfer documentation are entirely absent, and several statements in the published policy are contradicted by the code.**

| # | Finding | Article | Severity |
|---|---|---|---|
| F1 | PostHog initialises unconditionally; no consent banner, no opt-out anywhere in the repo | 8(1), 9 | Critical |
| F2 | Email addresses sent to PostHog on login/registration attempts and identify — including for failed logins by non-users | 7(1)(c), 8(1) | Critical |
| F3 | No data export endpoint; policy promises portability | 17, 22 | Critical |
| F4 | International transfers (OneSignal, Google, Turnstile, S3) undocumented, no safeguard identified | 46–51 | Critical |
| F5 | No privacy notice or consent at registration; policy linked only from the footer | 15 | High |
| F6 | No retention limits — sessions, audit logs and verification tokens accumulate indefinitely | 7(1)(e) | High |
| F7 | Erasure incomplete: orphaned audit-log IP/UA, PostHog person, OneSignal record, S3 objects | 19, 21 | High |
| F8 | Guest attendees (`guestName`, `guestEmail`) receive no notice | 16 | High |
| F9 | No age verification at registration | 10 | High |
| F10 | Instagram OAuth token stored in plaintext | 34 | High |
| F11 | No record of processing activities | 32 | Medium |
| F12 | No breach response procedure | 35, 36 | Medium |
| F13 | Processor agreements not established or filed | 30(3) | Medium |
| F14 | Policy states no legal basis per purpose | 15(1)(c) | Medium |
| F15 | Policy missing retention, complaint right, withdrawal right, controller identity | 15(1)(a), 15(2) | Medium |
| F16 | Policy claims data is "anonymized where possible" — untrue (see F2) | 7(1)(a), 14 | Medium |
| F17 | Processors described only as "service providers," not named | 15(1)(e) | Low |
| F18 | Profiles public by default | 27(2) | Low |

Art. 32(5)'s under-250-employees exemption **does not apply to F11**: it is lost where processing "is not occasional." Continuous platform operation is not occasional.

---

## 3. Strategy

Four principles, in priority order:

1. **Stop the bleeding first.** F1 and F2 are ongoing violations that grow with every page load. They're also among the cheapest to fix. Do them in week one, before anything else.
2. **Minimise rather than legitimise.** Every field we don't collect is a field we don't have to justify, secure, export, retain, or erase. Prefer deleting a data flow over documenting it. F2 is fixed by *not sending* email to PostHog, not by finding a basis for it.
3. **Contract as the primary basis, consent only where required.** Art. 8(1)(b) covers everything needed to run the platform — account, profile, memberships, event registrations, transactional email. Consent (Art. 8(1)(a)) is reserved for analytics, where it is genuinely required and genuinely withdrawable. Do not build consent flows for processing that contract already covers; Art. 9(4) treats consent bundled into service delivery as not freely given anyway.
4. **Make compliance self-evidencing.** Art. 7(2) puts the burden of *demonstrating* compliance on the controller. Documents live in-repo, in git, with dates. The commit history is the audit trail.

---

## 4. Engineering work

### Phase 1 — Stop ongoing violations (target: week 1)

#### T1.1 — Strip PII from all analytics calls · F2 · Art. 7(1)(c) — ✅ code done, ⚠️ purge outstanding
Remove `email` and `name` from every PostHog call. `distinctId` is already the user ID and is sufficient for every legitimate analytics question.

- `apps/web/src/app/[locale]/(auth)/login/page.tsx:128` — drop `email` from `user_login_attempt`. This is the worst one: it fires on *failed* logins, exporting typo'd and non-user email addresses to a third party with no basis whatsoever.
- `apps/web/src/app/[locale]/(auth)/register/page.tsx:84,106` — drop `email` from `user_registration_attempt` / `user_registration_success`.
- `apps/web/src/components/posthog-identify.tsx:21,30` — drop `email` and `name` from `identify()` properties and from the `user_login` event. Keep `language`/`theme`/`font`; those are non-identifying preferences.
- `apps/backend/src/routes/users.ts:1991` — drop `email` from `user_account_deleted`. Exporting the email of a user who just exercised Art. 19 is indefensible.

The audit missed five further call sites, all found and fixed during implementation:

- `apps/backend/src/lib/auth.ts:155,201,265` — `email` on `password_reset_email_sent`, `email_verification_sent` and `user_signed_up`.
- `apps/backend/src/routes/clubs/invites.ts:270` — `recipient_email` **and** `invitation_code`. The code was a live credential for joining a club, sitting in a third-party analytics store; dropped along with the address.
- `apps/backend/src/routes/admin/unclaimed-clubs.ts:687` — `recipient_email` on `club_owner_assigned_email_sent`.
- `apps/backend/src/routes/clubs/members.ts:340` — `member_name` on `club_membership_extended`, a third party's real name.

`user_account_deleted` no longer needs the user row at all, so the deletion handler's `SELECT` was narrowed to `id`.

Then **purge historical PII already in PostHog**: delete accumulated person properties and event properties containing email/name via the PostHog UI or API. Fixing the code does not remediate data already transmitted.

*Acceptance:* `grep -rn "posthog" apps/web/src apps/backend/src` shows no call site passing `email`, `name`, `phone`, or any free-text profile field. PostHog person profiles contain no email property.

#### T1.2 — Correct the false statement in the published policy · F16 · Art. 7(1)(a) — ✅ done
`apps/web/src/app/[locale]/(public)/privacy-policy/page.tsx:218` currently reads *"All tracking data is anonymized where possible."* Until T1.1 lands this is false, and after T1.1 it's still misleading (pseudonymised ≠ anonymised — the data is keyed to a user ID). Replace with an accurate description. Bump `PRIVACY_POLICY_LAST_UPDATED` in `apps/web/src/lib/legal-dates.ts`.

This is a one-line change and should ship immediately, ahead of T1.1 if T1.1 slips.

#### T1.3 — Consent gate for analytics · F1 · Arts. 8(1), 9 — ✅ done
The central fix. `apps/web/instrumentation-client.ts:6` currently calls `posthog.init()` on every page load with `defaults: "2025-05-24"`, which enables autocapture, pageview and pageleave capture, and PostHog's cookies. None of this is strictly necessary to deliver the service, so it needs prior consent.

Requirements from Art. 9:

- **9(1)** — we must be able to *demonstrate* consent. Persist the decision with a timestamp and policy version.
- **9(2)** — request must be clearly distinguishable, intelligible, plain language.
- **9(3)** — withdrawal must be **as simple as granting**. A banner to accept and a buried email address to withdraw fails this. Ship a persistent control (footer link or settings page) from day one.
- **9(4)** — consent must not be bundled with service delivery.

Implementation:

1. Do not call `posthog.init()` at module load. Gate it behind a stored consent decision, defaulting to **not initialised**.
2. Add a consent banner with genuinely equal-weight Accept and Reject actions. Rejecting must be one click — no "manage preferences" maze for the reject path. Do not pre-tick, do not use a dismiss-as-accept pattern, do not treat continued scrolling as consent.
3. Store the decision in a first-party cookie or `localStorage`: `{ analytics: boolean, timestamp: ISO8601, policyVersion: string }`.
4. On withdrawal call `posthog.opt_out_capturing()` and `posthog.reset()`, and clear PostHog's own cookies.
5. Add a persistent "Cookie settings" entry in `apps/web/src/components/footer.tsx` that reopens the choice.
6. ~~Turn off session replay.~~ **Decided 2026-08-04: session replay stays on.** Keeping it is fine, but it is the single most invasive thing the platform does, so it carries conditions — see T1.4. The original worry stands in a narrower form: replay is a *server-side* toggle, so its scope can change from the PostHog UI without a code change here. The masking below is the part that lives in the repo and cannot be switched off remotely.
7. Review `capture_exceptions: true` (`instrumentation-client.ts:10`). Exception payloads can carry URLs and user context. Either bring it under the same consent gate or confirm it captures nothing identifying.

As built:

- `apps/web/src/lib/consent.ts` — the whole mechanism. Owns the stored record, the PostHog key, `init()`, opt-in/opt-out, and cookie/`localStorage` clearing on withdrawal. `posthog.init()` is now reachable from exactly one place, which is what stops analytics quietly coming back.
- `apps/web/instrumentation-client.ts` — reduced to `applyStoredConsent()`. No key, no config, no unconditional init.
- `apps/web/src/components/consent-banner.tsx` — Accept and Reject as identical `variant="outline"` buttons, one click each. When reopened it shows the current state ("Keep analytics on/off") rather than pretending no decision exists.
- `apps/web/src/components/cookie-settings-button.tsx` + `footer.tsx` — the persistent withdrawal route required by Art. 9(3).
- `posthog-identify.tsx` returns early when analytics is off, so no `identify()` fires into an uninitialised client.

Step 7 resolves itself: `capture_exceptions` is an `init()` option, and `init()` now only runs after consent.

The consent record is versioned by `CONSENT_POLICY_VERSION` (currently `2026-08-04`). Bumping it when §5.1's policy rewrite lands re-asks everyone, which is the right behaviour — the old consent was given against a different description of the processing.

The `/warmind` reverse proxy (`apps/web/next.config.ts:118-131`) can stay — proxying is legally neutral. But note that proxying analytics to evade ad blockers **while** collecting without consent reads badly in an inspection. Once consent gates it, the proxy is unremarkable.

*Acceptance:* with a clean profile, loading any page sets no PostHog cookie and issues no request to `/warmind` until Accept is clicked. After Reject, none appear on subsequent navigation. Withdrawal is reachable in ≤2 clicks from any page.

#### T1.4 — Conditions on keeping session replay · Arts. 9(2), 27(1), 34 — ✅ done
Session replay is kept (decision, §6.7). Consent alone does not make it lawful: Art. 9(2) requires consent to be *informed*, and a banner that says "analytics" while recording someone's screen is not informed consent for the recording. Art. 27(1) data protection by design applies to how much the recording captures.

Three things follow, all implemented:

1. **Replay is named where the user can find it — in the policy, not the banner.** Revised 2026-08-04 on the owner's instruction: the banner is now deliberately short (*"We'd like to use analytics to help improve the platform experience. This is completely optional and won't affect how the site works."*) and defers detail to the linked privacy policy, which is layered notice done the normal way.

   That shifts the whole Art. 9(2) "informed" burden onto the policy, so replay was promoted **out of a mid-paragraph clause under *Cookies and Tracking Technologies* into its own `Session Recordings` section** with a heading of its own. Someone skimming headings for what happens to them will now hit it; before, they had to read to the end of a five-sentence paragraph about PostHog event names. Three paragraphs: what a recording is (*"closer to a video of your visit than to a list of statistics"*), what is never captured (all inputs incl. password, request bodies, console, and third-party emails/phones/IPs rendered on our own pages), and that it is consent-gated, withdrawable from the footer, EU-hosted, and erased on account deletion.

   **Residual risk, accepted knowingly:** a person who accepts at the banner without opening the policy has not been told their screen is recorded. Layered notice is standard and generally defensible, but replay is the item most likely to be argued as requiring the more prominent mention, and the DPIA (§5.4) should record this as a deliberate choice rather than an oversight. Revisit if the Agency or an EU DPA says otherwise.
2. **Recording configuration is pinned in code** (`src/lib/consent.ts`): `maskAllInputs: true`, `recordHeaders: false`, `recordBody: false`, `enable_recording_console_log: false`. These are PostHog's current defaults, set explicitly because they are precisely the settings that mean "we do not record what people type or what their browser sends" — a library default moving is not something to discover from a recording.
3. **Third-party PII on screen is masked.** Replay captures rendered text, so a club manager viewing a member list would have put *other people's* addresses into the recording. `ph-mask` (PostHog's default `maskTextClass`) now covers every place the UI renders an email, phone or IP: `user-overview.tsx`, `user-switcher.tsx`, `command-menu.tsx`, `audit-logs-table.tsx` (both the actor line and the stored IP address), `managers-table.tsx`, `admin/users/user-sheet.tsx`. The attendance roster uses email only as a search key and never renders it, so it needs nothing.

**This is a standing obligation, not a one-off.** Any new UI that renders someone's email, phone or IP needs `ph-mask`, or `ph-no-capture` to drop the element from the recording entirely.

Replay also moves §5.4: it is the strongest single factor pushing toward an Art. 37 DPIA, and the screening has to address it head-on rather than list it in passing.

---

### Phase 2 — Data subject rights (target: weeks 2–3)

#### T2.1 — Data export · F3 · Arts. 17, 22 — **DONE (2026-08-04)**
No export endpoint exists, yet the policy promises portability at `privacy-policy/page.tsx:237`. Promising an unimplemented right is worse than silence.

Add `GET /users/:id/export` in `apps/backend/src/routes/users.ts`, authenticated, self-only (mirror the auth check at `users.ts:1847`). Return JSON — Art. 22(1) requires a "structured, commonly used and machine-readable format."

Must include every table keyed to the user: `User`, `Session` (incl. IP/UA), `account`, `passkey`, `twoFactor` (metadata only, never secrets), `apikey` (metadata only), `clubMembership`, `clubInvite`, `clubAuditLog` (rows where they are the actor), `eventRegistration`, `eventAttendee`, `review`, `reviewEditHistory`, `post`, `achievementToUser`, `oauthConsent`, `clubPurchase`.

Exclude: password hashes, 2FA secrets, session tokens, API key secrets. Art. 22(4) — the right "shall not adversely affect the rights and freedoms of others," so redact other users' personal data from shared records (e.g. names in audit log `actionData`).

Add a "Download my data" button in the dashboard account settings, next to account deletion.

Art. 17(3)/Art. 14: respond within **one month**, extensible by two. An endpoint answering in seconds makes this trivially satisfied.

*Acceptance:* endpoint returns valid JSON covering all tables above; a second user's ID returns 401/403; no secret material in the payload.

##### As built

`GET /users/:id/export` in `users.ts`, `auth: true`, **strictly self** — narrower than the surrounding routes, which admit admins. An admin pulling somebody's whole record in one request is not the access right and has no operational need; a subject who cannot reach the button gets a manual export under §5.7 instead. Rate-limited to 5/hour on the shared Redis store.

Response is `Content-Disposition: attachment` + `Cache-Control: no-store`. UI is a "Download my data" button in `security/_components/security-settings.tsx`, directly above the delete-account block. It calls the endpoint with plain `fetch` rather than the generated client — see the tooling note below.

Two corrections to the table list above, found by reading the schema:

- **`post` and `clubPurchase` carry no user column at all.** Both are club-scoped (`clubId` only); neither records an author or purchaser. Nothing to export, and nothing for T2.2 to erase either — worth remembering when that task audits the deletion path.
- **`apikey` has no `userId`.** It keys on `referenceId`, which is the user id because the better-auth api-key plugin runs on its defaults (`auth.ts:245`). Exported as metadata; `key`, `permissions` and `metadata` withheld.

`oauthConsent` is included as listed. Credentials are *described, not included*: `signInMethods` names each password/OAuth/passkey/2FA method with its creation date, while hashes, TOTP secrets, backup codes, passkey public keys, OAuth tokens, session tokens and API key secrets stay out. A `meta.excluded` array states this in the file, so the omission is disclosed rather than silent.

**Art. 22(4) redaction is real and was needed.** Audit-log `actionData` is free-form jsonb, and a club manager's actions are mostly actions taken *on other members* — `clubs/members.ts` writes `memberName` and `userEmail`, `clubs/invites.ts` writes `email`, `userName` and `inviteCode`. Without redaction, one manager's export would have been a way to read other members' contact details. `redactActionData()` strips a denylist of PII-bearing key names *and* anything email-shaped at any depth; `inviteCode` goes too, on the separate ground that it is a live credential. Denylist over whitelist is deliberate: a new action type logging an unlisted field should fail towards including the subject's own data, not towards silently dropping it. **This is a standing obligation — a new audit action that logs a third party's details needs its key added to `REDACTED_ACTION_DATA_KEYS`.**

Invites and guest attendance are matched on the subject's **email address as well as their user id**: an invite sent, or a place booked for them as a named guest, before they signed up is still their personal data and never got a `userId`. Matched with `lower()` rather than `ilike`, because `_` and `%` are LIKE wildcards and both are legal in an email local-part — `ilike` would have pulled in a different person's rows.

*Verified:* 8 tests in `apps/backend/tests/users/export.test.ts` — unauthenticated 401, other-user 401, **admin 401**, all sections present, attachment + no-store headers, no password or hash prefix anywhere in the payload, own membership and audit trail present, and third-party email/name/invite code redacted while the subject's own `inviteId` survives. Full backend suite: 636 pass, 1 fail (`clubs core > logo upload-url`, pre-existing — fails identically on a clean tree).

Separately verified the response schema is **lossless**: the router `.parse()`es responses against the declared zod schema and silently strips anything undeclared, which would have quietly dropped fields from somebody's export. A structural diff of payload-vs-parsed caught exactly one omission (`normalizedEmail`), now included.

##### Discoverability

A right nobody knows about is one nobody exercises, so both are advertised rather than buried in settings. The homepage feature grid ("For Everyone") had a **Data Export** card marked *Planned*; it is now a live card linking to `/dashboard/user/security`, joined by a new **Account Deletion** card. Worth doing for its own sake — self-service deletion with no email round-trip and no retention dark pattern is genuinely better than what most platforms offer, and saying so publicly is a commitment we now have to keep.

##### Tooling blocker, pre-existing

`bun run api:generate-types` in `apps/web` is broken and cannot regenerate the typed API client: `openapi-typescript@7.13.0` reads `ts.factory` at import time, which is `undefined` on this repo's TypeScript (root pins 6.0.3, `apps/web` wants ^7), so it dies before it ever reads the spec. Fails identically under both `bunx` and `bun x --bun`, and is unrelated to this work.

Consequence: **no new backend route can reach `apps/web/src/lib/api/api-types.ts` until this is fixed**, so `apiClient` cannot see them. Worked around here by calling the export endpoint with plain `fetch` — a reasonable fit for a file download, but not a general answer. Fix by pinning a TypeScript 5.x just for the generator, or moving to a version of `openapi-typescript` that supports TS 6/7.

#### T2.2 — Complete the erasure path · F7 · Arts. 19, 21 — **DONE (2026-08-04)**, one gap documented
`POST /users/:id/delete` (`users.ts:1838`) is correctly atomic for club ownership — good. But erasure is incomplete:

- **Orphaned audit-log rows.** `ClubAuditLog.userId` is `ON DELETE SET NULL` (`schema.ts:582`), so the row survives with `ipAddress` and `userAgent` intact (`schema.ts:557-558`). An IP address is personal data; nulling the FK does not anonymise the row. Within the deletion transaction, also null `ipAddress` and `userAgent` on that user's rows. Retaining the action record for club-governance integrity is defensible; retaining their IP is not.
- **S3 objects.** Avatars (`User.image`) and header images (`User.headerImage`) survive. Use the existing `deleteS3Files` helper (`storage.ts:129`) with `keyFromCdnUrl` (`storage.ts:114`).
- **PostHog person.** Call the PostHog delete-person API for the `distinctId`. Note this must happen even after T1.1, since the person profile persists.
- **OneSignal.** Verify whether `include_email_tokens` (`mail.ts:96`) creates persistent subscriber records. If it does, delete them.
- **Art. 21 notification.** We must inform recipients of the erasure. Once T1.3 and T2.2 are done, the processor list is short and each deletion is an API call — document that this satisfies Art. 21.

Erasure is not absolute (Art. 19(3)). Where a review or club audit entry must persist for others' legitimate interests, anonymise rather than delete, and say so in the policy.

*Acceptance:* after deleting a test account, a DB sweep for that user ID and email returns only intentionally-anonymised rows; the S3 avatar 404s; the PostHog person is gone.

##### As built

All four processor/DB steps are wired into `POST /users/:id/delete`. New `apps/backend/src/lib/erasure.ts` holds the third-party calls. Everything past the commit runs under `Promise.allSettled` and is best-effort by design: the account is already gone, and a processor being down must not roll back an erasure the person asked for. Failures log loudly for manual retry rather than 500ing, since a 500 would only invite them to press the button again on an account that no longer exists.

- **Audit-log IP/UA** — nulled inside the transaction, before the delete, since afterwards `ON DELETE SET NULL` leaves no `userId` to find the rows by.
- **S3 objects** — `image`/`headerImage` keys are read *before* the transaction; once the row is gone nothing points at them. Deliberately calls `deleteS3Files` **without** a userId: passing one makes it capture a `files_deleted` event, which would re-create the person profile being erased alongside it.
- **PostHog person** — `bulk_delete` by distinct id with `delete_events=true`. Without that flag the profile goes but its events remain, and since we capture against `distinctId: userId` the behavioural history of a deleted account would stay queryable.
- **OneSignal** — implemented, but a no-op today. See the gap below.

##### Two corrections to the findings above

**The orphaned-IP leak is latent, not live.** `ClubAuditLog.ipAddress`/`userAgent` are *never written* — all 35 `logClubAudit()` call sites omit them, and the only other insert is the ownership-transfer one in the delete route. So the columns are always null in practice and the fix remediates nothing today. Worth keeping: the columns exist, the audit UI renders them, and the erasure path must hold whenever something starts filling them. The test seeds an IP directly to prove it does. **This also makes the T3.1 row "null `ClubAuditLog.ipAddress`/`userAgent` after 90 days" moot for now** — and raises a minimisation question for §6: columns that are never written are Art. 7(1)(c) dead weight and arguably belong dropped rather than retained.

**Our own telemetry was undoing the erasure.** `posthog.capture({ distinctId: userId, event: "user_account_deleted" })` re-creates a person profile keyed to the erased user. `posthog-node` batches, so it can flush *after* the delete request lands — and PostHog's bulk-delete only removes events captured before it. Now captured as `distinctId: "system"` with `$process_person_profile: false`: the product signal (a deletion happened) survives, the identifier of the person who exercised the right does not.

##### Remaining gap — OneSignal subscriptions are unreachable

Verified against the docs, both halves of the plan's question: `include_email_tokens` **does** create a persistent email Subscription, whose ID is stable for its lifetime. So there is a subscriber record per address we have ever mailed, and it outlives the account.

It cannot currently be deleted. OneSignal has no delete-by-email-address endpoint. Deletion needs either a subscription ID (which we never see) or an alias — `DELETE /apps/{app_id}/users/by/external_id/{id}`. `mail.ts` sends via `include_email_tokens`, which attaches the subscription to an *anonymous* user with no `external_id`, so there is nothing to address. The documented fallback is a full Export Subscriptions dump, which is not viable inside a delete request.

`deleteOnesignalUser()` is wired up and calls the correct endpoint, so the path is right the moment an alias exists — it 404s harmlessly until then. **Closing this needs `mail.ts` to identify users to OneSignal at send time**, which is a real change: `sendEmail({to, subject, html})` takes bare addresses and its callers include recipients who are not users at all (guest invitees, unclaimed-club contacts). Sizeable enough to be its own task rather than a rider on this one.

##### Configuration — **analytics is split across two PostHog projects**

This was nearly a silent half-erasure. Analytics does not go to one project but two, and a person exists **separately in each**:

| Project | ID | Token | Fed by |
|---|---|---|---|
| `backend` | 110262 | `phc_dz8FuO…` | `posthog-node` — server events |
| `web` | 42900 | `phc_Til0zz…` | `posthog-js` — autocapture, identify, **session recordings** |

Deleting from one leaves the other fully intact, and the one that would have been missed is `web` — the project holding the session replays. `POSTHOG_PROJECT_IDS` is therefore **plural and comma-separated**, and `deletePosthogPerson` fans out across all of them, returning success only if every project succeeded. Any new project that receives a `distinctId` must be added to this list or its copy of the person survives erasure.

Env vars (both optional so the app still boots, both added to `.env.example`): `POSTHOG_PERSONAL_API_KEY` (personal key scoped `person:write` — the public key cannot delete anything) and `POSTHOG_PROJECT_IDS`. **Without both, deletion still succeeds but the person and their events survive it**; the skip logs a warning.

Set locally (`apps/backend/.env`, gitignored). **Still to set in Coolify** — see §9.

*Verified against the live API:* `GET /api/projects/{id}/` returns 200 for both and confirms the id↔token mapping above; `POST /api/projects/{id}/persons/bulk_delete/?delete_events=true` returns **202 Accepted** on both, confirming endpoint, `Bearer` auth format and key scope. Probed with a non-existent distinct id, so no real person was touched.

##### Residual risk — session recordings may outlive the person

PostHog's person deletion is *intended* to remove associated data, but their own issue tracker acknowledges the deletion system "might not cover data in all systems". Recordings are stored separately from events, so `delete_events=true` is not a guarantee that replays are gone. Two mitigations worth taking, neither yet done:

1. Set an explicit **replay retention period** in the PostHog project settings as a time-bound backstop — the shortest that is still useful.
2. Re-check a deleted test account's recordings a few days after erasure, and if they persist, raise it with PostHog support and record the outcome in the DPIA.

This is the sharpest remaining edge of the decision to keep session replay (§6, decision 7), and belongs in the §5.4 DPIA screening as a known limitation rather than an assumed non-issue.

*Verified:* 4 tests in `apps/backend/tests/users/erasure.test.ts` — no `User`/`Account`/`Session` row survives by id or email; audit entries survive with `userId`, `ipAddress` and `userAgent` all null; deletion completes with processors unreachable; ownership transfer still fires. Full suite: 640 pass, 1 fail (`clubs core > logo upload-url`, pre-existing).

#### T2.3 — Rectification, restriction, objection · Arts. 18, 20, 23
Profile editing already covers most of Art. 18. Arts. 20 and 23 have no self-serve equivalent and don't need one at this scale — a documented manual process with a one-month SLA is sufficient. Cover it in the internal procedure (§5.6) and name the contact address in the policy.

---

### Phase 3 — Minimisation, retention, notice (target: weeks 3–5)

#### T3.1 — Retention policy and cleanup task · F6 · Art. 7(1)(e) — **DONE (2026-08-04)**
The only scheduled cleanup is expired club invites (`apps/backend/src/tasks/scheduler.ts:218`). Register additional tasks in the same scheduler:

| Data | Location | Proposed retention | Rationale |
|---|---|---|---|
| `Session` rows (incl. IP, UA) | `schema.ts:261` | delete 30 days past `expiresAt` | Expired sessions have no purpose |
| `ClubAuditLog.ipAddress` / `.userAgent` | `schema.ts:557` | null after 90 days | Abuse investigation window; action record survives — **but nothing writes these columns today, see T2.2; consider dropping them instead** |
| `ClubAuditLog` rows | `schema.ts:548` | keep (club governance) | Legitimate interest, no PII after 90 days |
| `verification` tokens | `schema.ts:199` | delete 7 days past expiry | Short-lived by design |
| `clubInvite` | already handled | unchanged | ✅ |
| Accounts | `User` | **keep for the lifetime of the account** — decided, see §6.1 | Purpose is live while the account is usable; deletion is user-triggered and self-serve |

Art. 32(1)(f) requires these periods in the ROPA; Art. 15(2)(a) requires them in the privacy policy. Pick numbers, write them down, enforce them in code — all three must agree.

*Acceptance:* scheduler registers each task; a seeded expired session is gone after one run; audit rows older than 90 days have null IP/UA.

##### As built

New module `apps/backend/src/tasks/retention.ts` holds the periods and the three handlers; `scheduler.ts` only decides how often to run them. The split is the point — **the periods are the thing the ROPA and the privacy policy have to quote**, so they live in one exported `RETENTION` object with the reasoning attached to each, not scattered through registration blocks. `describeRetention()` renders them as data/period pairs so those documents can be checked against the code rather than against memory.

| Constant | Period | Handler |
|---|---|---|
| `EXPIRED_SESSION` | 30 days past `expiresAt` | `purgeExpiredSessions()` — deletes the row, IP and UA with it |
| `EXPIRED_VERIFICATION` | 7 days past `expiresAt` | `purgeExpiredVerifications()` |
| `AUDIT_LOG_NETWORK_IDENTIFIERS` | 90 days | `stripAgedAuditLogIdentifiers()` — nulls IP/UA, keeps the entry |

All three run daily with `runOnStart: true`, so a deploy enforces retention immediately rather than a day later, and the first run after shipping clears whatever has already aged past the line. Daily rather than hourly because the periods are measured in weeks; the handlers are idempotent, so a missed run is caught by the next one instead of leaving data behind permanently.

Two details worth keeping:

- **Sessions are keyed on `expiresAt`, not `createdAt`.** A long-lived session that is still valid is still doing its job, and reaping it by age would log real users out for no privacy gain.
- **The audit-log update carries an `is not null` predicate.** Without it the statement rewrites every aged row on every run forever — correct output, invisible daily write storm. A test asserts the second consecutive run updates zero rows, because convergence is the kind of property that only fails in production.

`retention.ts` deliberately does not import `TimeIntervals` from `scheduler.ts`: `scheduler.ts` imports *it* to register the tasks, and `RETENTION` is evaluated at import time, so borrowing a const across that cycle is a temporal-dead-zone crash waiting for a refactor to trigger. It defines its own `days()` instead.

*Verified:* 7 tests in `apps/backend/tests/lib/retention.test.ts`, each pinning one side of a boundary rather than merely proving the task ran — a task that deletes nothing and one that deletes everything both pass a "did it run" check. Expired-past-period deleted, expired-but-recent kept, live session untouched *and still able to authenticate a request*, verification tokens both sides of the line, audit IP/UA nulled while `actionType` and `userId` survive, recent audit identifiers untouched, and the convergence check. Full backend suite: **647 pass, 1 fail** (`clubs core > logo upload-url`, pre-existing).

##### Still open

**Resolved 2026-08-04: accounts are kept until the user deletes them, and there is no dormancy reaper** (§6.1). Recorded in `retention.ts` as an explicit decision rather than left as an absence, and surfaced by `describeRetention()` as "For as long as the account exists" so the policy and ROPA quote a period rather than skipping the row.

The privacy policy still states no retention periods, which Art. 15(2)(a) requires. That is §5.1's job and it was blocked on this task producing numbers; **it no longer is** — the numbers now exist and `describeRetention()` emits them in the shape the policy needs.

#### T3.2 — Registration-time notice and consent · F5, F9 · Arts. 15, 10
`apps/web/src/app/[locale]/(auth)/register/page.tsx` collects name, email and password with no link to the privacy policy and no age confirmation. The only link is in the footer (`components/footer.tsx:195`). Art. 15 requires the information **at the time of collection**.

Add, above the submit button:
1. Plain-language text linking to `/privacy-policy` and `/terms-of-use`.
2. An **age confirmation checkbox**, unticked. Art. 10(1) sets 16 for information-society services; our policy and ToS both say 17 (`privacy-policy/page.tsx:271`, `terms-of-use/page.tsx:77`), which is stricter and fine — keep 17 for consistency. Art. 10(2) requires "reasonable efforts to verify" given available technology; for a platform of this size an explicit unticked declaration is a defensible interpretation of reasonable. Given airsoft's young demographic this is a realistic complaint vector, so the declaration must be an affirmative act, not fine print.

Do **not** add a "I accept the privacy policy" checkbox. A privacy policy is notice under Art. 15, not consent under Art. 8(1)(a) — the basis for account processing is contract, Art. 8(1)(b). A consent checkbox here would misrepresent the basis and, per Art. 9(4), wouldn't be freely given anyway since the service is conditional on it.

Also add the same age checkbox to the Google sign-up path, which currently bypasses this form entirely.

*Acceptance:* the form cannot be submitted without the age box ticked; both legal links resolve; the Google path also collects the declaration.

#### T3.3 — Notice for guest attendees · F8 · Art. 16
`eventAttendee.guestName` / `guestEmail` (`schema.ts:716`) collects personal data about people who never visited the site. Art. 16 requires notice when data is not obtained from the data subject — at the latest at first communication with them, or within one month.

- Add notice text at the point of entry, making clear to the *organiser* that they are providing someone else's data and must have grounds to do so.
- Include a link to the privacy policy and a "how to have your data removed" line in **any** email sent to a guest address.
- If no email is ever sent to guests, the one-month rule (Art. 16(3)(a)) still bites — consider whether `guestEmail` is needed at all. **Not collecting it removes this entire obligation** (principle 2, §3).

#### T3.4 — Encrypt Instagram tokens · F10 · Art. 34
`instagramPageSelection.accessToken` (`schema.ts:595`) is a bare `text()` column. A leaked long-lived Instagram token is a live credential for a third-party account. Encrypt at rest with a key from env, decrypting only at use in `apps/backend/src/lib/instagram.ts`. Art. 34(1)(a) names encryption explicitly.

#### T3.5 — Reconsider public-by-default profiles · F18 · Art. 27(2)
`isPrivate` and `isPrivateStats` default to `false` (`schema.ts:1074,1077`). Art. 27(2) requires that by default only data necessary for each specific purpose is processed, and specifically that data is not made "accessible to an indefinite number of natural persons" without intervention.

Email and phone already default to private — good. Public profiles are defensible for a discovery-oriented community platform, but the *default* should be a deliberate, documented decision, and the choice must be surfaced during onboarding rather than buried in settings. Lowest priority item here; document the reasoning either way.

---

### Phase 4 — Transfers and processors (target: weeks 5–6)

#### T4.1 — Map and legitimise international transfers · F4 · Arts. 46–51
The hardest item, because BiH's transfer regime is not yet operational.

Current transfers:

| Recipient | Purpose | Destination | Notes |
|---|---|---|---|
| PostHog | Analytics | **EU** (`eu.i.posthog.com`, `posthog.ts:22`) | EU-hosted; still a transfer out of BiH |
| OneSignal | Transactional email | US (`mail.ts:82`) | |
| Google | OAuth sign-in | US (`auth.ts:209`) | |
| Cloudflare Turnstile | Bot protection | US | |
| S3 provider | File storage | **unknown** — `env.ts:74` | Must determine actual region |
| Instagram / Meta | Optional club feed | US | Club-initiated |
| Hosting provider | Everything | **unknown** | Must determine |

The problem: Art. 47 transfers require a **Council of Ministers adequacy decision** — none exist yet. Art. 48 transfers require **standard contractual clauses adopted by the Agency** under Arts. 30(8)/48(3) — the Agency's subordinate legislation was due ~Sep 2025 under Art. 117 and remains substantially outstanding.

So neither primary route is currently available. That leaves **Art. 51 derogations**, most plausibly transfer "necessary for the performance of a contract between the data subject and the controller." This genuinely fits OneSignal (a verification email cannot be sent without transmitting the address), Google OAuth (user-initiated), and hosting. It fits **analytics much less well** — which is a second, independent reason T1.3's consent gate matters, since Art. 51 also permits transfer with explicit informed consent.

Actions:
1. Determine the actual hosting and S3 regions. **If either can be moved to the EU or BiH, do that** — it removes the problem instead of documenting it. Highest-leverage item in this phase.
2. Record the Art. 51 basis per recipient in the ROPA (Art. 32(1)(e) requires exactly this).
3. Name every recipient and destination country in the privacy policy (fixes F17 too).
4. Set a calendar reminder to re-check for Agency SCCs and adequacy decisions each quarter; migrate to Art. 48 once available.

#### T4.2 — Processor agreements · F13 · Art. 30(3)
Art. 30(3) requires a **written contract** with each processor covering subject matter, duration, nature and purpose, data types, categories of data subjects, and the controller's rights. Every vendor above publishes a standard DPA. Accept each one, save the PDF, and record the date and version in `docs/legal/processors.md`.

Note Art. 30(1): we may only use processors providing "sufficient guarantees." Accepting published DPAs from established vendors satisfies this at our scale — but it has to actually be done and filed, not assumed.

---

## 5. Documents to write

Live in `docs/legal/`, in git. Art. 7(2) puts the burden of demonstrating compliance on us; version history is the evidence.

### 5.1 Rewrite the privacy policy · F14, F15, F16, F17
`apps/web/src/app/[locale]/(public)/privacy-policy/page.tsx` is structurally decent but missing mandatory Art. 15 content. Add:

- **15(1)(a) — controller identity and contact.** This is where having no legal entity bites: the controller is a named natural person. Art. 15(1)(a) requires "identity and contact details" — **name plus a working contact address satisfies this; a home address is not required.** Publish name + `privacy@reconned.com`. Also add explicit wording that the controller is a private individual operating the platform non-commercially — this is genuinely relevant context under Art. 113(2)(a).
- **15(1)(c) — legal basis, stated per purpose.** Currently absent entirely. Proposed mapping:

  | Purpose | Basis |
  |---|---|
  | Account, profile, authentication | Art. 8(1)(b) contract |
  | Club membership, event registration | Art. 8(1)(b) contract |
  | Transactional email (verification, password reset, event notices) | Art. 8(1)(b) contract |
  | Security, abuse and fraud prevention | Art. 8(1)(f) legitimate interest |
  | Analytics | **Art. 8(1)(a) consent** |
  | Instagram club feed | Art. 8(1)(a) consent (club-initiated) |

  Any Art. 8(1)(f) reliance needs a written balancing test — brief is fine, but it must exist (§5.3).
- **15(1)(e) — named recipients** with destination countries (from T4.1).
- **15(2)(a) — retention periods** (from T3.1), matching the code and the ROPA exactly.
- **15(2)(b) — the rights**, with a working route to exercise each.
- **15(2)(c) — right to withdraw consent**, and how (points at T1.3's persistent control).
- **15(2)(d) — right to lodge a complaint with the Agency**, with contact details:
  > Agencija za zaštitu ličnih podataka u Bosni i Hercegovini
  > Dubrovačka 6, 71000 Sarajevo
  > azlpinfo@azlp.ba · +387 33 726 250
- **15(2)(e) — whether providing data is a contractual requirement** and the consequences of not providing it.
- **15(2)(f) — automated decision-making.** State plainly that there is none.
- **Fix the "anonymized where possible" line** (T1.2).
- Keep all three locale versions (`en`/`bs`/`sr`) in sync and bump `PRIVACY_POLICY_LAST_UPDATED`.

### 5.2 Record of processing activities · F11 · Art. 32
`docs/legal/ropa.md`. Art. 32(5)'s small-organisation exemption is unavailable (processing is not occasional). Art. 32(1) mandates: (a) controller identity and contact; (b) purposes; (c) categories of data subjects and personal data; (d) categories of recipients incl. those in other countries; (e) transfers with the identified country and documented safeguards; (f) envisaged erasure time limits; (g) general description of Art. 34 security measures.

Art. 32(3) permits electronic form. Art. 32(4) requires making it available to the Agency on request — so it must be current, not written once.

Data subject categories: registered users; club members; event participants; **guest attendees** (F8); club claim requesters; visitors (analytics).

### 5.3 Legitimate interest assessments · Art. 8(1)(f)
`docs/legal/lia-security.md`. One page: purpose, necessity, balancing against user rights, safeguards. Required for the security/abuse-prevention basis. **Analytics is deliberately not on this list** — attempting to justify analytics under legitimate interest instead of consent is the single most common mistake in this area, and it doesn't survive scrutiny.

### 5.4 DPIA screening · Art. 37
`docs/legal/dpia-screening.md`. Still expected to be a written negative screening rather than a full assessment: no Art. 11 special categories, no systematic monitoring of a publicly accessible *area*, no Art. 24 automated decisions with legal effect, small user base, non-commercial.

**Session replay (T1.4) is now the hardest fact in this document and has to be argued, not mentioned.** Recording what every consenting user does on screen is the closest this platform comes to Art. 37(1) "systematic monitoring", and the screening is not credible if it leaves that implicit. The argument against high risk: replay runs only on consent that names it, inputs are masked, third-party PII on screen is masked, no special categories are involved, and the population is small. Set against event geolocation, that combination should stay below the threshold — but write down the reasoning, and revisit it if replay is ever un-masked, extended to network payloads, or the user base grows materially.

### 5.5 DPO assessment · Art. 39
`docs/legal/dpo-assessment.md`. Two paragraphs recording that Art. 39(1)(a)–(c) are each not met, with the reasoning from §1.4. Re-evaluate if the user base grows substantially.

### 5.6 Breach response procedure · F12 · Arts. 35, 36
`docs/legal/breach-response.md`. Art. 35(1): notify the Agency **without undue delay and no later than 72 hours** after becoming aware, unless unlikely to result in risk to rights and freedoms. Art. 35(1) also requires that if the 72 hours are missed, we supply written reasons for the delay. Art. 36: notify affected users directly where the risk is high.

For a solo operator the realistic failure mode is not knowing a breach happened, so the procedure must cover detection, not just notification. Must include: what counts as a breach (including accidental loss and unauthorised disclosure, not just intrusion); the Art. 35(3) content requirements (nature, approximate number of subjects and records, DPO/contact point, likely consequences, measures taken); a pre-drafted Agency notification template; a pre-drafted user notification template; and an internal breach log — Art. 35(5) requires documenting **every** breach, including ones not notified, with the reasoning.

`SECURITY.md` currently covers vulnerability reports only. Cross-link the two; they are different processes.

### 5.7 Data subject request procedure
`docs/legal/dsr-procedure.md`. One-month deadline (Art. 14(3)), extensible by two with reasons. Identity verification before disclosure — an access request is a data-exfiltration vector if answered carelessly. Free of charge for the first request (Art. 14(5)). Log every request and its resolution date.

### 5.8 Processor register
`docs/legal/processors.md`. Per T4.2: vendor, purpose, data categories, destination country, DPA version and acceptance date, transfer basis.

---

## 6. Decisions needed

1. **Inactive account retention.** ✅ **Decided 2026-08-04: keep until the user deletes, no dormancy reaper.** This reverses the plan's original recommendation (warn at 24 months, delete at 30), and on better reasoning.

   Art. 7(1)(e) caps retention at what is necessary *for the purpose* — and while an account can still be logged into, the purpose has not ended. "For as long as your account exists" is a stated retention period, not the absence of one, and it is what the overwhelming majority of platforms rely on. The original recommendation treated indefinite retention as needing special justification; it does not. What needs justification is failing to state the period, which is now fixed.

   The genuinely arguable case is the *abandoned* account — signed up years ago, never returned. Some EU regulators (CNIL most explicitly) recommend acting on multi-year inactivity; this is guidance rather than a rule, none of it is BiH guidance, and there is no enforcement pattern at hobby-platform scale. Against that soft edge, a reaper would destroy club rosters, attendance history, and **reviews written about other people** — real harm to identifiable third parties, which is a poor trade.

   The residual concern is better characterised as **visibility, not retention**: a dormant *public* profile is a searchable page about someone who stopped participating, while a dormant private one is a database row. That is T3.5's problem, and fixing the public-by-default setting largely answers it. If a nudge is ever wanted, the proportionate version is a dormancy *email* at a long horizon — "still want this? here is your data, here is how to delete" — which demonstrates the question was considered without deleting anyone's history for them.
2. **Publishing a personal name.** Art. 15(1)(a) requires identifying the controller. As an individual this means a real name on a public page. There's no way around it while operating personally — but name + email is sufficient; no home address is required. *Confirm you're comfortable with this.*
3. **Forming a legal entity.** Out of scope for this plan, but relevant: an entity would move Art. 113 liability off you personally and turn the flat BAM 20,000+ floor into a turnover-based cap that is near zero for a non-revenue project. Worth pricing an *obrt* against expected effort. Not a reason to delay any of the above — the engineering work is identical either way.
4. **GDPR EU representative** — see §7.1.
5. **Hosting and S3 region.** Where are they actually? Moving to the EU materially simplifies Phase 4.
6. **Do we need `guestEmail` at all?** Dropping it removes T3.3 entirely.
7. ~~Session replay.~~ **Decided 2026-08-04: keep it**, under the conditions in T1.4.

---

## 7. Open legal questions

### 7.1 Does GDPR apply, and does Art. 27 bite?
If the platform "targets" EU data subjects under GDPR Art. 3(2), GDPR applies alongside ZZLP. Substantively that costs nothing extra — the obligations are the same and this plan satisfies both. But **GDPR Art. 27 requires a designated EU representative**, which for an individual means paying a service provider (typically €300–1,500/year).

Art. 27(2)(a) exempts processing that is "occasional, does not include large-scale processing of special categories … and is unlikely to result in a risk to the rights and freedoms of natural persons." Continuous platform operation is likely not "occasional," so the exemption is doubtful if Art. 3(2) is met at all.

The threshold question is *targeting*: offering BS/SR/EN locales for a Balkan sport isn't automatically targeting Croatia or Slovenia, but accepting EU-based registrations, listing EU events, or marketing across the border pushes toward it. **This needs a lawyer's view — it's the one item here with a recurring cash cost.** Everything else in this plan should proceed regardless of the answer.

### 7.2 Agency SCCs and adequacy decisions
Neither exists yet (§T4.1). We proceed on Art. 51 derogations and migrate when the Agency publishes. Re-check quarterly.

### 7.3 Art. 10(2) "reasonable efforts" for age verification
No BiH guidance yet on what satisfies this for a small platform. We interpret an unticked affirmative declaration as reasonable at this scale (T3.2). Revisit if the Agency issues guidance or if the platform grows.

---

## 8. Sequencing

```
Week 1   T1.2 policy correction  ──►  T1.1 strip PII  ──►  T1.3 consent gate
Week 2-3 T2.1 export  ──┬──►  T2.2 complete erasure
                        └──►  T2.3 manual rights procedure (§5.7)
Week 3-5 T3.1 retention  ──►  T3.2 registration notice  ──►  T3.3 guest notice
         T3.4 encrypt IG tokens        T3.5 default visibility
Week 5-6 T4.1 transfer mapping  ──►  T4.2 processor DPAs
Week 6-7 §5 documents  ──►  §5.1 privacy policy rewrite (depends on T3.1, T4.1)
```

T1.2 first — it's one line and removes a false public statement. T1.1 and T1.3 next; they're the ongoing violations. The privacy policy rewrite lands **last**, because it must state retention periods (T3.1) and named recipients (T4.1) that don't exist until those are decided. Writing it earlier means writing it twice.

Comfortably inside the ~Feb 2027 Art. 116(2) deadline with room to spare.

---

## 9. Definition of done

- [x] No analytics request fires before consent; withdrawal ≤2 clicks from any page *(T1.3)*
- [x] Session replay is disclosed by name, masks all inputs, and masks every rendered email, phone and IP — *disclosure lives in the policy's own `Session Recordings` section rather than the banner, by decision on 2026-08-04; see T1.4 for the residual risk that carries* *(T1.4)*
- [ ] No email address or name reaches PostHog; historical PII purged there — *code done (T1.1); the **historical purge is still outstanding** and is a manual PostHog-console job*
- [x] `GET /users/:id/export` returns complete, self-only, secret-free JSON *(T2.1)*
- [x] Both rights are discoverable to a user who isn't looking for them — export and deletion are advertised on the homepage feature grid and linked to `/dashboard/user/security` *(T2.1, T2.2)*
- [ ] Deleting an account leaves no PII in Postgres, S3, PostHog or OneSignal — *Postgres and S3 done; PostHog done in code but **needs `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_IDS` set in Coolify** to take effect, and recordings may outlive the person; OneSignal blocked on `mail.ts` aliasing (T2.2)*
- [ ] `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_IDS=110262,42900` set in Coolify for the backend service
- [ ] Replay retention period set in the PostHog `web` project as a backstop, and a deleted test account's recordings re-checked days later
- [x] Scheduled tasks enforce every retention period in §T3.1 — *sessions, verification tokens and audit-log IP/UA enforced and tested; accounts kept for their lifetime by decision (§6.1), so there is nothing to schedule (T3.1)*
- [ ] Retention periods stated in the privacy policy as Art. 15(2)(a) requires — *unblocked by T3.1; belongs to the §5.1 rewrite*
- [ ] Registration collects an affirmative age declaration and links both legal pages
- [ ] Privacy policy satisfies every Art. 15(1) and 15(2) item, in all three locales
- [ ] `docs/legal/` contains ROPA, LIA, DPIA screening, DPO assessment, breach procedure, DSR procedure, processor register
- [ ] Every processor DPA accepted, dated and filed
- [ ] Transfer basis recorded per recipient
- [ ] Instagram tokens encrypted at rest

---

*This plan is an engineering reading of the statute, not legal advice. §7.1 (EU representative), §T4.1 (transfer basis), and §1.3 (personal liability exposure) should be confirmed with a BiH data protection lawyer before being relied on. The remaining items are standard practice and low-risk to implement without further advice.*
