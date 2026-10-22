# CTPI duplicate upsert: local diagnosis and bounded fix proposal

Follow-up: the parent subsequently authorized local implementation. See [FIXED-HANDOFF.md](FIXED-HANDOFF.md) for the applied two-file candidate, exact hashes and passing verification. The investigation below is retained as pre-fix evidence.

Status: reproducible source defect; no application fix applied. Canonical CTPI route/test/helper were clean before and after this audit. The shared checkout HEAD moved from a811b0762 to d3f057c6c during unrelated work; the receipt pins the exact inspected source hashes. Local `origin/master` is R20 248df9923cfbd00705222bb8ad9126a169bf8773; no fetch or deployment inspection occurred.

## Evidence boundary and updated daily status

Parent supplied a connected-inbox finding from [the daily cron email](https://mail.google.com/mail/u/0/#all/1a163b41ce1e165e), received 2026-10-22 13:01:49Z, covering Oct21 13:00:48Z through Oct22 13:00:48Z:

- CTPI at 10:10:04.995881Z: `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- NST later recorded success at 10:05:42Z. This supersedes the prior saved outage as the latest reported daily NST outcome. It does not establish historical backfill completeness or the whole FORGE chain's completion. TJ owns the active backfill; no NST file or operation was touched.
- The odds child repeatedly returned 403. That is a separate parent-reported failure; this audit did not investigate it.

The email and live runtime were not independently read here. This report proves a local payload-generation mechanism consistent with the CTPI error, not the exact data or branch that caused the production invocation.

## Confirmed mechanism

1. `update-team-ctpi-daily.ts:196–210` starts at the current season's newest CTPI date, falling back to season start when there is none.
2. `:267–282` groups every fetched season team, then computes metrics for every team on every requested date. The per-date filter can leave a team's history empty.
3. `ctpi.ts:195–197` turns that empty history into `team: ""`, `source_game_count: 0`. `computeCtpi` does not omit it and includes its zero-valued metrics in league standardization.
4. `update-team-ctpi-daily.ts:285–299` writes each result unchanged. Two empty-history teams therefore produce the same `(season_id, team, date)` = `(20262027, "", "2026-10-07")` in the fixture.
5. `:213–220` sends the array in batches of 500 using `onConflict: "season_id,team,date"`. The canonical schema's matching primary key is at `supabase/migrations/20260716112908_production_schema_baseline.sql:32686–32687`.

A single empty-history team is also wrong: the write can succeed with one blank-team row. Deduplicating the final array, shrinking the batch, or merely supplying the original team name would conceal the failure while preserving fabricated no-history scores and a distorted normalization population. Duplicate raw rows for one team do not alone create this destination collision because the route groups by team first; they may present a different data-quality problem outside this scope.

## Offline reproduction

`reproduce.cjs` transpiles the **unmodified actual route and actual calculator** with the already-installed TypeScript library. It substitutes the season/source/database/auth/audit boundaries, supplies synthetic `.invalid` values, and denies HTTP, HTTPS, sockets, and fetch. No env file is read. The upsert simulator rejects duplicate composite keys; PostgreSQL itself is not run.

Run from any directory:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin node /Users/tim/Code/fhfhockey.com/tasks/artifacts/ctpi-duplicate-upsert-audit-2026-10-22/reproduce.cjs
```

Observed Node v22.11.0; five scenarios passed on each of canonical and R20 source (10 scenario checks total):

| Scenario | Observed current behavior |
| --- | --- |
| Two teams begin after the first computed date | Two identical blank-team keys; route 500 with simulated cardinality-error message |
| Start at current date, both teams have history | Two distinct nonblank keys, 200 |
| Only one team lacks history on an early date | Blank-team row emitted and accepted, 200 |
| Duplicate raw rows for the same team | One destination team per date; no key collision |
| Entire source empty | `no_source_rows` skip, no upsert |

Exact source SHA-256 values and conflicting keys are in `RECEIPT.json`. The helper is identical between canonical/R20; the route's sole branch difference is audit/auth wrapper ordering. Both versions reproduce the defect. This is not a live SQL, cron, provider, authorization, or deployment test.

## Bounded fix packet for the existing owner

Suggested implementation ownership: only `web/pages/api/v1/db/update-team-ctpi-daily.ts` and `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`. Preserve the shared calculator, its formula weights, publication status, cron configuration and NST lane.

- Before calling `computeCtpi`, omit metrics with no positive `source_game_count` or no valid nonblank team identity. Filtering **before** league normalization is essential. Do not manufacture a score for a team with no eligible history.
- Before the first batch write, validate that every destination identity is nonblank and that `(season_id, team, date)` is unique across the full prepared payload. Fail before any upsert on an unexpected collision; do not pick an arbitrary duplicate winner.
- Extend the existing route suite with the actual calculator for uneven first-game dates, one empty history, a pre-first-game date, current-date success and no-source skip. Assert valid team's computed values match a cohort that excludes empty histories, not just that HTTP 500 disappeared. Preserve the legacy-unapproved publication marker.
- The present test mocks both `computeTrendMetrics` and `computeCtpi` (`test.ts:33–36`); its fixed-return success case cannot detect this defect. Replace or supplement that mock seam rather than adding another calculator-free test.
- Proportionate verification after implementation: focused CTPI route suite plus `lib/trends/ctpi.test.ts`; scoped lint and typecheck as warranted. No production rerun, NST invocation, backfill, schedule change or schema change is necessary for local regression coverage.

This is a proposal, not an applied patch or a green fixed-candidate receipt. No application behavior was changed or repaired in this audit.

## Existing ownership and acceptance limits

- Cron inventory records job **279** as the CTPI writer at **10:10Z**, consuming the team-gamelog source family. The gamelog success reported for NST does not prove all four CTPI source tables are complete.
- Existing governance: `tasks/TASKS/three-pillars-analytics/trends/tasks-prd-ctpi-formula-audit.md` **7.7/7.7.5**, mirrored by Start Chart **17.7**, owns candidate activation. No current named CTPI implementation claimant was found in the inspected Oct22 diaries. Parent should assign the two-file reliability fix without disturbing the formula/activation lane.
- The active calculator stamps `legacy_unapproved`; Start Chart's trusted-data predicate rejects it. The visible Recent Team Form unavailability is therefore not repaired merely by a successful upsert. Keep formula promotion and historical publication gates separate. Existing Start Chart **17.0/17.7** and corresponding super-goal **C0098/C0105** remain the appropriate product lane, not a new NST repair.
- Production cause confirmation, if later authorized, needs only existing invocation scope/start date and per-team earliest eligible source dates sufficient to establish empty histories, plus whether earlier batches committed. No route replay is needed to establish that evidence. Cleanup of any blank-team rows is a separate, bounded data action; none was attempted.

No denied/pending tool approval or uncertain write. Only this artifact packet and task diaries changed; no application edits, commits, deployment, production/API/database/provider call, external communication, credential/private-data access, or NST operation occurred.
