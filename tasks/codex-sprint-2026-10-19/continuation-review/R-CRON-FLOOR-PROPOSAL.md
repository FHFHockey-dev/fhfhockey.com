# R-CRON-FLOOR — exact local schedule exception decision

## Current owner disposition — partial,2026-10-19

TJ directly selected **“3 AM local Eastern, daily batch only; recurring freshness jobs excluded.”** The governing clock is America/New_York:03:00local maps to08:00UTC in EST and07:00UTC in EDT. This is a daily-batch start rule; the12enumerated recurring freshness/account/queue entries are excluded. No midnight–03:00blackout or fixed08:00UTC year-round rule is inferred.

The separate owner question on retaining the13fixed daily entries as exceptions versus preparing a bounded reschedule proposal is still pending. NEW8/C0045 stays open until that disposition arrives. No scheduler/configuration/hosted operation occurred; frozen source and dated-hosted evidence remain qualified below. This current decision overrides the preparation text's unresolved clock choice, but not its evidence limits.

**For Chef review before any owner question. No scheduling change requested or performed here.** Parent: `SRC::tasks/TASKS/cron-operations/tasks-prd-cron-audit-and-schedule-optimization.md::C0045`, NEW8.0, superseding source6.1/C0038. Actual worker runtime reconfirmed from matching turn_context: `gpt-6.1-sol`, `medium`.

## What needs a decision

The [PRD says “3:00 AM Eastern Time”](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/prd/prd-cron-audit-and-schedule-optimization.md:68), repeated at103/154. The [completed source task says EST](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/tasks-prd-cron-audit-and-schedule-optimization.md:131); NEW8 and its retained audit apply08:00UTC. Current [timeline labels07:20UTC as02:20EST](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/cron-schedule.md:752), and the03:00EST cluster heading remains at994. These are not interchangeable year-round policies:

- **Fixed EST interpretation:** UTC−05:00, so03:00EST =08:00UTC all year; during EDT that UTC start is04:00 local Eastern.
- **Daylight-adjusting Eastern interpretation:**03:00 America/New_York =08:00UTC in EST and07:00UTC in EDT. The existing07:20–07:55UTC jobs run03:20–03:55EDT, already after that summer floor.

Also distinguish **start of the daily batch** from **a literal midnight–03:00 local blackout**. The old audit treats all UTC slots before08:00 as before the daily batch floor, including jobs that occur the previous Eastern evening. A literal wall-clock blackout would classify those evening slots differently. This report follows the existing audit's UTC batch comparison for the lists below; it does not silently choose a blackout policy.

## Frozen local identities: fixed daily entries before08:00UTC

Source is the first `ALL CRON JOBS` JSON block in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/tasks/TASKS/cron-operations/cron-schedule.md:34), active=true only. These are13local configured pg_cron entries. Key format follows [existing combined inventory](/Users/tim/Code/fhfhockey.com/web/lib/cron/combinedCronInventory.ts:526), not a new identity scheme. “Previous” means the preceding Eastern calendar date.

| pg_cron key | Schedule | HTTP route or SQL identity | Fixed EST time | EDT local time |
| --- | --- | --- | --- | --- |
| pg_cron:3:update-teams-job | `0 0 * * *` | `/api/v1/db/update-teams` |19:00 previous |20:00 previous |
| pg_cron:5:update-seasons-job | `0 1 * * *` | `/api/v1/db/update-seasons` |20:00 previous |21:00 previous |
| pg_cron:6:update-players-job | `0 2 * * *` | `/api/v1/db/update-players` |21:00 previous |22:00 previous |
| pg_cron:7:update-games-job | `0 3 * * *` | `/api/v1/db/update-games` |22:00 previous |23:00 previous |
| pg_cron:271:daily-refresh-nstwgo-matview | `00 04 * * *` |SQL-only job271 |23:00 previous |00:00 |
| pg_cron:233:update-yahoo-matchup-dates | `20 7 * * *` | `/api/v1/db/update-yahoo-weeks?game_key=nhl` |02:20 |03:20 |
| pg_cron:79:update-nst-gamelog | `25 7 * * *` | `/api/v1/db/update-nst-gamelog` |02:25 |03:25 |
| pg_cron:9:update-all-wgo-skaters | `30 7 * * *` | `/api/v1/db/update-wgo-skaters?action=all` |02:30 |03:30 |
| pg_cron:8:update-all-wgo-goalies | `35 7 * * *` | `/api/v1/db/update-wgo-goalies?action=all` |02:35 |03:35 |
| pg_cron:14:update-all-wgo-skater-totals | `40 7 * * *` | `/api/v1/db/update-wgo-totals?season=current` |02:40 |03:40 |
| pg_cron:16:update-shift-charts | `45 7 * * *` | `/api/v1/db/update-shifts?action=all` |02:45 |03:45 |
| pg_cron:248:daily-refresh-player-unified-matview | `50 7 * * *` |SQL-only job248 |02:50 |03:50 |
| pg_cron:23:update-power-play-timeframes | `55 7 * * *` | `/api/v1/db/powerPlayTimeFrame?gameId=all` |02:55 |03:55 |

