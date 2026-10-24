# Slice02 R1 — per-game validity correction

Author correction frozen for independent re-review. Scout retains acceptance. Original S02 packet, original reviewer failure evidence and six failing probes are preserved unchanged. S03 preview handoff remains paused; no claim of accepted calculations.

## Correction

- `web/lib/player-cards/aggregation.ts`: before summing a metric, validate each game’s required components and units. A positive per60 numerator with zero matching game TOI is missing/inconsistent; it cannot borrow another game’s exposure. A ratio numerator greater than its compatible game denominator, including positive/zero, is missing/inconsistent before pooling or zero-denominator classification.
- Compatible zero-events/zero-exposure rows remain eligible appearances. `(0,0)` ratios remain genuinely undefined when the pooled denominator is zero; they can contribute zero components to a compatible nonzero pooled denominator. No minimum-GP/TOI threshold was introduced. ATOI/actualGP and unrelated metric pools are preserved.
- Existing adapter propagation is reused unchanged: an inconsistent peer is metric-specific missing/incomplete, does not enter known-undefined, prevents that metric’s league rank, and does not alter a valid selected player's own value or unrelated metric rank.
- `domain.test.ts`: two old controls used positive goals with zero shots while expecting known undefined. Corrected those fixture goals to zero so they test legitimate `(0,0)`. The invalid positive/zero case remains explicitly covered as missing in the new regression suite and unchanged independent probes.
- New `aggregation.r1.test.ts`:7 regression/control cases for exposure borrowing, individual/on-ice/IPP impossible rows, positive/zero versus zero/zero, preserved GP/ATOI and affected peer coverage/ranks.

Exact transfer: CODEX-PLAYER-CARDS-S02-R1-20261024,17:17:47.435932UTC. Before editing, both original source files were saved byte-for-byte under `baseline/` and matched coordinator hashes. `source.patch` is against those exact bytes; new regression file is an absent-file addition. No windows/adapter/shared/upstream/UI source correction was bundled.

## Checks actually run

From `web/`:

1. `npm test -- --run lib/player-cards/domain.test.ts lib/player-cards/aggregation.r1.test.ts` —26/26 (19 original controls +7 new regression cases),2 files.
2. `npx tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-02-r1/tsconfig.json` —passed exact R1 source/tests and nearby active fixture-flow types.
3. `npx eslint lib/player-cards/aggregation.ts lib/player-cards/domain.test.ts lib/player-cards/aggregation.r1.test.ts lib/player-cards/interactionSnapshot.ts components/player-cards/InteractiveCard.tsx components/player-cards/PlayerCardFlow.test.tsx` —passed. Nearby S03 checks cover its pre-existing pending changes; no S03 source was edited during R1.
4. `npm test -- --run components/player-cards/PlayerCardFlow.test.tsx` —7/7, including interrupted loads, duplicate-name identities, own/calendar controls, unavailable states, frozen export/repeated click and queued history changes.

From root:

5. `node tasks/artifacts/player-cards-2026-10-24/slice-02-r1/counterexamples.original.cjs` —29/29 actual-source probes, zero network attempts. F01a/F01b/F01c/F02a/F02b/F01d all now pass. This is a **byte-identical copy** of the original reviewer script, at the same directory depth so outputs go only into R1. The original probe and original23pass/6fail receipt were not changed or overwritten.
6. `node tasks/artifacts/player-cards-2026-10-24/slice-02-r1/capture-reconciliation.original.cjs` —four prior-capture pooled values, two unavailable controls and one documented L10 gap pass, zero network attempts. Also a byte-identical reviewer-script copy with R1-only outputs. No new observed readiness or league coverage inferred.
7. Protected artifact/source integrity: EVIDENCE.json records all63 original S01/S02/reviewer artifact files unchanged, all9 S01 source pins unchanged, and untransferred S02 windows/adapter source unchanged. Baseline and copied-probe hashes independently compared locally.

No failed command in this correction, no denied/pending/uncertain operation. No new browser/server/Library/service/provider/production request, source repair/backfill, Git/index, install, deploy or worker. Existing Node22.11.0/npm10.9.0; no GIT_DIR. No broad app checks/build.

## S03 and remaining gates

S03 has6 new exact leased files for a computed18-player **synthetic** fixture flow. Initial candidate7 component tests, scoped types/lint and8 offline browser checks with3 PNG/manifest downloads passed before this R1; a subsequent S03 honest unavailable-GP adjustment and this corrected dependency mean the static artifact must be rebuilt and its affected browser checks rerun before handoff. Nearby7 current-source tests/types/lint pass against R1. Do not present the older S03 artifact as current verified source.

The existing3125 server was not stopped or replaced and still serves the original frozen S01 buffer. Original S01 synthetic-preview acceptance remains separate. After R1 independent review, resume S03 under its recorded lease, rebuild/verify the exact candidate and use the conditional own3125 handoff; preserve original artifacts. Route/auth/real search remain ungranted, no premium allocation activated.

Source completion/history/model/strength/full all-NHL population and rights proofs remain unresolved. Proposed product policies remain unapproved. This correction fixes local consistency, not those external gates. Library TLS blocker remains; no retry/workaround attempted.
