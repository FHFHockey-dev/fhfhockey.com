# FORGE v2 daily automation — design (2026-10-17)

**Status: design only.** Nothing here has been created, scheduled, deployed or run live. Companion files:
- [INJURY-POLICY-PROPOSAL.md](INJURY-POLICY-PROPOSAL.md): the Yahoo status → `knownConflict` policy for TJ.
- [INTEGRATION-NOTES.md](INTEGRATION-NOTES.md): wiring the `universe` stage into `web/scripts/forge-daily.ts` after Monday.
- [DRAFT-SCHEDULED-TASK.md](DRAFT-SCHEDULED-TASK.md): a prompt for a local scheduled task. **Do not create it**; scheduler binding is a separate approval.

**Builds on:**
- `tasks/prd-forge-daily-pipeline.md`, especially "v2 decisions (TJ, 2026-10-17)"
- the v1 driver `web/scripts/forge-daily.ts` and its runbook `tasks/artifacts/forge-continuation-2026-10-17/LIVE-RUNBOOK-20261020.md`
- the new universe stage `web/scripts/forge-daily-universe.ts` (library `web/lib/player-forecasts/yahooUniverse{,Capture}.ts`)

**Authority.** TJ's standing approval of 2026-10-17 (PRD v2 decision 3, ref `tj-standing-approval-2026-10-17:forge-daily`):
- Unchanged method versions publish after an automated independent reviewer approves the exact plan hash.
- Operational bounds are as approved on 2026-10-17: provider reads, materialize, publish plus one CAS, and ≤5 readback requests.
- Scheduler binding, public activation, deploys and pushes are **not** covered.

## 1. Daily sequence (fixed America/New_York times)

Run date `D` is the New York calendar date. Every stage writes a new exclusive-create directory `$P/daily-<D>-v2/<stage>[-a<n>]`, where `$P` is `FHFH-private/forge-rso-completion-20261016-v1`. Every input is pinned by SHA-256. Times are New York local; the stages compute instants with `Intl` (`morningDueAt` already handles EDT and EST).

| # | ET | Stage | Network / DB | Output | Notes |
|---|---|---|---|---|---|
| 0 | 06:45 | **preflight**: read the run ledger and reconcile any open entry (§3). Read the catalog head (id, revision, hash) and confirm the CAS RPC exists | 1 read-only SQL | `preflight.json` | Yesterday's open entries are reported, never resumed |
| 1 | 06:47 | **universe capture**: owned roster `team/477.l.125593.t.10/roster;date=D`, plus `players;status=A;sort=OR;start={0,25};count=25/ownership` | 3 Yahoo GETs (token refresh via the existing token manager) | `receipts.json`, `ledger.jsonl` | Serial, 1 s spacing, ≤1 MiB per body, ≤3 MiB in total |
| 2 | 06:48 | **universe query → identity read → resolve**: offline SQL build. The SQL runs in `BEGIN READ ONLY` via the Supabase connector, and the rows are saved. Then an offline resolve | 1 read-only SQL (≤8 s) | `universe.json` | Name matches are diagnostic; unresolved players are listed, never guessed |
| 3 | 06:50 | **capture** (NHL): a club roster for every universe club, schedule weeks (the participation history window plus future weeks), and the boxscores/landings of new final games for fresh means | NHL GETs, serial, no redirects, within the day's budget | receipts | Excludes the 8 sealed games of Oct 14–15 |
| 4 | 07:00 | **inputs** (offline): native observations, policy selection, participation inputs (rolling window), bound materialization request | none | request, preparation command, coverage | Re-classifies the Yahoo evidence at this cutoff, once the policy is approved |
| 5 | 07:10 | **materialize**: dry run, then execute | ≤1,320 requests, ≤180 s, inserts only | closed proof | |
| 6 | ≥08:00 | **outputs** (offline, after the due time `morningDueAt(D)`) | none | pending plan, cadence command, receipt (`planHash`) | Expiry: earliest of issuance + 12 h, first bound game − 1 ms, day's first league game − 1 ms |
| 7 | 08:05 | **method gate** (offline, §2), then the **independent reviewer agent** (separate, read-only) | none | `review-decision.json` on the exact `planHash` | A reject means no publication |
| 8 | 08:20 | **review → publish dry → publish + one catalog-head CAS** under the standing approval | journaled inserts + 1 CAS | selected catalog | Re-read the head immediately before CAS |
| 9 | 08:30 | **readback**: ≤5 sequential read-only requests | ≤5 | bodies | Report rosterRevision exclusions |
| 10 | 08:40 | **report**: ledger section plus a short summary for TJ | none | | |

**Why these times:**
- All captures are after New York midnight, so they are dated `D`.
- The roster is read the same morning, after overnight waiver processing. Yahoo's waiver timing for this league is not verified offline.
- Outputs cannot be issued before 08:00 ET.
- Publishing at about 08:20 leaves about 14 h before a typical 23:00Z first game.

