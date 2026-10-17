# U05.01 — IFTTT inbound acceptance checkpoint

Historical read-only checkpoint. The later [local integration handoff](integration.md) supersedes the local-code state and proposed route names below: the accepted exact-case routes have now been restored locally. Production and authentic inbound acceptance remain open. Original read-only receipts are retained unchanged.

**Disposition: cannot close.** As of 2026-10-15 05:11 UTC, neither DFOFantasy nor NHL_Rosters has an established account-to-endpoint mapping or an authentic, linked inbound receipt in the evidence inspected. Generic receiver tests and receipts from other accounts do not satisfy this acceptance.

Parent: `01a10d0c-2480-73ea-aa65-3be0547bd0d5`. Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. This checkpoint is before the requested 07:02 UTC deadline.

## Ownership and scope

Read `AGENTS.md`, `SPRINT-MODE.md`, `mise-en-place.md`, current dirty status, and current thread inventory before working. The local `.agents/skills` directory is absent; the available `/Users/tim/.agents/skills/reverse-engineer-anything/SKILL.md` says ordinary source-repository analysis should use normal repository tools, so REA was not run. Supabase and Vercel inspection skills were read for the bounded metadata/database checks.

This task owns only this evidence directory. Parser, identity, and unrelated dirty files are preserved. The authoritative task list containing U05.01 was not found in the searched local task lists; its path/excerpt was requested asynchronously. The parent remains the register writer. No replacement task list was created, and no checkbox was changed.

## What is established

| Evidence layer | Observation | What it does not establish |
| --- | --- | --- |
| Current local routing | Four receiver wrappers exist: GameDayLines, GameDayGoalies, GameDayNewsNHL, CCC. No DFOFantasy or NHL_Rosters wrapper was found. | The desired mapping or an upstream applet's saved settings. |
| Deployed source | Vercel identifies READY production deployment `dpl_HxdhE1sPUQM9RXaBuUJK1y4VFcPW`, commit `90d3d5963f47dccfe690d5582dae3d23a598e16d`, branch `master`, with `fhfhockey.com` and `www.fhfhockey.com` among its aliases. The four receiver wrappers, shared receiver, and `update-line-sources.ts` have identical Git blobs in that commit and the current working tree. | An application route was not invoked. Metadata and source correspondence do not prove a particular request executed on this deployment. |
| Local execution | `npm test -- --run lib/sources/lineSourceIftttReceiver.test.ts` passed 9/9 tests on Node 22.11.0. | These are mocked generic GameDay receiver tests, with no DFOFantasy or NHL_Rosters case; they are not inbound or deployed acceptance. |
| Retained raw queue | The recent-window query returned 1,247 rows, below its 5,000-row cap: GameDayLines 509, GameDayNewsNHL 478, GameDayGoalies 260. No target account matched account, username, or tweet-URL fields. No target handle appeared in recent relay text. | This is not proof that an upstream applet does not exist or that no event exists under an unknown spelling or in another store. |
| Historical requested-account check | Exact common account/key/username variants returned zero raw-event matches; the corresponding snapshot search returned zero. | No IFTTT run/activity receipt was available to prove origin, endpoint, or successful delivery for either target account. |
| Positive control linkage | Three existing GameDay events link to their stored snapshots by both the processing receipt's `captureKey` and snapshot `metadata.iftttEventId`. | They cannot be substituted for DFOFantasy or NHL_Rosters acceptance. A raw row labeled `ifttt` alone does not authenticate its upstream delivery. |

Exact SQL, selected results, local test output, deployment metadata, and file hashes are in [receipts.json](receipts.json). Database observations occurred at 05:09:07, 05:10:32, and 05:11:13 UTC. The recent query used a fixed 2026-10-01 through 2026-10-15 05:25 UTC bound; the result's earlier `observed_at` is the actual evidence cutoff.

### Exact existing routes

All paths below are relative to `https://fhfhockey.com`. They accept POST, authenticate a configured receiver secret, and store before optionally processing.

| Account default | Receiver path | Fixed source key | Table / processor |
| --- | --- | --- | --- |
| GameDayLines | `/api/v1/sources/ifttt/gamedaylines-tweet` | `gamedaylines` | `line_source_ifttt_events` / `/api/v1/db/update-line-sources` |
| GameDayGoalies | `/api/v1/sources/ifttt/gamedaygoalies-tweet` | `gamedaygoalies` | Same generic table / processor |
| GameDayNewsNHL | `/api/v1/sources/ifttt/gamedaynewsnhl-tweet` | `gamedaynewsnhl` | Same generic table / processor |
| CcCMiddleton | `/api/v1/sources/ifttt/ccc-tweet` | `ccc` in handler response; not persisted as a column in the legacy queue | `lines_ccc_ifttt_events` / `/api/v1/db/update-lines-ccc` |

