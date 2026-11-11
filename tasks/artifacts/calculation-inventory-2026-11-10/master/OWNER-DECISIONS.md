# Owner decisions for the math audit (TJ, 2026-11-10, by pop-up)

These answer TRIAGE.md section 5. Auditors treat them as the intended contract.

1. **Served game win probability (`INITIAL_BASELINE_MODEL`, M-GPR-026)** is a **placeholder**. Audit it as a stand-in. Benchmark it against the home-win rate, Elo-style and de-vigged market baselines, and specify a fitted replacement with a home-ice term.
2. **RSO streaming rank and recent form (C13, M-RSO-007/060)**: recent form MAY influence rank, but only **shrunk by sample size** (regressed toward the projection) and on the **same unconditional basis** as the projection. Size the current 50/50 raw blend as a defect against that intent.
3. **RSO players with no FORGE line (C15, M-RSO-014/030)**: first **find out why** the player gets an all-zero stat line and fix the cause. If no fix is possible, treat them as **unknown**: shown as no-data, **never auto-dropped**, excluded from drop proposals (the existing policy).
4. **Database access for auditors**: **yes, bounded reads** under the read-hygiene rules. Allowed: small LIMIT-ed reads by id or date, and catalog reads (`pg_proc`, `pg_views`, `pg_matviews`). Check `pg_stat_activity` first and stop if more than 5 queries are active or any query has run longer than 10 s. Not allowed: bulk payload/jsonb reads, unbounded joins, full-table scans of large tables, and any writes.

Facts Chef checked (2026-11-10):
- `NHL_XG_MODEL_ARTIFACT_PATH` is **not set** in the `fhfhockey` Vercel project (env names checked, no values read). The xG audit must establish what the prediction and aggregate routes do when it is unset: default path, failure, or skip. It also needs to establish which xG the site actually serves.

Facts Chef checked after W1-1 (2026-11-10):
- The full `fhfhockey` production env list (101 names, via `vercel env ls production`; names only) has **no `NHL_XG_*` variables**: not `NHL_XG_MODEL_ARTIFACT_PATH`, `NHL_XG_MODEL_VERSION` or `NHL_XG_TEAM_AGGREGATE_MODEL_VERSION`. FORGE is therefore not pinned to the leaky team xG prior through an env override; downstream audits should confirm the default path that code takes when the variable is unset.
- Refits must run against a **local copy** of the shot features (export once, bounded and paged, with owner approval), never as repeated full-table reads of production.

## Decisions after W1-1 (TJ, 2026-11-10, by pop-up)
5. **Leaky champion xG model cfg9bac2706**: leave it serving for now. Demotion waits for the fix plan, as its own approved step with a registry backup.
6. **Headline xG**: **Natural Stat Trick's xG (labelled as NST) is the headline** until a leak-free, converged in-house model is approved. The bucket heuristic (0.18/0.08/0.02 with a 0.25 goal floor) is to be retired.
7. **Empty-net shots**: **excluded** from team, player and goalie xG totals (and from GSAx/xGA) and **reported separately**. The model should distinguish shooting at an empty net from the shooter's own net being empty.
8. **Rush definition**: **4-second window**, no faceoff sources (the common MoneyPuck-style convention).

## Codex cross-check of W1-1 (relayed by TJ, 2026-11-10)
- Confirmed: the champion's 0.934 AUC is inflated by outcome leakage. The corrected candidate is 0.712 overall and 0.736 at even strength on 17,834 held-out shots. The 0.748–0.761 refit is a small-sample experiment, not a production result.
- Agreed: FORGE's team xG prior falls back to another source, so it does not read the leaky model through the env override.
- **Fix-plan constraint:** demoting cfg9bac2706 in the registry will **not** hide its existing aggregates, because some pages read them directly. The xG fix must enumerate and handle **every consumer** of the old aggregates (team Metrics Timeline, homepage game analytics, xG Lab and any others) rather than relying on the champion flag.