No fixed daily Vercel entry is before08:00UTC in the current local config. Under the daylight-adjusting summer07:00UTC comparison, only the first five fixed entries above precede the batch floor; all13precede the fixed08:00UTC comparison. This classifies configuration slots, not actual executions or route admission/no-op behavior.

## Frozen local recurrent entries crossing the floor

These12entries have scheduled slots both before and after the UTC batch floor. They need an explicit recurrence exception if the floor is meant to apply to every configured job. The policy might instead limit the daily batch only and explicitly exclude continuous freshness/account/queue work; that exclusion must be recorded, not assumed.

| Provider key | Exact cron expression | Route / stable SQL identity |
| --- | --- | --- |
| pg_cron:1:update-line-combinations-job | `*/25 * * * *` | `/api/v1/db/update-line-combinations?count=10` |
| pg_cron:2:update-stats-job | `*/20 * * * *` | `/api/v1/db/cron/update-stats-cron?count=4` |
| pg_cron:396:player-forecasts-settlement | `20 * * * *` |SQL-only job396 |
| pg_cron:397:player-forecasts-queue-drain | `*/5 * * * *` |SQL-only job397 |
| vercel:1:/api/internal/starter-board | `* * * * *` | `/api/internal/starter-board` |
| vercel:2:/api/internal/yahoo-live-draft | `* * * * *` | `/api/internal/yahoo-live-draft` |
| vercel:3:/api/internal/patreon-reconcile | `11 * * * *` | `/api/internal/patreon-reconcile` |
| vercel:4:/api/internal/fantrax-sync | `17 * * * *` | `/api/internal/fantrax-sync` |
| vercel:5:/api/internal/espn-sync | `37 * * * *` | `/api/internal/espn-sync` |
| vercel:22:/api/v1/db/update-drafted-prospects | `17 */2 * * *` | `/api/v1/db/update-drafted-prospects?scheduled=true` |
| vercel:23:/api/v1/db/replay-player-aliases | `*/10 * * * *` | `/api/v1/db/replay-player-aliases` |
| vercel:24:/api/v1/db/auto-news-feed-items | `*/30 * * * *` | `/api/v1/db/auto-news-feed-items?limit=300&daysBack=14&perSourceLimit=500` |

Vercel keys use the existing helper's **one-based entry index and normalized route path**, while the full configured query string remains in the separate route cell ([helper](/Users/tim/Code/fhfhockey.com/web/lib/cron/combinedCronInventory.ts:594)). Source: [web/vercel.json](/Users/tim/Code/fhfhockey.com/web/vercel.json:9). Reordered Vercel config would change those positional keys, so the exact path/schedule remains part of the review identity.

`*/25` means minutes00/25/50 of each hour, not uniform25-minute spacing across hour boundaries. `*/20` means00/20/40, `*/5` means00–55 in five-minute steps, `*/10` means00–50, and `*/30` means00/30. `17 */2` runs at minute17 in UTC hours00/02/04/06/… . No schedule is expanded into a newly executed job or inferred provider call.

## Smallest reviewable owner options

First record the clock/scope interpretation: fixed08:00UTC versus daylight-adjusting03:00Eastern, and daily-batch floor versus a local blackout. Chef should present the distinction with the exact tables, not choose an interpretation on TJ's behalf.

