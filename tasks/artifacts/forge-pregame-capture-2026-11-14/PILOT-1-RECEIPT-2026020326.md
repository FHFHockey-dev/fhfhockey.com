# Pilot capture 1: game 2026020326 (EDM @ PHI): `source_failed` (refused safely)

- **Approval:** TJ's pop-up, P2: replacement game 2026020326, launched in about 30 minutes, attended. G1 lookup, D1 (migration 150, applied 14:06:02Z) and D2 (same key + post-hoc check) were cleared beforehand.
- **Code:** clean `git archive` export of candidate `6562138932daab6829ebc178221b19eb9e4cda4a`, profile `digicert-g4-v1`, policy `pregame-native-v1`. Credentials for this run only, never printed.
- **Times:**
  - Puck drop 19:30 ET (2026-11-16 00:30:00Z); T−60 18:30 ET (23:30:00Z).
  - Gate at 14:40:09Z: 1 other active query, longest 0 s, 0 lock waits.
- **Private receipt:** `~/forge-pilot/capture-2026020326-20261115T144009Z/` (`capture-receipt.json`, `postrun-verify.json`).

## Result
| | |
| --- | --- |
| Outcome | **`source_failed`**, reason `transport_refused:http_status:500` |
| Claim | `216da95d-4c33-4117-a7e0-ff78f251724f`; input cutoff 14:40:12.007787Z (database clock) |
| Timings | pin 686 ms, claim 108 ms, reads 30,295 ms, total 31,189 ms |
| Save / TSA / witness | none (0 saves, no TSA call) |
| Readback 14:41:08Z | no artifact, save fenced, outcome `source_failed`, both teams FUT/OK |
| Lookup | claim present, no witness, outcome `source_failed` |

**Which read failed:** `sustainability_trend_bands`, from `fetchSkaterTrendAdjustments` in `web/lib/projections/queries/skater-queries.ts`:
- filters: `.in(player_id, ~40 ids)`, `.in(metric_key)`, `.in(window_code)`, `.lte(snapshot_date, slate)`;
- order: `snapshot_date desc`, limit 12000;
- result: HTTP 500 from PostgREST.

The forecast writer **catches this error and continues** with no trend adjustments ("Error fetching sustainability trend bands for projections"). The capture's strict transport records any HTTP ≥400 (other than 406/416) as a refusal, so it refused the incomplete input rather than freezing a degraded packet. That is the intended behaviour; the refusal path works as designed.

**Not yet known:**
- The 500's database error code. The transport refuses on the status code before reading the body.
- Hypothesis: a statement timeout (57014, which PostgREST maps to 500). The `snapshot_date ≤ slate` predicate with `idx_stb_snapshot` / `idx_stb_player_metric` may scan a large table.
- Whether the live writer hits the same failure on its daily runs (`forge_runs.metrics` keeps trend fetch diagnostics).

**Consequence:** one attempt per (game, policy), so 2026020326 is closed under `pregame-native-v1`. No retry.
