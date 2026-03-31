# Individual Exact-Count Root Causes - 2026-03-30

## Scope

This artifact records the investigation result for remediation task `6.1` in `tasks/tasks-xg-release-remediation.md`.

Question investigated:

- what is causing the remaining individual exact-count drift in `shots_blocked`, `shots`, `icf`, `iff`, faceoffs, penalties, hits, giveaways, and takeaways after the shift-layer fixes?

## Files Reviewed

- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`
- `web/lib/supabase/Upserts/nhlEventInclusion.ts`
- `tasks/artifacts/xg-parity-root-causes-2026-03-30.md`
- `tasks/artifacts/xg-parity-rerun-2026-03-30.md`
- `/tmp/analyze-residual-individual-drift.ts`
- `/tmp/check-parity-vs-direct-inclusion.ts`
- `/tmp/inspect-residual-event-cases.ts`
- `/tmp/residual-event-cases.json`

## Representative Sample Used

Primary sampled games:

- `2025020982`
- `2025021003`
- `2025021018`
- `2025021119`

Representative players inspected:

- `8471685`
- `8475231`
- `8475314`
- `8478445`
- `8476389`
- `8480426`
- `8481524`

These were selected because they appeared in the residual exact-count error surface after the shift-id and TOI fixes.

## Finding 1: The Remaining Individual Drift Is Mostly Legacy-Versus-NHL, Not Parity-Versus-Parser

The residual summary split the sampled mismatches into two buckets:

- `legacy_vs_nhl`
- `parity_vs_direct`

Observed residual counts were dominated by `legacy_vs_nhl`:

- `shots_blocked`: `12 legacy_vs_nhl`, `0 parity_vs_direct`
- `shots`: `4 legacy_vs_nhl`, `1 parity_vs_direct`
- `icf`: `5 legacy_vs_nhl`, `2 parity_vs_direct`
- `iff`: `5 legacy_vs_nhl`, `2 parity_vs_direct`
- `faceoffs_won`: `2 legacy_vs_nhl`, `0 parity_vs_direct`
- `faceoffs_lost`: `2 legacy_vs_nhl`, `0 parity_vs_direct`
- `hits`: `3 legacy_vs_nhl`, `0 parity_vs_direct`
- `major_penalties`: `2 legacy_vs_nhl`, `0 parity_vs_direct`
- `misconduct_penalties`: `4 legacy_vs_nhl`, `0 parity_vs_direct`
- `minor_penalties`: `2 legacy_vs_nhl`, `0 parity_vs_direct`
- `giveaways`: `1 legacy_vs_nhl`, `0 parity_vs_direct`
- `takeaways`: `1 legacy_vs_nhl`, `0 parity_vs_direct`

Interpretation:

- after the earlier shift-layer fixes, the parity engine generally matches direct reconstruction from parsed NHL events
- the remaining drift is mostly because frozen NST credited or classified some events differently than the NHL public feed

## Finding 2: The Apparent Residual `parity_vs_direct` Shot Drift Was Probe Noise, Not A Parity Bug

The small `parity_vs_direct` bucket for `shots`, `icf`, and `iff` came from an ad hoc direct-count probe that did not apply the shared parity inclusion rules.

After recomputing the direct counts with:

- `evaluateNormalizedEventInclusion(event).includeInParity`

the parity engine matched the direct included-event counts for the checked players.

Representative examples:

- player `8477511`, game `2025021018`
  - direct included counts: `shots=3`, `icf=3`, `iff=3`
  - parity counts: `shots=3`, `icf=3`, `iff=3`
- player `8482093`, game `2025021018`
  - direct included counts: `shots=9`, `icf=12`, `iff=11`
  - parity counts: `shots=9`, `icf=12`, `iff=11`

Implication:

- no new parity-engine bug was confirmed in the residual individual shot-family surface
- the earlier `parity_vs_direct` signal was caused by the probe including excluded events such as shootout or penalty-shot contexts

## Finding 3: Faceoff Drift Reflects Upstream Credit Differences

Representative sample:

- player `8471685`, game `2025020982`
  - legacy: `faceoffs_won=11`, `faceoffs_lost=20`
  - direct NHL/parity: `faceoffs_won=12`, `faceoffs_lost=19`
- player `8475231`, game `2025020982`
  - legacy: `faceoffs_won=8`, `faceoffs_lost=7`
  - direct NHL/parity: `faceoffs_won=7`, `faceoffs_lost=8`

The traced event stream shows concrete NHL faceoff assignments such as:

- `eventId 295`: `8475231` won over `8471685`
- `eventId 302`: `8471685` won over `8475231`
- `eventId 434`: `8471685` won over `8475231`

Interpretation:

- the parity engine is following the explicit `winning_player_id` and `losing_player_id` emitted by the NHL feed
- the residual mismatch is a frozen-NST faceoff credit difference, not a new reconstruction bug

## Finding 4: Shot, ICF, IFF, And Shots-Blocked Drift Reflects NHL Event Assignment Differences

Representative sample:

- player `8478445`, game `2025020982`
  - legacy: `shots=2`, `icf=8`, `iff=5`
  - direct NHL/parity: `shots=3`, `icf=9`, `iff=6`
- player `8475314`, game `2025020982`
  - legacy: `shots_blocked=0`
  - direct NHL/parity: `shots_blocked=1`

The traced NHL event stream includes the relevant upstream assignments:

- player `8478445`
  - `eventId 322`: blocked-shot by `8478445`
  - `eventId 454`: shot-on-goal by `8478445`
  - `eventId 473`: blocked-shot by `8478445`
  - `eventId 556`: missed-shot by `8478445`
  - `eventId 664`: shot-on-goal by `8478445`
- player `8475314`
  - `eventId 450`: blocked-shot with `blocking_player_id=8475314`

Interpretation:

- the parity engine is counting the shot-family events the NHL feed actually assigns to the player
- the residual mismatch is frozen NST disagreeing with NHL raw shot-event attribution or blocked-shot crediting on a small number of plays

## Finding 5: Penalty Drift Reflects Classification Differences, Not Missing Penalty Events

Representative sample:

- player `8480426`, game `2025021003`
  - legacy: `major_penalties=0`, `misconduct_penalties=1`
  - direct NHL/parity: `major_penalties=1`, `misconduct_penalties=0`
- player `8476389`, game `2025021119`
  - legacy: `minor_penalties=2`, `misconduct_penalties=0`
  - direct NHL/parity: `minor_penalties=1`, `misconduct_penalties=1`

The traced NHL penalty events are explicit:

- player `8480426`
  - `eventId 333`: minor, `2` minutes
  - `eventId 19`: misconduct, `10` minutes
- player `8476389`
  - `eventId 702`: minor, `2` minutes
  - `eventId 949`: double minor, `4` minutes

Interpretation:

- the NHL feed is not omitting the penalties
- the residual mismatch is in how frozen NST bucketed these events into minor, major, or misconduct families
- under the current implementation, the parity engine is following NHL duration-based classification rather than frozen NST reinterpretation

## Finding 6: Hit, Giveaway, And Takeaway Drift Reflects Scorer Attribution Differences

Representative sample:

- player `8480426`, game `2025021003`
  - legacy: `giveaways=1`
  - direct NHL/parity: `giveaways=0`
- player `8481524`, game `2025021003`
  - legacy: `takeaways=0`
  - direct NHL/parity: `takeaways=1`
- player `8482671`, game `2025021003`
  - legacy: `hits_taken=3`
  - direct NHL/parity: `hits_taken=2`

The traced NHL event stream still contains the turnover and hit events, but the player credit in the public feed does not always match frozen NST's downstream tables.

Representative upstream examples:

- player `8481524`
  - `eventId 755`: takeaway credited in the NHL feed
- player `8480426`
  - multiple hits explicitly credited at `eventId 117`, `336`, `948`, and `1246`

Interpretation:

- the residual mismatch is not a failure to parse the event type
- it is a player-credit disagreement between frozen NST and NHL public event assignment on a small number of plays

## Root-Cause Summary

The remaining individual exact-count drift breaks down as follows:

1. resolved earlier
   - catastrophic parity failures caused by shift-row bigint-string normalization and duplicate-window TOI inflation
2. not a current bug
   - the small apparent `parity_vs_direct` shot-family drift was probe noise from not applying shared inclusion rules
3. current residual surface
   - mostly frozen-NST versus NHL public-feed disagreements in event credit or classification for faceoffs, shot families, blocked shots, penalties, hits, giveaways, and takeaways

## Conclusion

Current investigation result:

- no new parity-engine bug was confirmed in the remaining individual exact-count surface
- the parity engine now matches direct included-event reconstruction from normalized NHL events for the representative residual cases
- the remaining drift is primarily frozen NST disagreeing with NHL event assignment or penalty-family classification

This investigation sets up task `6.2`:

- explicitly decide which of these remaining residual families should be treated as approved NHL-correctness divergences and whether any narrow true-bug exceptions still remain
