# H1 game308 handback — 2026-11-13 01:44 UTC

H1 production generation completed and production restored. No H1 process/writer remains; deployment hold released to parent for Claude. No further production action planned.

## Deployment and settings
- Source502a93b4c96ffe11fe4964ed7873830ca593c064; clean archive,13069verified blobs.
- Created temporary dpl_CarXFBEMdKhyYwMyc9XzTggQcD1o, READY/autoaliased01:30:20UTC.
- Temporary runtime overrides only: compute=true,canary=2026020308,scheduler=false,FORGE_CODE_VERSION=full502a SHA (also build env). No project settings changed. Serving/challenger remained off.
- Restored approved dpl_2bhMeBzKvwzq8a3Cw36uAPLKymKE; fhfhockey.com alias verified, updated01:42:08.628UTC. Never reused old4243 or game307 deployment.
- Natural restored scheduler receipt01:43:36 confirms capture-only mode; status503/failure after26.957s, error=null and no further reason recorded. This is NOT an H1 generation failure. Do not assert scheduler health. Claude should inspect separately; no replay or fix attempted.

## Execution and readback
- Approved game2026020308 NYI@LAK, starts03:00UTC. Exact new scope approved01:21:34 and01:21:58.
- First Python client failed in0.093s before a response; TLS-only diagnostic reproduced local missing-issuer trust failure. Full240s reconciliation: no runs,revisions,audits or leases; all analytics preimages unchanged. No TLS bypass. Alternate normal system-curl transport then performed the single successful model invocation, retries0.
- HTTP200,success=true,completed,78.643s server/79.045s client. Full preflight PASS,bypassed=false; final audit persisted. One roster-drift warning across full22team preflight. No automatic model retry.
- Run328a982a-247f-440f-b230-08882e50fcfa succeeded; exact502a producer; selected_games=[2026020308],board_lease=null.
- Verified persisted projection rows:36players,2teams,2goalies. Reserve rows0; reserve pass disabled and optional reserve table absent. The initial readback query referencing that absent table failed read-only, then was corrected. No reserve migration or enablement.
- Input snapshot01c8adc5-5301-4d56-b385-82b168af6272 in player_forecast_source_observations,forge-run-inputs-v1,run entity.
- Revision25d9dcd2-e05b-4de7-8ebc-d4b7b51ee5cf,published01:41:12.492771UTC,links exact run/snapshot.
- Analytics:1game_prediction_outputs row replaced with exact run provenance;0player_prediction_outputs,0model_market_flags_daily. Preimage retained (1game/0player/0flags),SHA745bf67529333a5b330772c92eb2f3b174736a1e98e33e12f6acde7fa9b1299d. Counts describe stored rows, not SQL statement totals.

## Live acceptance and limitations
Public Game Grid read-only API after restore returned200, two boards admitted from exact run. LAK selected Darcy Kuemper (backup Anton Forsberg); NYI selected Ilya Sorokin (backup Semyon Varlamov). Status projected, not confirmed. Start and conditional-Win percentages remain null; candidate coverage unknown. No visual browser assertion made.
Selections expire03:00UTC; reader says frozen puck-drop receipt unavailable. Do not claim frozen acceptance or calibrated probabilities. Run reports53eligible skaters unknown because reserve pass disabled;21players without trend rows;1missing PBP history game. Full preflight passed, but these recorded limitations must not be represented as complete coverage.

## Evidence
SOURCE-PROOF.json; ANALYTICS-BEFORE.json; PREIMAGE-QUERY-RECEIPT.json; DEPLOY-STDOUT/STDERR; FINAL-GUARD.json; H1-ONCE-STARTED.json; H1-HTTP-RECEIPT.json; RECONCILE-1.json; ANALYTICS-AFTER-TRANSPORT-FAILURE.json; H1-CURL-STARTED.json; H1-CURL-RESPONSE.json; H1-CURL-RECEIPT.json; READBACK.json; FINAL-RECEIPT-READBACK.json; GRID-READBACK.json.
