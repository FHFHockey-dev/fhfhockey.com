# Amended FORGE qualification scope (draft for TJ, 2026-11-21)

[SCOPE-AMENDED.json](SCOPE-AMENDED.json) (`forge-qual-scope-v2`) supersedes the draft `scope.json` (`forge-qual-scope-v1`, protocolHash `49ae034a…`).

- **protocolHash:** `2acaff686c4953f60d17a17cfe0c59af76beb043e82a9a384b3a2824fb871469`. The repo checker's `canonicalHash` (`FORGE-QUAL/tooling/check-readbacks.mjs`) confirms it. File sha256 `1667940c…` (after the identity-fix wording, outside the protocol).
- **Supersedes** `dc9c87b7…` (part B rulings, before the bootstrap block) and the drafts `c9faf43d…` and `7d9e2368…`.
- **Bootstrap predeclared: TJ pop-up 2026-11-21 (values signed off, TJ pop-up 2026-11-21, unchanged).** The sign-off is recorded outside the protocol (`bootstrapSignOff`), so the hash is unchanged.
- **Status:** `amended_awaiting_identity`. The protocol is final as ruled. The identity fields stay PENDING until the identity fix ships, and are then pinned from the first qualifying revision (pinning doesn't change protocolHash).
- Nothing here was read from production. Thresholds and sample sizes come from the stated design assumptions, not from data.

## A. What TJ decided (TJ pop-up 2026-11-21, relayed by Chef)

1. **Targets:** SOG only → GOALS, ASSISTS, PP_POINTS, SHOTS_ON_GOAL, HITS, BLOCKED_SHOTS. *Reason:* Option B. League points need `totals` on every weighted target.
2. **Per-target claims:** each target passes or fails on its own and gets its own review. *Reason:* one `RsoTargetUseReview` per `targetKey`. Points show only when every weighted target passes.
3. **Per-target bias limit (|bias| ≤):** G 12%, A 10%, PPP 18%, SOG 5% (unchanged), HIT 7.5%, BLK 7.5%. *Reason:* low-rate targets are noisy. Each limit is 2.5× the bias's relative standard error at the sample size in B3. **The values are my proposal**, inside TJ's decision to set per-target thresholds.
4. **Per-target slope band:** G and PPP 0.75–1.25, A 0.80–1.20, SOG, HIT and BLK 0.85–1.15 (unchanged). *Reason:* predictions for low-rate targets span a narrow range, so their slope is wide. The values are my proposal.
5. **Look-1 harm stop, per target:** bias > 3× that target's limit (SOG keeps 15%), or the accuracy-gap lower bound > 0. It stops that target only; an integrity failure stops all targets. *Reason:* the original rule, applied per target.
6. **Issued value:** the revision's frozen "if he plays" line (`conditionalStats`) × 1 for a `_playing` basis, × 0 for `_out`, as the overlay (`forge-rso-participation-overlay-v1`, 47a1a2628) computes it at the readback. *Reason:* TJ's overlay participation.
7. **Evaluated prediction:** the RSO readback value. *Reason:* the overlay replays news at read time, so the served value can change after the revision cutoff without a new revision. One predeclared read time is required (when, see B6).
8. **Integrity:** the RSO readback equals the overlay recomputed from the frozen line plus the recorded participation sources. *Reason:* the value depends on read-time sources, which the live receipt records ([time, source id]).
9. **Assumed vs confirmed recorded:** per row, the basis, the conflict and line-role flags, the overlay's changes, and dressed (a strength row with TOI > 0). Bias, the accuracy gap, and a basis-vs-dressed table are reported per basis, descriptive only. *Reason:* TJ's request. Gates stay on the combined value users see.
10. **Baseline (a):** season-to-date per-game rate at the revision cutoff × the same overlay indicator (1/0) the row was served with. *Reason:* restated for overlay participation. Sharing the participation step keeps the comparison on the rate model.
11. **Settlement map:** G = goals_es+pp+pk, A = assists_es+pp+pk, PPP = goals_pp+assists_pp, SOG = shots_es+pp+pk, HIT = hits, BLK = blocks (null if any term is null), all from `forge_player_game_strength`. Penalty-shot goals and shots are excluded and reported. *Reason:* follows from the targets and matches what each projection sums (`starterBoardScoring.ts:219-229`). Columns are confirmed in the generated types.
12. **Identity fields:** PENDING placeholders, per the identity fix 6ca16d025 (TJ-accepted). codeVersion = the 64-hex verified producer closure hash in `inputProvenance.modelIdentity` **v2**, carried on rows as `GameForecast.producerCodeVersion`. `payload.codeVersion` stays the deploy SHA (the release pin): it is recorded per readback, but isn't bound and doesn't reset the scope. v1 and pre-fix rows are denied, and the overlay lineage must carry `@<revisionId>`. In the protocol's decisions line and reset rule, "codeVersion" means this closure hash (stated in `identity.codeVersionMeaning`, so the protocol hash is unchanged); configurationHash comes from `modelIdentity`; artifactHash = sha256({codeVersion, configurationHash}); component `forge-detailed-skater`; conditioning `rso_participation_overlay`; lineage method `forge-rso-participation-overlay-v1:skater`. *Reason:* TJ's identity fix; lineage and conditioning are what planning.ts:229-231 mints at 47a1a2628.
13. **Reset rule (core):** a producer change is a change of the closure hash (= codeVersion), configurationHash, artifactHash, or the participation method id. A deploy that leaves these unchanged does not reset. *Reason:* TJ's ruling; a deploy SHA isn't a producer change.
14. **Decisions line** now cites the 2026-11-21 amendments. *Reason:* provenance.

## B. Proposals ruled by TJ (TJ pop-up 2026-11-21: all eight adopted as proposed)

| # | Change from 49ae034a… | Why | Ruling |
|---|---|---|---|
| B1 | **Accuracy metric:** ΔMAE (upper 95% < +0.02 shots) → relative ΔMSE (upper 95% < +3% of the baseline MSE) per target; MAE kept as descriptive | The served value is a summed expectation. MSE is proper for means, while MAE rewards predicting 0 for G/A/PPP. This **drops the approved 0.02-shot SOG gate**. | Adopted, TJ pop-up 2026-11-21 |
| B2 | **Claim:** drop Start Chart from the claim and the readback | Start Chart has no use gate and doesn't apply the RSO overlay, so its value differs by design | Adopted, TJ pop-up 2026-11-21 |
| B3 | **Sample minimum:** ≥500 skater-games → per target G 3,700, A 3,300, PPP 3,300, SOG 2,100, HIT 1,600, BLK 1,900 settled rows | Enough rows to judge the A3 bias limits; the design priors per row are in the JSON | Adopted, TJ pop-up 2026-11-21 |
| B4 | **Final look:** slate 14 → the first slate ≥14 where every running target has reached B3; a target short at slate 28 ends inconclusive | B3 may not be reached by slate 14 if coverage is partial; still predeclared and bounded | Adopted, TJ pop-up 2026-11-21 |
| B5 | **Population:** canary games → every game with an admitted Detailed revision carrying the pinned identity; withheld rows counted, not scored | RSO serves every admitted game, so this matches what users see | Adopted, TJ pop-up 2026-11-21 |
| B6 | **Readback timing:** one read at the slate's first T-60 → one RSO read per distinct scheduled start time, at that start's T-30, each requesting the whole skater pool of its games | Pregame capture is per game: each game is acknowledged at its own T-60 (`deadline.ts` `ACK_LEAD_MINUTES`), so a single slate read at the first T-60 misses later games. **This is about 3–5 production reads per slate, not 1.** | Adopted, TJ pop-up 2026-11-21 (each slate's read plan still needs TJ's approval) |
| B7 | **Reset rule (addition):** also reset on any change of the served-value surface (sha256 of `consumerRevisionAdmission.ts`, `rsoParticipationOverlay.ts`, `rsoParticipationNotes.ts`) | The overlay sits outside the producer closure but changes the served value. **Tradeoff:** `consumerRevisionAdmission.ts` is shared consumer code, so any edit to it resets, which brings back some of the deploy fragility the core rule removes. | Adopted, TJ pop-up 2026-11-21 |
| B8 | **Baseline fallback:** fewer than 5 GP at cutoff → the position group's (F/D) season rate | The original didn't say what an early-season or call-up player compares against | Adopted, TJ pop-up 2026-11-21 |

Unchanged: D1 sealed block, horizon 1, D+1 12:00 ET settlement, version-2 repair rule, clustered bootstrap, two looks, no tuning between looks, a previous release as a descriptive baseline, integrity at 100%.

## Before slate 1 (not in this scope's control)
- **The identity fix ships and stamps the closure hash** as `payload.codeVersion` (and the pregame 40-hex pin check changes with it).
- **The overlay lane ships 47a1a2628** or its successor.
- **The checker is updated for v2.** `check-readbacks.mjs` today expects one target, MAE, two consumers and v1 identity fields. The update needs per-target thresholds, the B1 metric, the RSO-only overlay recompute, the basis strata, the B4 final look and per-start reads. This is local work with synthetic tests.
- **TJ approves the bounded production reads** (B6 reads per slate plus one D+1 settlement read).
- **Detailed publishes every game of the slate.** The 0359 pilot was one game.
- **The readback covers the whole pool.** Admission matches rows to the request's `players`, so a readback that names only one roster sees only that roster's skaters, not about 40 per game.

## Earliest slate 14
**Assumptions (best case):**
- The identity fix ships about Sat 2026-11-28, together with the overlay and the v2 checker.
- The scope is pinned from the first qualifying revision that day.
- Every game is published and read back with the whole pool.
- About 7 games and about 40 issued skater rows per game, so about 280 rows per slate.
- A game on each date. I didn't check the schedule; the Dec 24–26 break isn't in this window.

**Dates:**
- First slate: Sun 2026-11-29.
- Look 1 after slate 7: Sat 2026-12-05.
- Slate 14: Sat 2026-12-12. About 3,900 rows just clears GOALS's 3,700 minimum, so there's almost no slack.
- Final checker report: Sun 2026-12-13, after the D+1 12:00 ET settlement.
- After that, TJ's approval and the review release (its own build) follow.

**Sensitivity:**
- With partial coverage, the end slides under B4. At half coverage, GOALS needs about 27 slates, which lands around Dec 29–31 once the holiday break is counted.
- Each producer change under the reset rule restarts the clock.
- **Points need all six targets to pass.** One failed or inconclusive target leaves league points blank for any league that weights it, although its passing targets still show totals. A failed target needs a new scope and a new clock, so at least 14 more slates after a fix.

## C. Bootstrap (`protocol.bootstrap`). Bootstrap predeclared: TJ pop-up 2026-11-21 (values signed off, TJ pop-up 2026-11-21, unchanged)

| Setting | Value | Why |
|---|---|---|
| Applies to | relative ΔMSE per target and look (the gate and the harm stop); bias and slope intervals from the same draws are descriptive | Only ΔMSE has an interval-based rule |
| Replicates | 10,000 | Percentile tails at 2.5% and 97.5% are stable to about ±0.003 in the quantile at this count |
| Base seed | `7f8b18a3b1d413c5` (u64 9190466555921830853) = the first 16 hex of sha256("forge-qual-bootstrap-v1:" + `dc9c87b7…`) | Derived from the protocol hash fixed before any qualifying data, so it can't be picked after the fact. Recompute it to check |
| Streams | per (target, look): the first 16 hex of sha256("forge-qual-bootstrap-v1:" + baseSeedHex + ":" + targetKey + ":" + "look1" or "final") | Results don't depend on the order targets are processed |
| RNG | xoshiro256**, its state set by four successive splitmix64 outputs from the stream seed; index in [0, n) by rejection: draw a u64 x, reject while x ≥ 2^64 − (2^64 mod n), return x mod n | Exactly reproducible in JS BigInt; unbiased indices |
| Clustering | two-way crossed pigeonhole bootstrap, game × player (Owen 2007). The clusters are the distinct gameIds and NHL playerIds among the target's scored rows at that look, sorted ascending. Each replicate draws G game indices then P player indices, with replacement; a row's weight = (game draws) × (player draws) | Errors share game effects (pace, opponent) and player effects (per-player rate error); one-way resampling understates the interval |
| Statistic | (Σw·(FORGE−actual)² − Σw·(baseline−actual)²) / Σw·(baseline−actual)² | The relative ΔMSE of B1 |
| Interval | percentile, two-sided 95% (q = 0.025, 0.975), type-7 linear interpolation at h = (m−1)·q over the m finite replicates, sorted | Standard and needs no variance formula |
| Non-finite | a replicate with a zero baseline sum is excluded and counted; above 1%, the target is inconclusive at that look | Guards very sparse draws |
| Point estimate | the full-sample statistic, not the bootstrap mean | Conventional |
| Arithmetic | IEEE-754 doubles, sums in (gameId, playerId) order | Bit-for-bit reproducible |

v2 checker note: `clusteredBootstrap` implements exactly this, with a test pinning the first few xoshiro256** outputs for the base seed.

## v2 checker: what must change (not built)

All of this is in `tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/`. **The v1 checker computes no bias, slope or accuracy metric at all:** it checks integrity and counts settled rows. Every metric below is new code.

| Rule | File / function | Change |
|---|---|---|
| Scope v2 | `check-readbacks.mjs` `readScope`, `SCOPE_IDENTITY_FIELDS` | Accept `forge-qual-scope-v2`. Treat `amended_awaiting_identity` as unpinned. **Treat any `PENDING…` string as unpinned:** today only null counts, so a placeholder would pass as a pinned value. The identity fields become `targets, component, modelMode, modelIdentityVersion, codeVersion, configurationHash, artifactHash, horizon, conditioning, participationLineage, servedValueSurfaceSha256`. |
| 64-hex identity (fix 6ca16d025) | `readScope`, `REQUIRED_ISSUED`, `IDENTITY_FIELDS`, `checkReadbacks` identity loop | A pinned `codeVersion` must match `/^[a-f0-9]{64}$/`. Each issued row's identity `codeVersion` is read from `inputProvenance.modelIdentity.codeVersion` with `version === "forge-model-identity-v2"`, never from `payload.codeVersion`. Readbacks are compared on `producerCodeVersion`. Add `artifact_hash_mismatch` when artifactHash ≠ sha256({codeVersion, configurationHash}). Add `identity_v1_or_missing` for a v1, absent or 40-hex identity. Add `lineage_without_issuance` when the overlay lineage lacks `@<revisionId>`. The release pin (`payload.codeVersion`, 40-hex) moves to an optional recorded field (`releasePin`); it isn't compared against the pin. |
| Core reset + B7 | `checkReadbacks` identity loop, `IDENTITY_FIELDS` | Each readback records the producer closure and served-value-surface hashes. Add `identity_changed` and `surface_changed` findings when they differ from the pin; either one ends the scope. |
| B1 | new `metrics.mjs`: `targetMetrics(rows)`, `clusteredBootstrap(rows, stat)` | Per target: bias, OLS slope, MSE for FORGE and the baseline, relative ΔMSE with a 95% interval from a bootstrap clustered by player and game, and MAE as descriptive. Also strata by participation basis and the basis-vs-dressed table. |
| B3 | `metrics.mjs` `settledCounts`; `checkReadbacks` settlement loop | Count scored, settled rows per target (served rows only; withheld rows counted separately, per B5), against `targets.*.minSettledRows`. |
| B4 | new `lookPlan(slates, counts, scope)` | Look 1 at slate 7 applies the per-target harm stop. The final look is the first slate ≥14 where every running target meets B3; a target short at slate 28 is inconclusive. Rows need a `slateDate`, and the CLI takes `--look 1` or `--look final`. |
| B6 | `checkReadbacks` readback timing; `main`/`parseArgs` | Drop `--start-chart` (the main check at line 178 and the reader at 194) and set consumers to RSO only (B2). Replace `readback_not_pregame` with a per-start window check: the observed time is in [start−30 min, start) and after the game's own T−60 acknowledgement. Add `readback_group_missing` for a start time with no read. Readback rows carry `readId` and `startGroup`. |
| Overlay value | `checkReadbacks` value loop; `REQUIRED_ISSUED` | The issued row holds the frozen line (`conditionalMean`). The expected value = line × (basis ends `_playing` ? 1 : 0), from the readback's basis and recorded sources. Require `basis`, `participationLineage` and `overlayChanges` on readbacks; `participationRevisionId` becomes optional. |
| B8 | new `seasonRateBaseline(row, playerRates, groupRates)`; new `--baseline` input | The rate is the player's season-to-date per-game rate at cutoff, or the F/D group rate when GP < 5, times the row's served indicator. The input carries `gamesPlayed` and the position group. |
| Per-target settlement | `checkReadbacks` settlement loop | Accept an `actual` per target, mapped as in A11, plus `dressed`; keep the existing `recordedAt` rule and the version-2 repair rule. |
| Tests and docs | `check-readbacks.test.mjs`, `fixtures/scope.json`, `README.md` | Add a v2 fixture scope (fictional pin, same protocol and protocolHash) and synthetic cases for each row above; update the README's normalized schema. |

**Open gap:** the protocol doesn't fix the bootstrap's replicate count, random seed or two-way clustering scheme (neither did v1). Before slate 1, either record them as checker constants in each report, or add them to the protocol, which needs a new hash and TJ's sign-off.