**Two triggers, one prompt.** A local session should not idle until 08:00. The same prompt runs at **06:45** (steps 0–5) and at **08:05** (steps 6–10). Each trigger reads the run ledger and advances to the furthest stage allowed at that time. A repeated trigger is therefore harmless (§3). A third trigger at **10:30** does failure-only recovery and nothing else.

## 2. Gates and stop rules

A stop means: write the reason to the ledger, publish nothing, report. A stop never relaxes a gate.

**Universe (new):**
- **U1 capture.** All of these must hold, or `yahoo_capture_differs_from_plan` / `yahoo_roster_scope_unverified` / `yahoo_source_clock_unverified`:
  - exactly the 3 planned URLs
  - all on run date `D`
  - response clock within 120 s of the capture clock
  - the roster scope (`team_key`, roster `date = D`, `coverage_type = date`, `is_owned_by_current_login`)
  - every page `league_key`, and player collections complete (`count`)
- **U2 identity binding.** The identity rows cover exactly the requested keys, or `identity_rows_differ_from_query`.
- **U3 owned complete.** All owned players resolve to exactly one identity: one verified mapping, reverse, forward and NHL-owner counts all 1, active, with a unique current club. Anything else is a gate exception and goes to TJ.
- **U4 candidates.** Unresolved or excluded candidates ≤ 5 of 50 (2026-10-16: 0). They are dropped and disclosed, never guessed. Above 5 is a gate exception and goes to TJ.
- **U5 change.** `change` against the last published universe:
  - **While inputs still come from retained templates (v1):** any added or removed member, or any `rosterRevision` change, stops (`universe_changed_requires_v2_inputs`). Consumers would exclude a stale revision anyway.
  - **With v2 fresh means and rolling participation:** members may change, at most 10 added per day. Each added member must be in the capture plan. Every change is disclosed to the reviewer.
- **U6 injury.**
  - **Until TJ approves the policy hash:** `knownConflicts` stays withheld and the v1 carry rule applies.
  - **After approval:** applied only when `policyHash` equals the approved hash. A different hash goes to TJ.

**Existing v1 gates (unchanged):**
- capture equals plan and is on the run date
- every universe club roster is present
- the frozen-window frame is unchanged, while v1 participation is in use
- participation coverage is complete
- materialize is `closed`
- outputs are refused above the null-participation ceiling. With the injury policy, the proposal counts only non-conflict nulls; see the policy file
- reviewer approval on the exact `planHash`
- the publish package hash equals the dry-run package hash

**Method gate (new, before review).** Each policy row's `(policyVersion, definitionHash)` and the participation method version must be in a pinned allowlist (`approved-methods-v1.json`, its SHA-256 recorded with the standing approval).
- A new or changed version or hash stops (`method_not_in_standing_approval`) and goes to TJ.
- Approval of the rolling-window method is decision 2. Its exact version and definition hash enter the allowlist once that build lands.

**Time gates:**
- No capture before New York midnight.
- No outputs before `morningDueAt(D)`.
- No publish after the earlier of 21:30Z and first bound game − 90 min.
- No live work at all if the trigger starts after 20:00Z.

**Goes to TJ instead (never automatic):**
- any new or changed method, policy or definition hash
- any gate exception: U3, U4, the null ceiling, a time gate
- raising any ceiling
- injury-policy approval or changes
- a reviewer reject (reported; nothing is published)
- a CAS conflict, where the head moved unexpectedly
- an `unknown` write state after reconcile
- Yahoo `yahoo_reauth_required` or `yahoo_access_denied`; TJ must reconnect, and credentials are never handled
- scheduler binding, public activation, deploys and pushes

## 3. Recovery: failure-only retry, reconcile first, idempotency ledger

**Run ledger.** `$P/daily-<D>-v2/run-ledger.jsonl` is append-only and fsynced. Each line:

```json
{"at":"…","date":"D","stage":"materialize","attempt":1,"key":"<sha256>","action":"intent|completed|failed|reconciled","inputs":{"request":"<sha256>"},"outputs":{"stage.json":"<sha256>"},"reason":"…"}
```

- **Key.** `key = sha256({version, date, stage, inputs})`. A stage whose key has `completed` is never re-run; its outputs are reused. This is what makes repeated triggers safe.
- **Open intent.** An `intent` without `completed` or `failed` is reconciled before anything else, using the rules below.
- **Retry budget.** At most one retry per stage per day, inside the same approved bounds. The bounds are shared, not doubled.
- **Failure-only.** A successful stage is never re-executed. A retry writes to `<stage>-a2`.

