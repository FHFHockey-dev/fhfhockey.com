# Independent review — current-season SOG initializer

Verdict: **REJECT pending one P2 expiry-clock correction.** No other actionable finding was identified in the bounded four-file source/test review. This is implementation review only; no genuine outcomes or producer execution were used.

## P2 — retain a positive precise expiry after accepting a sub-millisecond target start

Location: `web/lib/player-forecasts/currentSeasonSogBaseline.ts:119`, following the microsecond target-start check at line 74.

The target validation correctly accepts a start strictly after the generation cutoff using `timestampMicros`. Packet expiry then converts that same start through `Date.parse` and `new Date`, dropping sub-millisecond precision. A valid target only one microsecond after the cutoff therefore emits `expiresAt === cutoffAt === generatedAt`. The initializer has returned a packet already expired at its creation, despite accepting the target as unstarted. This is a generated-clock consistency defect, not a request for a new release/promotion gate.

Source-level reproducer from `syntheticSogResponses()` with its existing `now = 2026-10-15T20:00:00.000Z`: change only the schedule target's `startTimeUTC` to `2026-10-15T20:00:00.000001Z`, recomputing that raw response's SHA-256 using the existing fixture helper. All history, capture, scope and target checks remain satisfied. Line 74 sees a one-microsecond positive interval; line 119 rounds the start to `20:00:00.000Z`, making the expiry equal the cutoff. This trace was inspected statically, not executed.

Choose the earlier of the exact target start and the 24-hour bound without truncating the selected target instant, or fail closed before returning an empty validity interval. Preserve original source strings. Add a focused short-positive-interval regression plus exact-start rejection and equivalent-offset controls. No legacy/shared clock or admission change is requested.

## Other inspected properties

The scope is fixed to the declared player/NHL identity, VAN team/season, target game/opponent and historical dates. The assembler checks exact receipt keys and URLs, recomputes raw UTF-8 body hashes, retains source strings/clocks, bounds aggregate response count/bytes, requires a fresh schedule receipt, verifies target context and selects the latest up-to-five final regular-season club games in the declared window. It requires the exact selected boxscore set and rejects duplicates/missing/extra/misbound sources.

Historical final capture clocks are checked at microsecond precision against game starts and the cutoff. Final game/date/start/team/player identity checks and the existing `baselineAppearanceFromBoxscore` validation are reused. Provider-byte and canonical-content hashes remain distinct. Positive-minute valid nonnegative integer SOG counts enter the numerator; the denominator is the number of admitted positive-minute appearances. Zero-minute/nonlisted rows are explicit exclusions, not zero shots or participation probabilities. Aggregate count overflow and an empty admitted sample are withheld. No prior-season/projection fallback, weights, participation estimate, uncertainty interval or consumer admission was introduced.

The offline CLI accepts only the two exact path arguments, opens the supplied input without following a final-component symlink, checks regular-file size, bounds the read and checks size/mtime stability, and creates a new output exclusively with mode 0600. It performs no source acquisition or database operation in the inspected path. The packet remains `unreleased_local` with null participation/uncertainty and denied public approval. Original source authenticity/publication/correction completeness is explicitly not established by replaying supplied bytes; this review does not add that claim.

## Exact reviewed candidate pins

These are reviewed/rejected candidate hashes, not accepted release hashes:

| Path | SHA-256 |
| --- | --- |
| `web/lib/player-forecasts/currentSeasonSogBaseline.ts` | `9d1b79b8aab5d50d8b68253f17f8fd6708df733bd1581784e4d63353780e1107` |
| `web/lib/player-forecasts/currentSeasonSogBaseline.test.ts` | `c98d51e7a7fa8a0b3f89ac72494332e8cfd8bcb7f8bc3f49c07507372d39c5fe` |
| `web/scripts/capture-current-season-sog-baseline.ts` | `be122c0f6f6dff32e483cca566bffb0d44421b63ce2388d4ba51ab96403d0dd2` |
| `web/scripts/capture-current-season-sog-baseline.test.ts` | `1bde29d9799f649f6bfa4f9b936def1131632c8ddb70ea26d5f1fcd8e4ff7f13` |

- `candidate.sha256`: `c80e1e1fa453a76d1a2c28772c86f3c6861bae91b50614d2dafdb215f966cda5`
- `change.patch`: `f900f687b950cc309361c02161500996cca683434cb27beeafb09d2d7ef04932`
- `verification.json`: `280ec625b51fc9a5a756396665f042d45ec32af9f2706a95ebdf265576d2839f`

All four source pins match the manifest. The patch contains exactly these four additions from absent files; offline textual reconstruction reproduces every current byte.

## Verification and limits

The retained author evidence reports 31 passing synthetic tests and the handoff reports four-path ESLint exit 0. Source/tests and verification artifact were inspected; neither tests nor lint were rerun by the reviewer. The expiry reproducer was assessed statically.

Reviewer actions were read-only source/test/necessary local dependency inspection, SHA-256 checks and patch reconstruction. This report is the only reviewer-written file. No application source edit, source collection, genuine numeric outcome read, producer/model execution, database/network/provider action, worker, browser, compiler or build occurred. No private-pilot evidence or labels were inspected. Correction and same-peer focused review remain required; no release, real-source execution or pilot authority is inferred.
