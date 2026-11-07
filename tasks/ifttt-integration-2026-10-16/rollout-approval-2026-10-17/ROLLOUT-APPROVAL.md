# IFTTT line-report integration: status and approval package (2026-10-17)

This package is a proposal only. Nothing below has been approved, and nothing was deployed, applied, registered or activated. Each numbered approval in section 5 is a separate yes from TJ. This file supersedes the next-step text of earlier checkpoints. Their evidence is unchanged.

## 1. What survived the 2026-10-16 quota interruption

Classes: **L** = local implementation, **A** = accepted by an independent local review, **D** = deployed. **No IFTTT piece is deployed.**

- `master` (`457435eb3`, the production release) has only the four legacy receivers: gamedaylines, gamedaygoalies, gamedaynewsnhl and ccc. They use a plain upsert.
- `master` has no DFOFantasy or NHL_Rosters route and no controlled intake.
- All work below is in `octoberBranch` commit `7f094c8e6`, which the local tracking ref shows on `origin/octoberBranch`. The R21 edits are still uncommitted.

| Piece | Class | Verdict and evidence |
|---|---|---|
| Pure semantic reducer `tweetSemanticEvents.ts` (`fd043fee…`, test `6da590c6…`) | L | Owner-tested 56/56. Kept as an unchanged pinned dependency in later reviews. Corrections, retractions and compensation remain unresolved holds. |
| Held/shadow claim slice and registry (SQL1) | A | `review-v4`: R1–R9 closed |
| Occurrence identity, pure | A | `review-occurrence-v2`: R10–R13 closed |
| Durable occurrence and qualification (SQL2, SQL3) | A | `review-durable-occurrence-v3`: R14–R15 closed |
| Legacy parent recovery (CR037/CR041) | A | `review-parent-recovery-v1` |
| Transport recovery protocol | A (fixture only) | `review-transport-recovery-v1` |
| Consumer binding (SQL4) | A | `review-consumer-binding-v2`: R16–R17 closed |
| Full52 reconciliation | A (ledger only) | `review-full52-reconciliation-v1`: 50/52 rows and 225/227 assertions. CR011 and CR051 are held by policy. This is **not** integrated full52. |
| Raw job acknowledgment fix | A | `review-raw-job-ack-v1` |
| Shadow raw ack (SQL5 replacement) | A | `review-shadow-raw-ack-postconditions-v2`: R18 closed |
| Receiver variant retention (SQL6 replacement) | A | `review-receiver-variant-retention-v2`: R19 closed |
| Bounded intake (SQL7 replacement) | A | `review-receiver-intake-bounds-v2`: R20 closed |
| **RPC deadline and read-only reconciliation (SQL8)** | **A (today)** | `../review-rpc-deadline-reconciliation-v1/REVIEW.md`: copied 130/130 plus independent 9/9; no defect. O-1 TimeZone observation recorded. |
| **R21: scheduler kept the pilot from being retain-only** | **A (today)** | `../review-scheduler-retain-only-v1/REVIEW.md`: accepted. Nearest 34/34, PG 132/132, before/after truth table with 0 mismatches, all 7 mutants killed. |
| **R22: 10-minute alias-replay cron can request processing during a pilot** | **A (today)** | Option (b): `../replay-aliases-retain-only-v1/`, accepted by `../review-replay-aliases-retain-only-v1/REVIEW.md`. It must ship with or after R21's `iftttIntakePolicy.ts` edit. Non-blocking cost: a held job is re-picked every 10 minutes during the pilot without progress, which delays same-day alias resolutions. |
| DFOFantasy and NHL_Rosters routes (U05.01) | L | Restored and verified locally. Authentic inbound acceptance is open. |
| Hosted catalog read (2026-10-16T04:43Z) | Terminal | One approved call returned guarded/incomplete aggregate counts only. No further call is authorized. |

