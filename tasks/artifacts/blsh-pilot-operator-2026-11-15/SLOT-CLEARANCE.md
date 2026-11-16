# BLSH pilot slot clearance: 2026-11-17 14:05:00–14:06:00 UTC

Read-only evidence, collected 2026-11-15 ~01:55–02:10Z. Nothing is reserved.

## 1. Verdict: **UNKNOWN**. No conflict found in the scheduled evidence; ad-hoc lanes are unconfirmed.

- **Scheduled activity: clear.** No cron, Vercel or pg_cron job touches NST between 11:00Z and 20:51Z. The minute is not shared with a scheduled NST or bulk-writer job.
- **Ad-hoc and manual lanes: unknown.** Several production-capable lanes have pending, unscheduled operations. None has claimed 2026-11-17 or 14:05Z, but silence is not clearance (11-12 execution plan).
- **No alternative slot is proposed.** Every open unknown is lane-level, not specific to 14:05Z, and would apply equally to any slot before 2026-11-18T23:58Z. Moving the slot would not reduce them. A contingency, used only if a slot-specific conflict appears, is in §6.

The slot becomes **CLEAR** when §4's owner confirmations arrive and §5's T-minus recheck passes.

## 2. Evidence and its limits

| Source | What it shows | Limit |
| --- | --- | --- |
| `CLAUDE-TO-CODEX.md`, latest (to `CLAUDE-BLSH-PARALLEL-LANES-20261115`) | Claude released everything to Astra 11-14 16:38Z. TJ then made Claude owner of FORGE pregame capture (offline; live reads, migration apply and TSA call are each gated by pop-up). Rankings acceptance and fix are local-only. BLSH lanes are offline. No entry claims production time on 11-17 | File-based; written by lanes, not a production readback |
| `CODEX-TO-CLAUDE.md`, latest (to `ASTRA-FROZEN-CALCULATOR-FINDINGS-TO-CAPTURE-20261115`) | DRM step 5 complete, Codex DB writes stopped (11-12 23:29Z). Goalie H1 readiness reads done, no write started (23:46Z); H1 "step 6" stays with Codex under its own approval. Dev-fix sprint items are local/HOLD. Astra audit is offline; its live page audit awaits a TJ request budget. **No reply** to `CODEX-BLSH-CUSTODIAN-COORDINATION-20261112` from an NST custodian | Codex/Scout/Astra sessions are not visible to this session |
| `CLAUDE-LEASES.json` | as_of **2026-11-12T15:11Z**; `shared_resources: none held by Claude`; file leases only | **Stale**: predates the 11-14 release to Astra |
| `CODEX-LEASES.json` | as_of **2026-11-04T23:25Z**; `active_application_workers: []`; file leases only | **Stale** by 10 days; records no production schedule |
| `web/vercel.json` (32 crons; differs from master only in the snapshot cron 12:30→12:40) | Nothing NST-related at 14:xx; see §3 | Repo state, not a Vercel dashboard readback |
| `tasks/TASKS/cron-operations/cron-schedule.md` (last commit 11-12) + `web/lib/cron/nstCoordination.ts` | Direct NST cron starts: 08:30, 08:45, 09:15, 09:55Z. The rolling FORGE pipeline (NST upstream) runs 10:05–10:55Z. Latest daily NST job finishes before 11:00Z | A document, **not a pg_cron readback** |
| `list_sessions` (40 most recent, ~01:57Z) | Running: RANKINGS Lane, rankings-perf (offline + logs), BLSH bridge, BLSH successor. FORGE Lane and FORGE split are idle. Chef `local_78a99adf` is idle | Claude Desktop sessions only. Codex, Scout and Astra **cannot be seen**. TJ's own browser `/db/runner` jobs cannot be seen |

## 3. Scheduled activity, 13:30–14:30 UTC daily (2026-11-17 is a Tuesday)

| UTC | Job | NST? | DB writer? | Overlap |
| --- | --- | --- | --- | --- |
| 13:30, 14:00 | `auto-news-feed-items` (*/30) | no | yes (news rows) | Runs 140–207 s; the 14:00 run is observed to end by about 14:03:40. Vercel-side only |
| 14:00, 14:20 | pg_cron `update-stats-job` (*/20) | no (NHL API) | yes | 14:00 run precedes the slot |
| 14:00, 14:25 | pg_cron `update-line-combinations-job` (*/25) | no (NHL API) | yes | precedes |
| 14:00, 14:10 | `replay-player-aliases` (*/10) | no | yes | adjacent, non-NST |
| every min | `starter-board`, `yahoo-live-draft` | no | reads/writes app state | runs at 14:05 too; non-NST |
| 14:11, 14:17, 14:37 | patreon, fantrax, espn sync | no | yes | after the work window ends (14:07) |
| 14:17 | `update-drafted-prospects` (17 */2) | no | yes | after |
| 14:52 | `update-roster-optimizer-schedule-daily` | no | yes | after |

