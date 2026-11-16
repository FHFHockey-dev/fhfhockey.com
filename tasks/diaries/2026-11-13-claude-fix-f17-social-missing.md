# F17: social share skater score treats a missing stat as a known zero

Scope: Astra (after checkpoint 1) found social-share skater rankings score a missing stat (blocks) like a known zero. TJ approved a code-only fix. Rules 5 and 13: unknown stays unknown.

Where: `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. Files: `web/lib/socialShare/score.ts`, `web/lib/socialShare/score.test.ts`.

## Inventory (before changing anything)
- **Defect: `web/lib/socialShare/score.ts:30-33` `fantasyPointsPerGame` (skater path).** Each part used `?? 0` (goals, assists, PPP, shots, hits/GP, blocks/GP); null only when all six were null. Missing blocks scored exactly like 0 blocks. The goalie path already withheld on any unknown part (W3-3 A1).
  - Consumers: `players.ts` `scoreOrder` → pickup bands and tier lists (`tiers.ts`), the card stat in `components/SocialShare/SocialShare.tsx` (`pickupStat`, `tierRate`).
  - `offNightEdge.ts:232-233` and `teamStream.ts:154,179` call it with complete games only (missing-stat games filtered out first), so their scores stay non-null. `teamStream.ts:179` `?? 0` is unreachable; left as is.
- Already null-aware (no change): `multiCatStars.ts` (any missing part → no score), `categoryBlueprint.ts` (missing category → unranked), `bshBoard.ts` (`sumOf`/`bsh` → null), `nightlyFloor.ts` (`strictlyAbove` → null), `lastNightsStandouts.ts`, `players.ts` `specialists` (`l5CategoryPerGame` → null → unscored), season rows (`players.ts:97` require counts).
- Not changed, noted: `opportunityMultiplier` gives an unknown line/PP unit no bonus and an unknown TOI no adjustment (neutral), a deployment input, not a stat; outside F17.

## Decision
Withhold the composite (null) when any scored skater part is unknown, mirroring the goalie path. Card contract already handles null: `byScore` puts unscored players after scored ones and the season rate orders them; the tile shows the season PTS/GP labelled "PTS/GP" instead of "L5 SCORE"; `recentLine` prints "—" for the missing part. No new UI copy needed.

## State
- [x] Inventory
- [x] Fix + tests: commit `f2df257b61ffca3e5f4291003426673fe7ed485e` on octoberBranch (score.ts, score.test.ts only; not pushed)
- [x] New test fails on old code (old: missing blocks scored 1.8, same as zero blocks), passes on new
- [x] Checks: `env -u GIT_DIR npm test -- lib/socialShare components/SocialShare` 50 files / 1347 tests pass; `npm run typecheck` exit 0; ESLint on both files exit 0. No .module.scss touched.
- [x] Report to Chef: the brief's ID `local_016832c1-…` was not found. The Chef is the parent session `local_78a99adf-…`, which gets the report through the automatic relay. Full report: side-session-notes/<chef>/F17-report.md

Next: Chef gates the release. Keep this diary until the Chef confirms; then retire it.
