# Auth document audit — continuation segment01

**Bounded full-read segment complete; whole-tree audit remains unfinished.** Canonical master/ledger, Library and the original checkpoint receipts were read-only throughout this segment. Findings below are proposals for parent vetting; none was applied or dispatched.

Read **9 unique documents, 1264 lines / 200453 bytes**, including all three queued auth source documents and six selected cited/claim-relevant receipts. Exact hashes, full ranges and limits are in COVERAGE.json. No file was merely keyword-scanned and then called fully read. All reads were UTF-8 documentary text; no raw credential, mailbox, private export, DB/provider, browser or screenshot operation. No inspected runbook/script was executed.

## New findings and corrections

| Finding | Canonical destination | Result |
| --- | --- | --- |
| SEG01-DOC-01 — Current auth manual checklist contradicts its own later completion receipts | REPO-DOCUMENTATION, AUTH-PKCE-COMPLETION | confirmed_documentary_status_conflict |
| SEG01-DOC-02 — Auth PRD still presents superseded provider-storage and Patreon-feature policy as current | REPO-DOCUMENTATION, SITE-PRIVACY-POLICY | confirmed_documentary_policy_conflict |
| SEG01-AUTH-03 — Durable, browser-bound Patreon OAuth transaction gate has no explicit205-ID home | Proposed AUTH-PATREON-TRANSACTION | proposed_missing_gate_unverified_current |
| SEG01-ACL-04 — Three ranking-table ACL scopes are distinct from the current two-table residual | SECURITY-RESIDUAL-ACL, MASTER-D4 | proposed_existing_id_scope_refinement |
| SEG01-IFTTT-05 — Header-only receiver transition is a separately retained IFTTT activation gate | IFTTT-ACTIVATION | proposed_existing_id_scope_refinement |
| SEG01-PRIVACY-06 — Approved credential storage does not supply account-deletion UX or universal-erasure proof | SITE-PRIVACY-POLICY | scope_qualification_existing_id |

## SEG01-DOC-01

Manual lines146/152/159/165–171 still call localhost and email callback/recovery work open. Its own lines7/9 and task-list5/165–167 establish narrower completed historical milestones. Full current Google PKCE completion remains intentionally open at task344; the July31 Google receipt is not a later PKCE completion.

**Bounded next action:** After the frozen review, reconcile only current manual/PRD summary/checklist wording to dated receipts. Preserve chronological historical paragraphs and the distinct Google PKCE gate. No new auth test or provider action.

**Gate:** No new provider/session/production authority; ordinary documentary correction only after canonical review freeze ends.

Evidence fully read at the recorded hashes:
- [tasks/TASKS/auth-user-settings-platform/docs/auth-provider-manual-config.md:7](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/docs/auth-provider-manual-config.md:7) (through line9); SHA256 `05b8f6fe4e9bf4ca058c0d9152240aef3736376893a84522e6ede98f283f16aa`.
- [tasks/TASKS/auth-user-settings-platform/docs/auth-provider-manual-config.md:140](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/docs/auth-provider-manual-config.md:140) (through line171); SHA256 `05b8f6fe4e9bf4ca058c0d9152240aef3736376893a84522e6ede98f283f16aa`.
- [tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:5](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:5) (through line5); SHA256 `ac0dd1f3f04d6a2b441a2f34ced68709e2090bc6a545d3461f2d89300aedd151`.
- [tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:155](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:155) (through line167); SHA256 `ac0dd1f3f04d6a2b441a2f34ced68709e2090bc6a545d3461f2d89300aedd151`.
- [tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:344](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:344) (through line344); SHA256 `ac0dd1f3f04d6a2b441a2f34ced68709e2090bc6a545d3461f2d89300aedd151`.

## SEG01-DOC-02

PRD15/76/86/131/133/296/318 retains credential-free ESPN/Fantrax and no-concrete-Patreon-feature claims. Current task-list249–256/263/323–330/360–361 explicitly records October19 owner supersession; full R-SECURITY-MATRIX46–52 and R-CREDENTIALS-PROPOSAL63–67 confirm the kept existing paid mapping and named linked-lifetime storage contract. These accepted decisions must not be reopened.

**Bounded next action:** After freeze, append an exact current-policy overlay/cross-reference to the PRD and factual privacy inventory. Preserve historical decisions and no new tiers/purpose/retention promises.

**Gate:** No credential value handling, rotation, provider operation, entitlement change or deletion. New policy choices require direct owner authority; this correction simply preserves recorded choices.