**Option A — retain enumerated exceptions, no scheduler change.** Record an owner-approved exception for the13listed fixed daily entries under the fixed08:00UTC interpretation (or the applicable five/thirteen seasonal subset if daylight-adjusting Eastern is chosen). Explicitly retain the12listed recurrent entries as continuous-work exceptions, or state the floor applies only to the daily batch and these12are excluded. Approval is limited to these exact local identities/schedules; it does not permit new exceptions, blanket schedule disablement, owner changes or provider bursts.

This can resolve NEW8's **policy-disposition clause** because the source explicitly allows an owner-approved exception. It cannot establish that the currently hosted job set matches these files or verify deployment, timezone, freshness, runtime order, costs or natural completion. Chef should preserve that evidence boundary in any later source/master disposition rather than saying “current production schedule verified.”

**Option B — request a future bounded reschedule proposal.** Choose the clock/scope interpretation and name the specific fixed/recurrent rows to reconsider. Prepare a dependency/duration/freshness/overlap proposal for only those rows, using retained data first and separately authorized current readback if needed. Retain every existing schedule until a concrete proposal and exact external mutation are approved. No automatic03:00packing, no wholesale disabling, no repeated migration/job invocation, and no change to aggregate NST spacing of at least21seconds. A proposal request is not reschedule authorization and does not close NEW8.

The continuous-line/stat work, player-forecast queues and account/news freshness entries have distinct purposes; this report makes no unsupported claim that they can be shifted without impact. These options remain separate from StatusCheckC10/C11 throughput/report decisions and from NEW7/C0044 inventory/audit evidence.

## Local versus retained hosted evidence

- Local lists above were extracted from the current canonical JSON/config bytes only, following active-row and identity conventions read from the existing parsers. No application/parser module was imported or executed. The analysis reads JSON data; it does not create a new scheduling framework.
- The [Oct17 G2 finding](/Users/tim/Code/fhfhockey.com/tasks/artifacts/super-goal-audit-2026-10-17/findings/G2-cron-ops-lines.md:62) records the13early fixed entries plus the then-mentioned recurrent1/2 under the fixedEST comparison. It is dated audit evidence, not current hosted proof.
- The [retained Oct19 read-only result](/Users/tim/Code/fhfhockey.com/tasks/artifacts/super-goal-audit-2026-10-17/PROD-READS-2026-10-19.md:171) reports58active pg_cron jobs and names396/397, with234inactive. It is a dated count/identity receipt; it does not establish today's full schedules or cron timezone. No fresh hosted/setting read was made here.
- Existing [R-OPEN exclusion](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/continuation-review/R-OPEN-LOCAL-PARTS.md:53) and [C-RECONCILE](/Users/tim/Code/fhfhockey.com/tasks/codex-sprint-2026-10-19/master-local/C-RECONCILE.md:1) remain valid dependency context. This report supplies the concrete floor decision list, without repeating their broader inventory/auth audits.
- Local cron documentation labels schedules UTC and Vercel parsing uses UTC semantics. Actual hosted pg_cron timezone/config parity remains unverified; it must not be guessed from bare cron strings.

Frozen source SHA-256:

- cron-schedule.md: `8f92e4b17aefa71ab7ea3b25f7fa68d0a17ccc53df522e5fa1d04e553a1a0455`
- web/vercel.json: `f69f567cff7be24f3e517c9af576eead28c9775a3403466dc1c5dda663b70f42`
- source PRD: `6419f112194d3d433fdb1b8af1e8635718edc90f51d781c251c4b7df34ce8995`

## Exact write and next action

Created only `tasks/codex-sprint-2026-10-19/continuation-review/R-CRON-FLOOR-PROPOSAL.md`. No source/config/scheduler/task-list/register/test edit, suite, route/module execution, Python, DB/provider/hosted call, secret read or Git mutation. Own model/effort checked using value-limited runtime metadata. No running operation.

Next: Chef reviews the exact25identities and clock ambiguity, then decides whether/how to ask TJ. No user question was sent by this worker. This bounded report handoff does not stop the active sprint.
