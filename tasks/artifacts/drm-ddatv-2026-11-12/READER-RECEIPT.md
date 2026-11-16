# Qualified DRM reader receipt — 2026-11-12

Local only, canonical octoberBranch. Reviewed/completed `web/lib/drm/readMatrix.ts`, DTO `types.ts` and `/api/v1/drm.ts`; added focused mocked reader/route tests. Parent additionally granted engine type-narrowing corrections after its whole-web TypeScript run identified them. No UI or aggregation-helper edits.

## Concrete corrections

- Recheck returned scheduled games against requested venue, opponent and fixed game IDs, in addition to team/season/type/date.
- Pin final PBP raw-header projections to the selected head. Validate game type and calculate authoritative completed clock using the existing pure game-length helper; reject internally consistent shift rows whose game_length truncates/misstates that final clock.
- Require positive retained source-head IDs/versions, matching current input/relationship versions, fingerprints, source heads and player-row counts. Re-read heads/manifests after row reads to detect generation/capture changes.
- Qualify canonical player metadata inside each game's acceptance boundary. A bad roster sweater/name now excludes that game rather than throwing after accepted rows have already accumulated.
- Normalize goalie role before allowing an unused historical roster goalie to lack a positive-TOI row. Historical team/role/hash is checked; current-team/player position tables are never consulted.
- Preserve tagged interval/pair reconciliation, whole-game exclusion and known zero-strength players only after qualification. Missing/unverified/stale games retain explicit coverage entries.
- Correct API home/away typing and engine runtime-safe type narrowing; use explicit typed per-strength reduction collections. DTO shape unchanged.

## Verification actually run

- `npm test -- --run lib/drm/readMatrix.test.ts __tests__/pages/api/v1/drm.test.ts`:18 passed (15 reader,3 route).
- After parent-requested type corrections: `npm test -- --run lib/drm/observedDeployment.test.ts lib/drm/readMatrix.test.ts __tests__/pages/api/v1/drm.test.ts`:39 passed (21 engine,15 reader,3 route).
- Scoped ESLint passed for engine implementation, reader/types, new reader/route tests and route. Whitespace checks emitted no errors.
- Mocked reader tests execute actual normalization, interval analysis and aggregation with an injected database. Cases cover historical wing roles/team binding, zero PP versus unknown excluded games, whole missing scheduled game, retained final missing materialization, stale input/relationship versions, changed heads/generations, roster hash/trade/missing skater, pair disagreement, truncated OT clock and per-game metadata failure. Route tests cover public DTO/scalar scope,405/repeated parameters,400 versus sanitized503 and cache headers.
- Inspected generated owning schema for manifests, heads, raw payloads and game roster, plus pagination/query contracts. JSON-path aliases were source-checked; no live PostgREST/database query was executed.

## Limits and handoff

No provider/network/database calls, writes, build, deployment, full-suite or worker whole-web TypeScript run. Parent owns integration TypeScript and UI checks; its prior tsc log supplied the now-corrected type findings. Provenance admission relies on the owning atomic source/materialization contracts and current version gates; this reader does not independently replay raw providers or qualify absent source intervals. No production readiness claimed.