Evidence fully read at the recorded hashes:
- [tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:15](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:15) (through line15); SHA256 `9b2b743962f86b50b74a3c34ddf571d6f183d41463aa2d792a6b21bc4b5c9851`.
- [tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:76](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:76) (through line86); SHA256 `9b2b743962f86b50b74a3c34ddf571d6f183d41463aa2d792a6b21bc4b5c9851`.
- [tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:128](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:128) (through line135); SHA256 `9b2b743962f86b50b74a3c34ddf571d6f183d41463aa2d792a6b21bc4b5c9851`.
- [tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:287](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md:287) (through line318); SHA256 `9b2b743962f86b50b74a3c34ddf571d6f183d41463aa2d792a6b21bc4b5c9851`.
- [tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:249](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:249) (through line263); SHA256 `ac0dd1f3f04d6a2b441a2f34ced68709e2090bc6a545d3461f2d89300aedd151`.
- [tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:323](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:323) (through line330); SHA256 `ac0dd1f3f04d6a2b441a2f34ced68709e2090bc6a545d3461f2d89300aedd151`.
- [tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:360](/Users/tim/Code/fhfhockey.com/tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md:360) (through line361); SHA256 `ac0dd1f3f04d6a2b441a2f34ced68709e2090bc6a545d3461f2d89300aedd151`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:46](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:46) (through line52); SHA256 `35a4ffe308ada5d9706dd61fe5b60eeab09ecaa15e02f5e7af9259994efb70bd`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-CREDENTIALS-PROPOSAL.md:63](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-CREDENTIALS-PROPOSAL.md:63) (through line67); SHA256 `e154bbdd62968d7eb2013bd9b7dad5b7268914aa8bd951c720d80e5dbddc194c`.

## SEG01-AUTH-03

C-PATREON3/29–44 explicitly leaves F4 durable consume/browser binding/authenticated-user comparison open while crediting F5 return-path fixes. R-SECURITY-MATRIX44/48/52 and master-local27 retain that schema-fenced dependency. No explicit Patreon/OAuth transaction scope is present in current205row fields or the whole master text. Current implementation/hosted state has not been re-audited, so this is a retained gate proposal, not a newly proven vulnerability.

**Bounded next action:** Parent first reconciles any later source/receipt supersession. If still open, give the exact transaction/consume/auth-binding contract a stable row and reviewable local implementation proposal, preserving F5 and the approved paid-feature mapping.

**Gate:** Exact local source/schema/type lease before implementation; separately approved isolated DB concurrency setup, migration application, hosted/provider lifecycle and release. No provider PKCE capability assumed.

Evidence fully read at the recorded hashes:
- [tasks/codex-sprint-2026-10-19/security-patreon/HANDOFF.md:3](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/security-patreon/HANDOFF.md:3) (through line3); SHA256 `f2c2ba189e6438603b40a6df147a63279251370046b1e7dc9fb55e006b3ba9b7`.
- [tasks/codex-sprint-2026-10-19/security-patreon/HANDOFF.md:29](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/security-patreon/HANDOFF.md:29) (through line44); SHA256 `f2c2ba189e6438603b40a6df147a63279251370046b1e7dc9fb55e006b3ba9b7`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:44](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:44) (through line52); SHA256 `35a4ffe308ada5d9706dd61fe5b60eeab09ecaa15e02f5e7af9259994efb70bd`.
- [tasks/codex-sprint-2026-10-19/master-local/MASTER-RECONCILIATION.md:27](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/master-local/MASTER-RECONCILIATION.md:27) (through line27); SHA256 `77e611c0c7a0cee164561e7a31cac3d53019c46e98cf795b0597e07426dc7c92`.

## SEG01-ACL-04

The fully read October19 security matrix separately retains entity_metric_rankings, metric_definitions and skater_composite_ratings at lines12/24–36. R-RECEIPTS21–34 repairs exactly four provider-linkage tables and keeps two other provider tables open. Current SECURITY-RESIDUAL-ACL names those two plus a destructive-RPC receipt, and neither its text nor another205row explicitly retains the three ranking tables. This source-only dated claim is not current effective-privilege proof.

**Bounded next action:** After freeze, parent reviews an explicit related child scope under SECURITY-RESIDUAL-ACL (or deliberately chooses a separate stable ID). First reconcile any later D4/migration/closure receipt; preserve intended public reads/service writers and all already repaired tables.

**Gate:** No schema or production query from audit. Any future forward migration/local SQL fixture/hosted catalog read/application requires exact assigned scope and separate authority.

Evidence fully read at the recorded hashes:
- [tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:12](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:12) (through line12); SHA256 `35a4ffe308ada5d9706dd61fe5b60eeab09ecaa15e02f5e7af9259994efb70bd`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:24](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:24) (through line36); SHA256 `35a4ffe308ada5d9706dd61fe5b60eeab09ecaa15e02f5e7af9259994efb70bd`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-RECEIPTS.md:19](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-RECEIPTS.md:19) (through line34); SHA256 `4bd572d4d018581c95ce5f5dcf3b2a01cd85a8bd0aca52e804d3e02d4a39d405`.

## SEG01-IFTTT-05

The full October19 security matrix16/60–62 separately retains query-secret fallback and header-only migration/provider proof under the existing IFTTT owner. The205master has no explicit query-secret/header-only clause. Current receiver implementation and applet state were not inspected in this segment. Do not manufacture a current credential disclosure from this dated source.