## Decisions from the W1-2 audit chat (TJ, 2026-11-10; recorded by Chef from audits/nst-derived-stats.md)
9. **NST-named metrics must equal NST's definitions.** On-ice tables count every attempt or chance by the player's team while he's on the ice; individual tables count the player's own. HDCF, SCF, Rush Attempts, OZS% and OZFO% follow NST (War-On-Ice style scoring-chance values, 4 s rush, OZ/(OZ+DZ)).
10. **The goalie column is whatever NST labels it: GSAA** = shots against × (1 − league SV%) − GA (expected goals against at league-average save percentage minus actual goals against), computed at the aggregate level (same season, strength and date range), never by summing NST's per-game values. GSAx can be added later as its own column.
11. **Leading and Trailing include one-goal margins** (any lead or deficit); Up 1 and Down 1 are subsets.
12. **Bucket heuristic xG: hide now, then fix.** Hide the xG columns on the player, goalie and team underlying-stats pages and move the default sort off xGF%. xG returns only from a clean trained model (see 6).
13. **A penalty-shot infraction is not a penalty** in a player's totals.
14. **NST burst rule (TJ, clarified):** all four windows hold together across every caller: 40/1 min, 80/5 min, 100/15 min, 180/60 min. A burst may be **39 or fewer** URLs and must be followed by **at least 60 s** before the next call. **Two bursts in a row must be followed by a 5-minute pause.**
    - Chef's read of the deployed function (`nst_admit_attempt_budget_v1` plus migration 20261109015836): a "78 semi-burst" is two 39-request waves. The 39/1 min cap forces about 60 s between them, and the 80/5 min cap then leaves at most 2 more requests for anyone until the 5-minute window clears. So it is **mostly compliant**, NOT the violation W1-2 D10 describes.
    - **Remaining gap:** after two bursts, up to 2 more requests can still go out inside the 5 minutes. TJ's rule wants a full 5-minute pause. Fix: once a plan's second wave ends, deny all callers for 300 s. The cadence correction must cover **every layer**, not just the database function:
      - the deployed `nst_admit_attempt_budget_v1`, as a committed migration;
      - the TypeScript client and gate (`web/lib/nst/client.ts`, `web/lib/nst/sharedAdmission.ts`, `web/lib/cron/nstRateLimitPolicy.ts` `canUseNstSemiBurst`);
      - the **Python admission gate** (`functions/lib/nst_admission.py`, `nst_get`) and the Python callers that plan bursts (`functions/api/fetch_team_table.py`);
      - **resumable callers** (catch-up/backfill jobs that stop and resume across invocations: NST goalie catch-up, bounded past-season backfill, team-stats date queue). These must re-check the post-burst and post-double-burst cooldowns on resume rather than relying on in-process timers.
    - Tests for each layer, run together: a 39-request burst then any call within 60 s is denied; two bursts then any call within 300 s is denied; 40 or more planned requests pace at ≥21 s; the same answers in TS, Python and SQL.
    - It goes in the fix plan's NST work.

15. **Player radar: move to 5v5** and label it "5v5".

## Review notes on W1-5 goalie-starters (TJ, 2026-11-10)
- The "named starter's saves/wins about 37% too high, partner's about 56% too low" figures are **inferred from average starter probabilities**, not measured errors in saves or wins. Treat them as an upper-level indication, not a measured magnitude.
- The Start Chart issue is **conditional**: its production serving flag is unverified. Chef checked env names only: `STARTER_BOARD_SERVING_ENABLED` exists in production, value not read. A **second fallback flag** also has to be checked before the Start Chart finding is confirmed.
- **Fix order:** first the actual-start outcome (who really started), the timestamps (`goalie_start_projections.updated_at` is never updated) and the pregame cutoffs (no look-ahead). Only then fit and validate replacement start probabilities.
- The proposed shrinkage (about 0.3 before the sigmoid) and the back-to-back adjustments are **hypotheses, not validated models**. They must be fit and validated on held-out dates before use.

## Review notes on W1-3 rolling and W1-4 team ratings (Codex/Astra reviews relayed by TJ, 2026-11-10)
**W1-3 rolling-player-averages-trends-part1**
- The four main defects are verified in current code: the seconds/minutes per-60 error, Rankings reading a rate where it expects a count, the trend display errors, and FORGE's exposure input. The FORGE issue affects **one evidence-weight component**, not necessarily the whole weight.
- Missing-row counts are from the audit's 2026-11-10 snapshot, not a fresh live check.
- Rolling/FORGE runs are currently held on `nst_persistence_unconfirmed` (also flagged to Scout). **First step: reconcile what those runs actually wrote before any retry or rebuild.**
- **Test correction:** don't assert "shots/60 ≥ 1". A value below 1 can be legitimate. The test recomputes the rate from the matching shot count and ice time instead.

**W1-4 team-ratings-power-ctpi-sos: recommended direction**
- Power ratings: compute from genuine games (one row per game, no all/5v5 mixing), then standardise **all 32 teams against the same daily baseline**. Keep pace separate. Label the 25-game, 10-game half-life rating as **descriptive**, not a proven predictor.
- PP/PK: displayed rates, ranks and tiers use **pooled season-to-date opportunities and results**. A recent-window view can be added separately.
- Game Grid: **fix or temporarily withhold** the misleading odds. Don't switch straight to the game-prediction model, which is still a placeholder (decision 1).
- CTPI: keep the newer candidate gated until it is validated. **Inventory dependencies before considering any legacy deletion.**
- Extra catches:
  - The Top Adds NaN reproduces in a local fixture; its visible impact is unchecked.
  - The proposed SOS helper can count an in-progress game as completed, so correct it before reuse.
  - Restoring early-season shrinkage alone won't work if the next normalisation step cancels it out.