The three generic wrappers use `source_group=gdl_suite`. Their secret variable names are respectively `IFTTT_GAMEDAYLINES_WEBHOOK_SECRET`, `IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET`, and `IFTTT_GAMEDAYNEWSNHL_WEBHOOK_SECRET`; CCC uses `IFTTT_CCC_WEBHOOK_SECRET`. No secret values were retrieved.

Important provenance limitation: `lineSourceIftttReceiver.ts:243` accepts a payload override of `source_account`, but `source_key` remains the endpoint configuration at line 260. There is no matching-account check in this receiver. Consequently, an account string alone cannot prove account-specific routing. A 200 response can also report `processed_attempted` even when the follow-up processor failed; acceptance must examine the processor result and persisted linkage separately.

All 509 recent GameDayLines rows still carry literal `source_account=SOURCE_ACCOUNT` and `username=GameDayLines`. This reproduces the payload drift documented in the existing GDL runbook/task list. It is a separate known issue, not evidence for the requested sources, and was not repaired here.

### Linked positive controls

| Source key | Raw event ID | Tweet ID | Result |
| --- | --- | --- | --- |
| `gamedaylines` | `6cac29e2-e13d-4b0b-b296-10a8047d2fa2` | `2110527985757601916` | Raw processed; linked lineup snapshot, accepted; both IDs match; account label remains `SOURCE_ACCOUNT`. |
| `gamedaygoalies` | `085af12d-748d-4a93-b949-82c95db7957d` | `2110437831697141776` | Raw processed; linked goalie_start snapshot, accepted; both IDs match. |
| `gamedaynewsnhl` | `4a196361-9a60-4a8d-b42d-f8d7d052008b` | `2110580632707559765` | Raw processed; linked other snapshot, accepted; both IDs match. |

These controls were already stored. No tweet was replayed or submitted.

## Smallest exact verification / repair proposal

First resolve the authoritative U05.01 wording and expected source mapping. Do not silently mark an older GameDay route or a relayed mention as a dedicated DFOFantasy/NHL_Rosters integration.

1. **Read existing configuration and activity only.** For each of the two applets, retain a credential-free record of applet ID, enabled state, exact watched X username, destination hostname/path, POST, JSON keys/ingredients, secret header name, and a boolean that a binding is present. Retain the existing natural delivery's run ID, UTC time, tweet ID, and HTTP outcome if available. Do not click a test, replay, refresh-ingestion, or “check now” action. Do not capture a raw settings page or secret-bearing URLs/headers.
2. **If dedicated routes are intended, prepare this narrow candidate for review.** Proposed new wrappers are `web/pages/api/v1/sources/ifttt/dfofantasy-tweet.ts` (`sourceKey=dfofantasy`, `sourceAccount=DFOFantasy`, `IFTTT_DFOFANTASY_WEBHOOK_SECRET`) and `web/pages/api/v1/sources/ifttt/nhl-rosters-tweet.ts` (`sourceKey=nhl_rosters`, `sourceAccount=NHL_Rosters`, `IFTTT_NHL_ROSTERS_WEBHOOK_SECRET`). Reuse the generic receiver/table/processor; add route-level mocked tests for the exact mapping and same-tweet cross-source dedupe, and document the approved mapping. These names are a proposal, not observed configuration. The current follow-up omits `sourceGroup` and the processor defaults to `gdl_suite`; keep that existing compatibility group unless a different group is explicitly designed and tested. Current periodic retry code names only the three GameDay keys and CCC, so any requested periodic recovery for new sources must be reviewed separately with its added invocation budget. Do not change parser files or add aliases.
3. **Keep external work gated to a later authorized release.** Creating/changing applets, secret bindings, publishing routes, enabling new retry calls, and deploying require their own approval. This task does not authorize them. Existing GDL documents also retain historical provider-key retirement gates; their present disposition must be resolved from current owner evidence before assuming they are cleared.
4. **Verify an ordinary inbound delivery for each exact source.** After any separately approved configuration/release, use one naturally occurring, relevant tweet per source. Match the upstream applet/run and target path to its raw queue row by tweet ID and time, confirm the fixed `source_key` and exact `source_account`/`username`, and join `raw_payload.lineSourceProcessing.captureKey` to `line_source_snapshots.capture_key` and `metadata.iftttEventId` to the raw event UUID. Retain the actual classification/filter result; a legitimate rejection is not a successful parsed-lineup acceptance. Record deployment/request linkage from existing metadata/logs where available. Stop once both acceptance chains are conclusive.

