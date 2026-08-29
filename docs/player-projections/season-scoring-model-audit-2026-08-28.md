# 2026–27 season scoring model audit — 2026-08-28

## Outcome

The 92.7-point Nathan MacKinnon projection and 91.0-point Connor McDavid
projection were invalid. `POINTS` was always a raw projected total; it was not
a mislabeled 0–100 production rating. Two model defects compressed scoring,
and two exposure defects distorted deployment:

1. Sparse per-game count ratios were clipped before context-profile fitting.
   Clipping destroyed their mean-one identity and selected an artificial 0.85
   home, away, and back-to-back multiplier for scoring targets.
2. Direct all-situations goals, primary assists, and secondary assists were
   replaced during reconciliation by sums of independently shrunk and
   incompletely covered strength-state targets.
3. Recent game rows exposed zero-heavy PP/PK TOI fields. Those fields reduced
   special-teams deployment even after correct season totals were available.
4. Team pace multiplied TOI. Pace changes event opportunity, but it does not
   change the fixed pool of regulation minutes.

The repaired current projection is 123.3 points in 81.9 expected games for
MacKinnon and 120.3 points in 76.6 expected games for McDavid. These remain
model projections rather than promises or editorial overrides.

## Audited evidence

The settled `wgo_skater_stats_totals` source contains 3,739 skater-season rows
for 2022–23 through 2025–26. The freeze records the query output, row count,
source timestamps, and SHA-256 digest. It is used only as settled historical
outcome/exposure evidence; it is not a forecast-time feature and no historical
`available_at` value is fabricated.

The audit rejects a freeze when any of these identities fail:

- `assists = total_primary_assists + total_secondary_assists`
- `points = goals + assists`
- `total TOI = EV TOI + PP TOI + PK TOI`, within source rounding tolerance

All 3,739 rows in the 2026-08-28 freeze passed. The four-season range is
explicit. Earlier seasons are not silently synthesized.

## Repaired model path

For an established skater and primitive target `y`, the season layer now uses
a recency-weighted exposure rate:

```text
player rate = Σ(season weight × y) / Σ(season weight × exposure)
EB rate     = (support × player rate + shrinkage × population rate)
              / (support + shrinkage)
game mean   = EB rate × projected game exposure
```

Exposure is target-specific:

- total, EV, PP, and PK TOI use games played;
- goals, primary assists, and secondary assists use total TOI;
- PP scoring components use PP TOI;
- SH scoring components use PK TOI;
- empty-net goals use games played.

The existing chronological development folds still select recency decay,
shrinkage, model family, and calibration. A challenger is served only when it
beats its frozen baseline without failing calibration; otherwise the baseline
remains active.

### Context

Per-game count context ratios are no longer clipped before shrinkage. Targets
replaced by the checksum-frozen season-total exposure model do not consume a
context profile trained on semantically incompatible game fields. Team pace
continues to affect event opportunity, while TOI is excluded from pace
scaling. Opponent defense may affect skater scoring opportunity; the player’s
own team offense is not multiplied into the historical rate a second time.

### Strength-state reconciliation

All-situations `GOALS`, `PRIMARY_ASSISTS`, and `SECONDARY_ASSISTS` are
authoritative. PP, SH, and empty-net components are bounded by those totals,
and EV is the exact nonnegative residual:

```text
EV = all situations - PP - SH - empty net
A  = A1 + A2
P  = G + A
```

This preserves the best-covered projection while keeping every displayed
identity exact. No fixed 70:30 or 80:20 assist weighting is used.

## Before and after diagnostics

| Player | Invalid points | Repaired points | Expected GP | Repaired P/GP | Conditional rate before schedule |
|---|---:|---:|---:|---:|---:|
| Nathan MacKinnon | 92.7 | 123.3 | 81.9 | 1.505 | 1.560 |
| Connor McDavid | 91.0 | 120.3 | 76.6 | 1.571 | 1.660 |

The repaired league distribution has three skaters above 100 points, with
Leon Draisaitl at 99.98. This is a diagnostic outcome, not a quota: the model
does not force a predetermined number of 100-point players.

MacKinnon’s conditional deployment is 22:14 total TOI and 4:06 PP TOI per
game. McDavid’s is 22:16 total TOI and 3:27 PP TOI per game. Season aggregation
applies availability and the 84-game schedule independently for each game.

## Evidence status and limitations

- The 2025–26 data has already been consumed for validation/training. It is not
  new blind evidence.
- Prospective 2026–27 games remain the untouched evaluation period required
  for champion promotion.
- Four complete settled season-total exposures are currently available in the
  local source. A fifth season should be added only from verified historical
  data, never fabricated.
- Game-level context for a season-total exposure target remains disabled until
  the same source semantics can be validated chronologically.
- Opening projections remain immutable. The correction creates new current
  and ROS releases and does not rewrite the earlier opening record.

## Verification gates

The corrected artifact and releases must satisfy all of the following before
the local active pointers move:

- v4 evaluation has no blockers;
- v5 advanced evaluation has no blockers and golden-vector replay matches;
- 1,468 player aggregates and 32 team aggregates validate;
- every aggregate retains its complete per-game component manifest;
- `p10 <= p50 <= p90` and all arithmetic identities hold;
- Python and TypeScript portable evaluators agree;
- local API and browser show the new immutable release;
- no hosted database, cron, Vercel project, or production pointer changes.

The final verified candidate uses v4 artifact checksum
`c286f9b45d89dc25671f32a860d299f3c82c277e7e8c2c7991c9f1f5b3b21e77`
and v5 artifact checksum
`cdfb5f45ec0ca8f48a9077bc34809f126f67db3962833411c6f60b46abc673c4`.
Both evaluation receipts have zero blockers; the v5 golden-vector replay is
byte-identical. The local database published immutable current release 13 and
ROS release 10 from that v5 artifact; each contains 1,468 players, 32 teams,
all 1,344 scheduled games, and zero validation issues. The active opening
pointer remains on release 6. The public local API returned both corrected
values, and the rendered `/fantasy-projections` page displayed MacKinnon at
123 points and McDavid at 120 with no browser errors. Publication and browser
acceptance were operational checks performed after model evaluation, not
evidence used to tune the model.