Not recovered: missing historical `/tmp` evidence stays missing. All five FORGE consumer-dependency pins (`consumer-dependency-checkpoint-v1/pins.json`) match the live files. The reducer hashes still match.

## 2. Focused regression evidence (this session; private PG17, synthetic data, no hosted calls)

| Check | Result |
|---|---|
| Owner's 130-case deadline harness, copied (88 actual-PG, 10 SDK, 20 policy, 12 receiver) | 130/130 |
| Independent deadline cases: real loopback socket, catalog-derived PostgREST model, in-flight read, TimeZone, legacy row, cross-scope | 9/9 |
| R21 demonstration against pinned pre-fix bytes | 2/2: 6 processor requests under pilot configuration |
| After the R21 guard: nearest receiver and policy tests | 34/34 |
| After the R21 guard: copied actual-PG regression | 132/132 |
| ESLint on the 3 changed files | exit 0 |
| Scoped TypeScript (review root) | exit 0 |
| Full `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, the single allowed run, with the R21 edits in place | exit 0, no diagnostics (`../scheduler-retain-only-v1/evidence/full-tsc.log`) |
| `receiver-chain-readback.sql` before and after SQL6–8 on fixture | Before: 3 relations reported missing. After: 8 functions with the expected definer, volatility, config and ACL; 7.3 KB. |
| `pilot-window-readback.sql` on fixture (canonical, variant, exact retry) | attempts 3, admitted 2, carrier still pending |

## 3. Ready vs operationally blocked

**Locally ready for a retain-only receiver pilot:** the receivers, `iftttIntakePolicy` / `iftttReceiptRetention` / `iftttRpcDeadline`, the accepted R21 guard, and SQL6 → SQL7 → SQL8. The pilot needs **no** SQL1–5: the receiver chain depends only on the existing raw tables. SQL6–8 add new tables and functions only, with no triggers or constraints on `line_source_ifttt_events` or `lines_ccc_ifttt_events`. Applying them does not change the four live legacy receivers.

**Operationally blocked, each with its exact unblock:**

| # | Blocker | Unblock |
|---|---|---|
| B1 | No release candidate: nothing is on `master` | The release owner names one exact `master` SHA that contains the receiver/lib files and the R21 and R22 guards. Vercel cost rules apply (section 5, item 7). |
| B2 | SQL is task-local only, and `supportedBaselineMigration.test.ts` pins the active tree to `migration-authority.json` (head: order 83, `20261017183611`, applied) | The migration owner copies the three files **byte-identical**, under new timestamps after the hosted head and in order SQL6 < SQL7 < SQL8, and adds authority entries 84–86. |
| B3 | Hosted schema, ACL, owner, trigger and TimeZone facts are unknown | Two read-only calls of `receiver-chain-readback.sql` (before and after the migration) |
| B4 | Hosted PostgREST hoisting of function `statement_timeout`, and READ ONLY for STABLE functions, are unproven | Dashboard version check, then a local run against an actual PostgREST of the same version (section 5, items 3–4) |
| B5 | No approved policy values | TJ chooses the tuples, window, caps and stop owner (section 6) |
| B6 | Writer inventory and fences | Production raw writers: the 4 legacy receivers, the processors' status updates, and `replay-player-aliases`, which is a **10-minute cron** (R22), not only an operator route. Fixture grants are not proof of hosted grants. |
| B7 | No authentic applet → stored-event evidence | Natural deliveries during an approved window, compared with IFTTT applet activity (section 7) |
| B8 | Full52 | Not reachable through this pilot (section 7) |
| B9 | Processing, qualification, dispatch, replay, correction, publication | Out of scope. Each needs SQL1–5, an exact cohort, and identity/history/fence authority. |

## 4. Migration set (exact bytes; never apply the alternatives)

| Order | Purpose | Task-local file | SHA-256 | Needed for the pilot? |
|---|---|---|---|---|
| SQL1 | claim registry | `migrations/20261016024711_tweet_claim_registry.sql` | `7570300e…a7` | no |
| SQL2 | qualification | `next-increment/20261016073000_tweet_claim_qualification.sql` | `510eae12…bb` | no |
| SQL3 | occurrence identity | `durable-occurrence-increment/20261016044953_tweet_claim_occurrence_identity.sql` | `3a8815e5…6a` | no |
| SQL4 | consumer binding | `consumer-binding-increment/20261016060900_tweet_claim_forecast_delivery.sql` | `b030ca1b…00` | no |
| SQL5 | shadow raw ack (replacement) | `shadow-raw-ack-postconditions-v2/20261016073503_tweet_claim_shadow_raw_ack.sql` | `be0d24b0…9d` | no |
| **SQL6** | raw receipt variants (replacement) | `receiver-variant-retention-v2/supabase/migrations/20261016082142_ifttt_raw_receipt_variants.sql` | `789772078e3b8405539358e07413cf2fd4cf6d80a82513911bf989f8c02b0483` | **yes** |
| **SQL7** | bounded intake (replacement) | `receiver-intake-bounds-v2/supabase/migrations/20261016085537_ifttt_bounded_receipt_intake.sql` | `ab5d686589f78815326b1b0c942975206cfc1cc4e6288fdfa64646e4289f8c5e` | **yes** |
| **SQL8** | deadline and reconciliation | `rpc-deadline-reconciliation-v1/supabase/migrations/20261016092509_ifttt_rpc_deadline_reconciliation.sql` | `7c6c5e093fdaa1b0ccef15228eccda1b60096d4a74662fb0ad84e0302be01e4a` | **yes** |

Never apply these superseded drafts: SQL5 `0a07a6f3…` and `bf4fc54b…`, SQL6 v1 `9540ce4d…`, SQL7 v1 `7ffd05fb…`.

Order hazard: the filename timestamps do not sort into dependency order 1 → 2 → 3 → 4. All timestamps also predate the hosted head, so `db push` would treat them as out of order. Every file must be renamed rather than copied by name, and the pending set must contain only the approved files.

## 5. Exact next-approval checklist (in order; stop at the first failure)

1. **Done.** R21 and R22 guards are both independently accepted.
2. **Commit decision.** TJ decides when these are committed: the R21 and R22 edits (`iftttIntakePolicy.ts`, `lineSourceIftttReceiver.ts` and its test, `replay-player-aliases.ts`, the new untracked `__tests__/pages/api/v1/db/replay-player-aliases.test.ts`) and these task folders. They must go in one commit, or R21 first. Nothing was committed here.
3. **Zero-request facts.** TJ reads the hosted PostgREST version in Supabase Dashboard → Project Settings → Infrastructure. The hoisting proof requires v12 or later.
4. **Local actual-transport proof.** This needs TJ's OK to start colima/Docker and pull the official `postgrest/postgrest:<hosted version>` image. Not to be run 2026-10-20 07:00–13:00 ET.
   - Point it at a disposable PG17 holding the baseline raw tables, SQL6–8 and a 6 s sleep trigger.
   - Call `retain_bounded_ifttt_raw_receipt` and `reconcile_ifttt_raw_receipt` through `@supabase/supabase-js`.
   - Pass conditions: `57014` at about 5 s with a complete before == after; reconciliation runs in a READ ONLY transaction; total client wait at most 8 s.
5. **Hosted "before" readback.** One read-only call of `receiver-chain-readback.sql` (SHA-256 `1e46f34fcdfbc207f483cfd013815748a6bc12a4be7babda876289e647b7d651`) on project `fyhftlxokyjtpndbkfse`.
   - Execution bounds: `BEGIN READ ONLY`, 5 s statement and 2 s lock timeouts, concurrency 1, no retry. The result is under 16 KB.
   - Stop if any of these hold: a raw table is missing; a raw-table trigger is unexpected; `service_role` lacks BYPASSRLS; `TimeZone` is not `UTC` (or `authenticator` overrides it); any of the three new relations already exists.
6. **Migration.** Migration owner prepares B2. TJ approves applying exactly SQL6 → SQL7 → SQL8. Then one "after" readback, which must show exactly:
   - `ifttt_raw_receipt_variants`, `ifttt_intake_policies` and `ifttt_intake_receipts`: RLS on, owner `postgres`, `service_role` has SELECT only, `anon` and `authenticated` have nothing. Triggers are `ifttt_raw_receipt_immutable`, `ifttt_intake_policy_immutable` and `ifttt_intake_receipt_immutable`.
   - `retain_bounded_ifttt_raw_receipt`: definer, `v`, `search_path=""`, `lock_timeout=2s`, `statement_timeout=5s`. EXECUTE for owner and `service_role` only.
   - `reconcile_ifttt_raw_receipt`: invoker, `s`, `search_path=""`, `statement_timeout=1s`. EXECUTE for owner and `service_role` only.
   - `stop_ifttt_intake_policy`: definer. EXECUTE for owner and `service_role`.
   - `register_ifttt_intake_policy`, `retain_ifttt_raw_receipt` and `valid_ifttt_intake_policy`: no `service_role`, `anon` or `authenticated` EXECUTE.
   - Raw tables identical to the "before" readback. All three counts are 0.
   - Rollback: on any mismatch, stop. No DROP is pre-approved.
7. **Release.** TJ approves one exact `master` candidate SHA and its production deployment, following AGENTS.md Vercel rules and the saved memory note: re-check all 4 linked Vercel projects with TJ, never push alone, and confirm afterwards that no unexpected build started.
   - Without pilot env, the receivers keep the legacy path (pilot configuration fully absent).
   - The deploy does make DFOFantasy and NHL_Rosters routes reachable. They return 500 until their secrets are set.
   - The combined octoberBranch release scope (FORGE and others) is the release owner's decision.
8. **Policy registration.** TJ approves the exact policy JSON (section 6). The owner (`postgres`) calls `select public.register_ifttt_intake_policy('<json>'::jsonb)` once and reads back the contract with zero counters (`pilot-window-readback.sql`). `service_role` cannot register.
9. **Activation.** TJ approves setting four Vercel production variables and **one redeploy**, because Vercel applies env changes only to new deployments:
   - `IFTTT_RECEIPT_VARIANTS_ENABLED=true`
   - `IFTTT_INTAKE_POLICY=<the exact registered JSON>`
   - `TWEET_CLAIMS_MODE=shadow`
   - `TWEET_PIPELINE_INTERPRETATION_ENABLED=true`
   - `IFTTT_INTAKE_STOP` absent.
   - `startsAt` must fall after that deployment is live. Until then, in-scope deliveries are refused with `not_started`.
10. **Window readback and stop.** At the window's end, or earlier at the first anomaly, run the stop and the readback:
    - Stop: `select public.stop_ifttt_intake_policy('<id>','<reason>')` as `service_role` or owner. It is durable and needs no deploy.
    - Readback: one `pilot-window-readback.sql` call (SHA-256 below), with the same transaction bounds as item 5.
    - Pass conditions: `admittedOutsideWindow=0`, `receiptsWithoutCarrier=0`, `nonPendingCarriers=0`, attempts at most `maxAttempts`, admitted at most `maxReceipts`.
    - Receiver 500 responses with `outcome:"unknown"` are reconciled only with the read-only `reconcile_ifttt_raw_receipt`, never with a new write.
11. **Deactivation.** TJ approves removing the four variables and one redeploy. This restores the legacy path.
    - Decide beforehand what happens to retained rows. Once the env is removed, a capture-enabled scheduler processes **same-Eastern-day** pending rows; older days stay pending.
    - Choose one: end the window after Eastern midnight; keep the variables until then; or approve a separate bounded cohort later.

Cost bound: 1 release deployment, plus 1 deployment to activate and 1 to deactivate. TJ may combine release and activation into one. There are 4 hosted read-only SQL calls and up to 3 owner/service SQL mutations (register, stop, migration). No new cron, ETL, replay or load test. The existing alias-replay cron makes no processor call while a pilot is configured (R22 guard).

SHA-256 `pilot-window-readback.sql`: `3fe4e005d8d3d2cf3dc042b601b5fd6308d71df250a23c2577f1752284fc5440`.

## 6. Policy choices only TJ can make (no values are defaulted in code)

Exact receiver tuples, from `receiver-intake-bounds-v1/SOURCE-SCOPE-INVENTORY.md`:

- `dfofantasy`: (`line_source_ifttt_events`, `dfo`, `dfofantasy`, `dfofantasy`)
- `nhl_rosters`: (`line_source_ifttt_events`, `nhl_rosters`, `nhl_rosters`, `nhl_rosters`)
- `gamedaylines`, `gamedaygoalies`, `gamedaynewsnhl`: (`line_source_ifttt_events`, `gdl_suite`, `<key>`, `<key>`)
- `ccc`: (`lines_ccc_ifttt_events`, `ccc`, `ccc`, `cccmiddleton`)

Operational consequences TJ must accept while any pilot variable is present:

- Every **out-of-scope** receiver fails closed with 503, and that delivery is not stored.
- In-scope deliveries are retained only.
- Once R21 is applied, the minute scheduler processes nothing. Once R22 is applied, the 10-minute alias-replay cron makes none either.
- Site line and news updates from IFTTT pause for the window.

Recommended shape: include every source that has an active applet (nothing is lost), with a short window.

Values to choose:

- window: `startsAt` after deployment, `endsAt` at most 24 h later, with an explicit `Z`.
- `maxReceipts`: about 2 × the distinct posts expected. A first variant of a legacy carrier uses 2 slots.
- `maxAttempts`: at least 3 × `maxReceipts`, to cover exact IFTTT retries.
- stop owner: TJ.

For example only, one source over 6 h: `maxReceipts` 40, `maxAttempts` 120. Use the full object shape in `web/lib/sources/iftttIntakePolicy.ts`, normalized with `parseIftttIntakePolicy`.

## 7. Authentic acceptance and full52

**Applet → stored event (U05.01).** Requires genuinely new natural deliveries inside the approved window. TJ inspects the IFTTT applet activity in the IFTTT UI (no secret values) for the in-scope applets. For each delivery, compare against the `pilot-window-readback` carriers:

- tweet ID
- publication clock (`postedAt`)
- receipt clock (`receivedAt`)
- source key
- exactly one carrier per post

Nothing synthetic, no forced webhook, no replay of consumed attempts.

**Full52** is the original 52-case formal acceptance ledger (CR001–CR052). Its local reconciliation stands at 50/52 rows and 225/227 assertions. CR011 assertion 0 and CR051 assertion 1 remain failing by the approved ambiguity policy. Integrated full52 still needs everything in `full-acceptance-reconciliation/HOSTED-ACCEPTANCE-PACKAGES.md` §2–5:

- a new catalog read
- natural exact keys
- exact-key history and writer-fence reads
- queue and receipt matching

A receiver pilot produces natural raw evidence only. It cannot complete full52.

## 8. Not done, and optional review candidates

Not done:

- No hosted read or write, migration, deploy, push, commit, policy, env or applet change.
- No replay of consumed attempts.
- No external message.
- No parser, alias or identity change.

Optional parser-review candidates. These are unverified outputs. None of their post IDs exists in local files, so reviewing them needs an approved hosted read; never auto-map:

- "Kelly -- Brindley" / "Toews -- Makar": posts 2111255365077864734 and 2111256724313374751
- "Gourde-Sabourin": 2111120442690081082
- "Scissons" (TOR): 2111466905433235847
- "Bunting" (PHI): 2111466941361668507