**Bounded next action:** Retain the exact transition/compatibility/owner-evidence clause under IFTTT-ACTIVATION after frozen review. Reconcile newer receiver/app-wrapper receipts before proposing work; keep historical-key retirement and no-new-event holds distinct.

**Gate:** No receiver edit, applet change, key probe, secret read, provider event or live capture in audit. Any migration/live acceptance needs exact owner scope.

Evidence fully read at the recorded hashes:
- [tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:16](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:16) (through line16); SHA256 `35a4ffe308ada5d9706dd61fe5b60eeab09ecaa15e02f5e7af9259994efb70bd`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:60](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-SECURITY-MATRIX.md:60) (through line62); SHA256 `35a4ffe308ada5d9706dd61fe5b60eeab09ecaa15e02f5e7af9259994efb70bd`.

## SEG01-PRIVACY-06

Full policy receipt27–31/57–59/65–67 approves linked-lifetime use and same-purpose replacement under its exact contract, while explicitly leaving user-facing account-deletion workflow, hosted cleanup parity, backups/logs/derived-data removal and provider rights unqualified. This is not a request to add a new account-deletion feature or change accepted lifetime policy.

**Bounded next action:** Carry these exact unknown factual questions into the existing privacy owner fact sheet; remove no data, change no retention period, and make no verified-total-erasure promise.

**Gate:** No credential/account access or provider/production/deletion operation; new legal/privacy/rights policy choices remain owner-held.

Evidence fully read at the recorded hashes:
- [tasks/codex-sprint-2026-10-19/continuation-review/R-CREDENTIALS-PROPOSAL.md:22](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-CREDENTIALS-PROPOSAL.md:22) (through line31); SHA256 `e154bbdd62968d7eb2013bd9b7dad5b7268914aa8bd951c720d80e5dbddc194c`.
- [tasks/codex-sprint-2026-10-19/continuation-review/R-CREDENTIALS-PROPOSAL.md:55](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-CREDENTIALS-PROPOSAL.md:55) (through line67); SHA256 `e154bbdd62968d7eb2013bd9b7dad5b7268914aa8bd951c720d80e5dbddc194c`.

## Closures preserved and deduplication

- All **7 unchecked source clauses** map to existing IDs: NEW17.0–17.3 and NEW51→AUTH-LEGACY-CONTAINMENT; NEW46→AUTH-PKCE-COMPLETION; NEW55→SECURITY-RESIDUAL-ACL. The source has206checked/7unchecked clauses; counts are mechanical accounting, not proof of206behaviors.
- The one new stable-ID candidate is **AUTH-PATREON-TRANSACTION**, proposed only. Remaining findings refine/correct existing scope. REGISTER-DEDUPLICATION.json records exact205-row/whole-master clause checks; absence is not a current application-security finding.
- Auth NEW52 token-vault replay repair, NEW53 current Patreon feature mapping, NEW54 stored-credential policy and NEW56 sessionless public reads retain their narrower closure. Do not reopen them from older G1audit or PRD prose.
- Production/localhost Google milestones before PKCE and Aug1email PKCE lifecycle completion remain distinct from the still-open later full Google PKCE completion. No request to repeat provider/email checks.
- Yahoo production HTTPS/provider foundation and its explicit localhost exception stay accepted; the separate global-history/equivalence/legacy-owner gate remains YAHOO-HISTORY-RETIREMENT.
- Anonymous valid comment submissions have an explicit later owner acceptance in the current security matrix. Older G1“needs auth/CAPTCHA” wording does not create new work. API-error local fixes and Patreon F5 safe-return patch remain credited; none is a broader hosted acceptance.

## Coverage, exclusions and evidence limits

The cited R-CREDENTIALS-PROPOSAL.md had a prior filename-based sensitive exclusion in the frozen index. In this segment it was first checked for literal private-key/JWT/live-key patterns (none exposed), then fully read as the explicitly cited **value-free policy/decision receipt**. The original exclusion record was not altered. Actual credential-availability artifacts, .env files, raw tokens, mailbox material and private captures remain excluded. A pattern check alone is not a secret-free certification. New notes copy no historical private league/account names or values.

Underlying PostgreSQL fixture JSON, the complete retained catalog export, Chef apply register and several nested reports were not fully reviewed here. Their exact paths are listed as referenced-unreviewed in CONTINUATION.json. All tests/applies/hosted statements above remain attributed to dated authors; this audit ran none and does not assert current hosted grants, OAuth behavior or total account-deletion guarantees.

## Next segment and custody

Next frozen queue cursor: `tasks/TASKS/contextual-hockey-rankings/2026-06-07-goal.md`. CONTINUATION.json is an additive exact-hash overlay on the unchanged prior queue, with named remaining nested receipts. Do not restart the global inventory, repeat application checks or spawn workers. Retain the canonical review freeze; parent decides whether/when proposed findings are reconciled into205IDs.

Validation: nine fully read hashes/ranges and all finding anchors will be rechecked at handoff; original queue/report and three canonical pins remain unchanged. No tool/action is pending, uncertain or denied in this segment. No implementation/external approval requested or inferred.