Read-only follow-up budget: at most two applet-configuration inspections, two existing activity-item inspections, and one bounded SQL query for the two exact tweet IDs and their linked snapshots (`BEGIN READ ONLY`, 5-second statement timeout, at most two raw events and their bounded associated captures). If no natural event exists, leave the gate open. Do not manufacture one or run ingestion to make evidence appear.

Suggested parent-register disposition:

> U05.01 — **blocked / not closed**. Local generic receiver tests pass (9/9); deployed routing source matches the four existing receivers. DFOFantasy/NHL_Rosters mappings and authentic inbound receipt chains are unproven; bounded current and historical exact-name reads found no target events/snapshots. Evidence: `tasks/artifacts/ifttt-u05-01-acceptance-2026-10-15/`. Next: supply authoritative mapping and safe existing applet/activity receipts; review the two-route proposal only if dedicated routing is intended.

## Parser coordination requested during this task

The cloud reproduction used the same base commit as local HEAD, `a8f58de6178e282acd3a71851c66f4a56b119f14`, but does not include the local dirty parser changes.

| File | Current Git blob | State / relevant finding |
| --- | --- | --- |
| `web/lib/sources/tweetInterpretation.ts` | `7eeab99cbc995ba18dfa85ae55c77047db0f0351` | Modified; version `2026-10-13.1`. Recognizes one-player-per-slash slots and protects defense numbering from short forward extras. |
| `web/lib/sources/tweetInterpretation.test.ts` | `68cd240b1f89c2a3e14034df18b056ed55be32ed` | Modified; explicit slash-row and Jones–Hyman/defense ordinal regressions at lines 19 and 27. Inspected, not executed in this task. |
| `web/__tests__/fixtures/lineupSectionFixtures.ts` | `6c4d32fc9a68b1fca786d105ebea58249faac87e` | Untracked; shared Seattle/Edmonton fixtures used by those tests. |
| `web/lib/sources/playerIdentity.ts` | `fd6c5eea48433385e9e487e40b7f05a3327e5afd` | Unchanged from HEAD and deployed commit. Compact-initial gap remains in code: `B.Tkachuk` normalizes to `btkachuk`, while the initial candidate normalizes to `b tkachuk`. An explicit alias could affect a particular roster; no DB alias was read or written. |
| `web/lib/sources/playerIdentity.test.ts` | `74fc8e2a7bbed56877d2897e7a910ddcb0517738` | Unchanged; tests spaced initials and ambiguity, not compact initials. |
| `web/lib/sources/playerNameAliases.ts` | `67862dcc6935cd41e2781418403decbb4b23afc2` | Unchanged. |

Adjacent pre-existing dirty paths: `lineSourceProcessing.ts/.test.ts`, `linesCccIngestion.ts/.test.ts`, `lineupSourceIngestion.ts/.test.ts`, and `tweetPlayerEvents.ts`. Their current Git blob/SHA-256 hashes are in the receipt manifest. Preserve them when preparing any cloud patch. The slash/extras changes are local code evidence, not deployed or runtime verification.

## Verification, operations, and handoff

- **Passed:** one receiver Vitest file, 9 tests; focused unchanged-routing diff check; receipt JSON parse and artifact integrity validation.
- **Not run:** parser tests, broad suites, type-check, lint, local build, browser execution, or application probes. This is an evidence-only change.
- **Read-only remote operations:** one Supabase project listing; four SQL calls (schema and three evidence queries, each in a read-only transaction with a 5-second statement timeout); one Vercel deployment list and one deployment detail lookup.
- **Zero:** application/ingestion/cron requests, DB/alias writes, tweet replays, applet or credential changes, builds/deployments triggered, pushes, parser edits, and FORGE sealed-outcome dataset inspection.
- Existing retained Oct. 1 evidence was inspected for its stated scope/limits; none supplies the missing target-account acceptance. The optional Supabase changelog fetch returned an unsupported-content-type error; no Supabase feature or schema was implemented and this did not block the read-only queries.
- No owned process remains running. Only this evidence directory was created. Parent register reconciliation and the two authentic target-source receipt chains remain outstanding.