The NST hour before the slot (13:05–14:05Z) has **zero scheduled NST requests**, so all four budget windows should be at baseline unless an ad-hoc caller used NST. Shared admission enforces this at calls 2 and 4 regardless.

## 4. Lanes that could overlap (name, risk, what clears it)

| Lane | Can touch | Status | Needed to clear |
| --- | --- | --- | --- |
| **On-demand NST API routes:** `CareerAverages/[playerId]`, `SustainabilityStats/[playerId]`, `Teams/[teamAbbreviation]`, `fetch_team_table` (all via `lib/nst/client` with shared admission) | NST (page-driven) | Always possible | Cannot be scheduled away. A concurrent permit can make the pilot's admission deny or defer, and the pilot then **stops with no retry** (slot burned, not a budget breach). Accept as residual risk |
| **TJ manual `/db/runner` jobs** (e.g. NST gap repair) | NST + DB | Unknown | TJ confirms no manual NST or DB job 13:45–14:15Z on 11-17 |
| **Codex Goalie H1 / step 6** | DB writes (player/team/goalie/analytics), producer runs | Pending its own approval; no time set | Scout or Codex confirms H1 is not scheduled 13:45–14:15Z on 11-17 |
| **Astra live page audit** | App requests, which may call the on-demand NST routes above | Awaits a TJ request budget | Scout/Astra confirm it is not running in the window |
| **FORGE pregame capture** (Claude `local_e8064f61`) | DB GET-only allowlist, TSA call, migration apply (each gated) | Offline; capture runs near T−60 of game starts (evening ET) | FORGE lane confirms no capture pilot, migration apply or live read in the window |
| **Browserless quarantine** (Codex) | One catalog preflight, later one DDL on `lineCombinations` | Pending approval | Scout confirms not in the window |
| **Rankings** (Claude `local_a9638be4` and children) | Republish/writer (not authorized); log reads | Local fixes only | Rankings Chef confirms no republish or production action in the window |
| **DRM wider repair** (Codex) | DB | **Complete** (11-12 23:29Z), writes stopped | none |
| **Codex dev-fix sprint 1–9** | none live | Local / HOLD | none |
| **BLSH successor / bridge** | none live | Offline | none |

## 5. T-minus recheck (operator, 13:45–14:03Z on 11-17; all read-only)

1. Re-read both mailboxes from this file's last-seen headings (`CLAUDE-BLSH-PARALLEL-LANES-20261115`; `ASTRA-FROZEN-CALCULATOR-FINDINGS-TO-CAPTURE-20261115`). **Any** new entry naming 11-17, an NST job, a DB writer or an incident → stop.
2. Run `list_sessions` again. A running session whose title names NST, H1, capture pilot, repair, backfill, recompute or `/db/runner` → stop unless its owner has confirmed.
3. Run `git diff` and `git log` on `web/vercel.json` and `cron-schedule.md` since 11-15. Any new 13:00–15:00Z entry, or any NST entry → stop.
4. Confirm the owner confirmations from §4 are recorded in the parent's coordination entry (posted by the parent, not by this lane).
5. Record the result as the coordination receipt `blsh-slot-20261117T1405Z.tminus.<sha12>` (RUNTIME-RECEIPT-PLAN §6).

## 6. Contingency (only if a conflict specific to 2026-11-17 14:05Z appears)

**2026-11-18 14:05:00–14:06:00Z (09:05 EST)**, with output `…/fhfh-blsh-native-20261118T140500Z`.
- **Same scheduled profile:** the crons are daily.
- **Date 2026-11-11 stays valid:** slot + 120 s is 7 d 14 h after the date, inside the 8-day bound that ends 2026-11-19T00:00Z.
- **Needs its own successor bootstrap**, because SLOT and OUTPUT are hard-coded, with new hashes and fresh approval. It is a fallback, not a second attempt.
- **Never use both slots.** One attempt of either slot consumes the pilot.
