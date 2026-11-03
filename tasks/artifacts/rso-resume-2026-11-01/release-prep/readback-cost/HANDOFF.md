# Consumer readback cost bounds — local evidence only

The proposed two E2 GETs are a client request budget, not a complete server-work budget. This review makes two previously vague fan-out gaps concrete. It does not establish current production configuration, data distribution, CPU cost or a cause of Vercel usage.

**Five local probes passed** against the actual extracted Start Chart helpers, with recording database fakes and no route/client imports. `PROBES.json` preserves request filters and counts; `probe.cjs` extracts the functions from the pinned source through the TypeScript AST rather than maintaining a copied implementation. Only synthetic input was used. This source exactly matches candidate `c3897d3273ca46ea25a9f2737f09c835e5ec7325`.

| Read path | Bound actually established | Remaining condition |
|---|---|---|
| Start Chart response | Successful serialized JSON is capped at 4,000,000 bytes; use one complete-slate GET with no page, position, nonce or cache-buster. | The cap is checked after work is done; it does not cap database work or CPU. |
| RSO response | Successful serialized JSON is capped at 4,000,000 bytes including bridge wire. | The two successful E2 bodies total at most 8,000,000 bytes before HTTP overhead. Error/proxy bodies and database payloads are separate. |
| CTPI helper | Reads 30 dates and the slate's team abbreviations, in pages of 500. The synthetic four-game/eight-team single-season case returns 240 rows in one call. | Table key is **(season_id, team, date)**, but this helper neither filters nor selects season_id. Three schema-permitted season keys for the same date/team population return 720 rows in two calls. A one-season assumption is not a code-enforced bound; there is no explicit page ceiling or abort deadline here. |
| Yahoo ownership fallback | Exact-date usable data takes one query; errors stop without retry. | If the overlay RPC is unavailable and some players lack usable exact-date/history values, the fallback walks all on-or-before history. A 5,200-row null-history fixture takes seven queries: one exact-date read plus six pages. There is no lower date bound, page ceiling or abort deadline in this helper. This is database history, not a live Yahoo provider call. |
| Overlay RPC success path | Existing SQL migration accepts 1–500 input NHL IDs and selects latest eligible player/history rows with lateral `limit 1`. That success path avoids the client history loop. | Source existence does not prove the function is installed/available now. Returned mapping multiplicity, query plan and database cost are not measured here. Do not invoke production to establish this without approval. |
| RSO loader | Input pages enforce exact counts and row ceilings; recent form has a 6-second window, four page workers and at most one whole-read retry. The loader establishes a 20-second deadline. | Source selection happens before that loader in the API and has its own up-to-8-second window when a native head is configured. These are stage deadlines, not a whole-route wall-time/CPU ceiling. Native/detailed/bridge paths add different reads; current branch is unverified. |

CTPI's filter omits season even when the handler has resolved `seasonId`. The primary-key finding is a **bound/identity ambiguity**, not evidence that production contains incorrect duplicate-season records. Likewise, the null-history fixture proves a missing finite request ceiling, not actual oversized history or a bill attribution.

The Start Chart shared cache key includes page and page size, so paginating the same slate can repeat work on a cold process. Source selection also precedes its in-memory cache check. The existing complete-slate, one-call protocol remains the correct proposed request shape; no warm-cache assumption is used in the budget. Native selection depends on `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` and `FORGE_NATIVE_SERVING_FALLBACK`, so the existing owner receipt must establish the actual serving branch as well as the seven legacy settings. An existing saved `forecastSource`/deployment receipt can establish this without new traffic.

## Concrete next action and custody

`CLAUDE-LEASES.json` retains both `web/pages/api/v1/start-chart.ts` and `web/__tests__/pages/api/v1/start-chart.test.ts` under idle **PROV-GUARD**. Claude session **1e668672** is its verified originator/custodian. The current `RSO-ADMISSION-FILES` transfer allocates only the two admission catalog files and does not transfer these route/test files. Neither was changed.

The orchestrator can ask that owner to allocate or perform this bounded engineering slice in the **next coordinated local batch**, separately from the already frozen admission candidate:

1. Bind CTPI reads to the resolved season, then enforce a page/row/deadline bound derived from its date/team scope. Reject or mark incomplete auxiliary context on overflow; do not silently accept a truncated complete set.
2. Give the ownership compatibility fallback an explicit finite page/read and deadline policy, or require the existing RPC with independently established database execution/result bounds. At the bound, preserve unavailable ownership as unknown and report degraded auxiliary context; do not convert missing ownership to zero or suppress valid forecast rows.
3. Extend the nearest route tests for same-date/team different-season rows, missing/null ownership histories, exact-date success, errors, and bounded overflow. Reconcile any retained producer-closure/candidate impact before adding the change to a release batch.

This is an engineering/custody handoff, not a request for TJ to choose implementation constants or authorize a deployment. If the owner instead proposes a data-dependent canary budget, it must supply existing evidence for the serving branch, RPC availability and finite historical population, plus a concrete maximum; these probes do not supply that production evidence. No current canary is ready or authorized.

The remaining independent qualification prerequisites are unchanged: authentic released E1 identity and original comparator inputs, approved first eligible slate/reset decision if needed, final admission commit, and explicit bounded capture authorization. Timestamp fixes remain frozen for independent re-review; none of their successful tests were rerun here.

Source locations: Start Chart `fetchCtpiRows`, `fetchYahooOwnershipHistory`, cache-key/sendPayload and their call sites; `supabase/migrations/20260716112908_production_schema_baseline.sql` table and primary key; `supabase/migrations/20260828130824_start_chart_yahoo_overlay_reader.sql`; RSO data route, `planning.ts`, `planningInputs.ts`, `bridgeForecastWire.ts`, `forecastServingSource.ts`. Exact byte hashes and line anchors are in `EVIDENCE.json`.
