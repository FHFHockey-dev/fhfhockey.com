# RSO card stats: receipt (2026-10-27)

TJ asked (10-27) for a more compact CandidateCard, L/PP deployment chips and L5 GP box-score stats.

## What changed
- **Compact card:**
  - rank rail 32→26px;
  - body padding 4px;
  - metrics drop from `lg` to `sm` type;
  - each Mon–Sun cell is one line (weekday + H/A);
  - reasons and warnings now share the footer row with the actions (wrapping under on narrow cards);
  - card margins are 2px;
  - name buttons are 32px on touch widths (actions stay 44px).
  - Kept: ADD/DROP, the FA/Waivers badge, Net Pts, Net AGP, the strip, the recheck line and the actions.
- **Deployment chips:**
  - `L1`–`L4` or `D1`–`D3`, plus `PP1`/`PP2`, shown in the ADD row;
  - the title and aria-label read "Lines as of Oct 26";
  - a stale chip is dashed and muted, and its title adds "· may be out of date";
  - nothing is shown when unknown.
- **L5 GP line:**
  - skaters: G, A, PTS, SOG, PPP, HIT, BLK;
  - goalies: W, GA, SV, SV% (pooled SV/SA).
  - These are **totals** over the last N (≤5) games played, labelled `L{N} GP`, with the title "Totals over the last N games played".
  - A missing value shows as `—`.

## Data sources and query shape (read-only, no new tables, no migrations, no NST, no PROJECTIONS_*)

| Field | Source | Statements | Filters / order | Row cap |
|---|---|---|---|---|
| `lastFive` | **existing** `wgo_skater_stats` / `wgo_goalie_stats` 30-day window rows already read for `recentTotals` | **0 new** (same rows; columns already selected) | unchanged | unchanged (25,000 / 2,500) |
| `deployment` lines | `lineCombinations` joined `games!inner(date,seasonId)` | 1 (one page in practice) | `game.seasonId = season`, `game.date` in [now−14d, today], order `gameId desc, teamId`; key `(gameId, teamId)` = PK | 600 (32 teams × ~8 games ≈ 256 realistic) |
| `deployment` PP | `powerPlayCombinations` | 1 | `gameId in (newest game per team, ≤ 32 ids)`, order `gameId, playerId`; key `(gameId, playerId)` | 40 × ids (≤ 1,280; ~10–15 a game realistic) |

- Both deployment reads use the existing `pages()` helper:
  - exact count;
  - the read fails if over the cap, on count drift or on duplicates;
  - 2s deadline.
- They are skipped when `skipRecentForm` is set (the start chart).
- The deployment read starts beside the WGO reads and settles to `null` on any failure. The evidence key is `deployment` with `deployment_query_failed`; the player gets no chip.
- **Mapping:**
  - forwards are listed line by line (3 per line) and defence pair by pair (2), matching `convertToLines` in `components/LineCombinations/utilities.ts`;
  - extras past L4/D3 get no line chip;
  - PP unit 3 is the writer's catch-all for players 11+ (`update-power-play-combinations`), so only units 1 and 2 are shown.
- **Stale:** the team's newest charted game is more than 7 days old, or older than the player's latest WGO game played.
- **Payload:** zeros are omitted from `lastFive.stats` (same convention as `recentTotals`). `deployment` is about 60 bytes per dressed skater. The transport schema `players` is `.passthrough()`.
- **Snapshot schema:** `workspaceSchema.ts` `player` adds two optional fields on one line (`lastFive`, `deployment`; strict objects). Old snapshots without them still validate (test).
- **Yahoo:** `rosterPlanning.ts` mutates the canonical planning players in place, so it needed no change.

## Commands and results
- `TZ=UTC` and `TZ=America/New_York npx vitest run components/RosterScheduleOptimizer lib/rosterScheduleOptimizer lib/rosterScheduleData lib/in-season hooks/useRosterScheduleOptimizer.test.tsx hooks/yahooPlanningReadBroker.test.ts hooks/useRosterPlanning.test.tsx hooks/useCandidateMetrics.test.tsx lib/integrations/yahoo` → 84 files, 2056 tests passed in each zone.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (taken with noclobber, then released) → exit 0.
- `npx eslint` on the 8 touched TS/TSX files → clean.
- CSS-module pure check: sass compile, then `postcss-modules-local-by-default` `{ mode: "pure" }` on `CandidateCard.module.scss` → pure. The checker was sanity-checked to reject an impure selector.

## Tests added
- **CandidateCard:**
  - compact structure (body rows `top`/`boxScore`/`footer`; the reason and action share the footer);
  - skater L5 with an unknown value;
  - goalie L3 with SV%;
  - no box score without games;
  - chips present, stale and absent.
- **planning:**
  - skater and goalie `lastFive` from mocked WGO rows, with exactly 1 WGO skater select;
  - deployment for L2+PP1, D2 with no PP, and an extra forward with PP2;
  - query shape (one select each, filters, `in` ids, a single page each);
  - stale by age and by a newer game played;
  - out of the lineup → absent;
  - cap overflow on either table → absent plus `deployment_query_failed`, with form unaffected;
  - the start chart skips both tables.
- **workspaceSchema:** a legacy player round-trips unchanged, the new fields round-trip, and an invalid line, unit or extra key is rejected.

## Limits
- No production calls; Supabase is mocked in every test.
- No Yahoo reads, push, deploy or migration.
- No visual browser preview was run: layout is verified by the DOM structure tests only. Phone-width reading was not checked by eye.
- The lineup date is the game date (`games.date`), not the capture time.
- A traded player is matched against their current `nhlTeamId` lineup; if he is not in it, no chip is shown.

## Files (sha256 at commit)
    3ef3c2ea316410a97735940773585890a74c91f9c38b673ed81d1d879490d0db  web/components/RosterScheduleOptimizer/CandidateCard.tsx
    48da330c958022e3f66ccee89007ca5e3ce5106b529578d4433c9efe16a4660b  web/components/RosterScheduleOptimizer/CandidateCard.module.scss
    db90dedcd2c1bf40daf077cdea170c3ffaebcdf3d432fdd50f68c5fd669ffa4c  web/components/RosterScheduleOptimizer/CandidateCard.test.tsx
    2e65ee72ca4279892ed696ce05cb35178f5c1ec4e02ed0be5b84317ba4245110  web/lib/rosterScheduleData/planning.ts
    b77bd59615518505c9e271affd7ff81e984e06929127359b3e1c636fcf21f208  web/lib/rosterScheduleData/planning.test.ts
    a1d0bc9985ebe24698f336d1bb70b671663d5ad07078e99103740f3d9fa07831  web/lib/rosterScheduleOptimizer/recentForm.ts
    1ea5348dac87e044d00953ddacf50b386e0da0947a25e313c172e6aeed6b1935  web/lib/rosterScheduleOptimizer/planningTypes.ts
    efff7eed3d94c48c2ad25d9bfda33615556fddbf65e57c3a9a303530458eb5e3  web/lib/in-season/workspaceSchema.ts
    8bac55262de7268573d1ebe136338488263438243e2062233cbe52912cc37d50  web/lib/in-season/workspaceSchema.test.ts