| Stage | Reconcile first | Retry allowed when |
|---|---|---|
| universe capture, NHL capture (GETs) | Read the stage ledger. Receipts from different attempts are never merged | Timeout, 5xx or network error, after ≥60 s. `429`: only after `Retry-After`, once. `401`/reauth/`403`: never (goes to TJ) |
| identity SQL (read-only) | none needed | timeout, once |
| query, resolve, outputs, review (offline) | Inputs are pinned by hash | Deterministic: rerun freely before publish intent. Frozen once publish intent exists |
| inputs (offline) | If a materialize intent exists for its request, **never rerun**: `runId` is random | Only before any materialize intent |
| materialize | Rerun the **identical** request file (same `runId`). `materializeNativeInputs` reads back the run's existing report and closure, verifies them, and inserts only missing rows | Status `unknown` or a failed attempt, once. A new `runId` for the same day requires TJ |
| publish | Read the cadence journal for slot `morning:D`, the planned publication rows and the head. Rerunning the identical command reconciles a `running` claim with the same package hash (journal attempts ≤3) | `held`/`unknown`, once, with the same package hash. A different package for the same slot requires TJ |
| catalog-head CAS | Read the head | Head at expected + 1 with our observation ID: done. Head at expected: retry the CAS once with the same observation. Anything else is a conflict and goes to TJ |

## 4. Timing: reserved shape for T−15 per-game revisions (separate prompt)

The morning issuance expires at the day's first league game − 1 ms. Later games then lose a valid forecast at the first puck drop. T−15 revisions are meant to cover that. This section only reserves the shape:
- **Slot.** `pregame:<D>:<startsAtUTC>`: one revision per distinct start time, not per game. `dueAt = startsAt − 15 min`, `expiresAt = startsAt − 1 ms`.
- **Scope.** Players of the games starting at that time. Means are carried from the morning issuance; no new boxscores arrive intra-day.
- **Re-observed inputs:**
  - both club rosters
  - Yahoo status for those players, via the existing `availability` board resource (`players;player_keys=…/ownership`, ≤25 keys)
  - confirmed lineups and goalies once the IFTTT line-source pilot is approved
- **Catalog.** Each revision is one CAS from the previous head revision, so revisions stay monotonic.
- **Ledger.** The ledger's `stage` gains `pregame:<startsAtUTC>:<step>`, and `slotKey` is recorded on every entry. The idempotency rules in §3 apply unchanged.
- **Approval.** A new cadence slot type and its bounds need TJ's approval. They are not covered by the morning standing approval.

## 5. Where it runs

| | Local Claude scheduled task (recommended start) | Hosted (GitHub Actions + Claude Agent SDK) | Hosted (Vercel cron → API route) |
|---|---|---|---|
| Compute cost | Claude usage for one session plus one reviewer subagent per trigger (unmeasured; measure in week 1). No Vercel usage | Actions minutes plus Anthropic API tokens per run | Function invocations and duration for about 10 min/day of work, plus a build per deploy, plus an LLM API call for the reviewer |
| Provider and DB load | Same as approved: 3 Yahoo, NHL GETs, 2 read-only SQL, ≤1,320 materialize requests, publish + 1 CAS, ≤5 readback | Same | Same |
| New infra | none | A workflow file. Secrets: service role, Yahoo app, Anthropic. A private store for receipts, which must not go to Actions logs or artifacts: they contain account data | A new route and a cron entry. A deploy. Storage for private receipts |
| Approvals needed | Scheduler binding (creating the task); command permissions for the task | CI change, secrets, push (Vercel build impact must be inventoried first), scheduler | Route review, deploy (paid build), cron schedule, secrets: all ask-first |
| Failure modes | Mac asleep or offline, or app closed: a missed day; the next trigger reports, with no catch-up after the time gates | Runner outages; secret rotation | Function limits (`materialize` ≤180 s plus publish inside one invocation); cold starts |
| Reach | `FHFH-private`, `web/.env.local` and the Supabase connector already work locally | Needs all of these re-homed | Needs all of these re-homed |

**Recommendation.** Start with the local scheduled task: zero deploys, zero new infra, and the same commands the v1 run uses. Measure per-run Claude usage and the missed-trigger rate for about two weeks. Revisit hosting after the T−15 design, if reliability or the Mac's availability becomes the constraint.

**Requirements for the local task:**
- The Mac is awake and online at 06:45, 08:05 and 10:30 ET.
- The Claude desktop app is running.
- The Supabase connector is authorized.

No cost figures are claimed here: none were measured.

## 6. Draft scheduled-task prompt

See [DRAFT-SCHEDULED-TASK.md](DRAFT-SCHEDULED-TASK.md). It is modeled on `~/.claude/scheduled-tasks/forge-daily-live-20261020/SKILL.md`. Steps marked **[pending v2 build]** depend on the fresh-means capture and rolling-participation sessions; the task must not be created before those land and TJ approves scheduler binding.
