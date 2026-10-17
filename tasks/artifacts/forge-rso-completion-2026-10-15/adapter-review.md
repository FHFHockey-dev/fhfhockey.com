# Independent bounded seasonal-adapter review

Reviewed the new seasonal adapter, optional preview/CLI path, targeted fixtures, shared 20-game reader limits, and `pipeline/reuse-and-production.md`. Followed only the recovered evaluator and arithmetic contract needed to verify mapping. No source changes, private outcomes, fitting, databases, production calls, or broad tests.

## Finding

**P2 — Validate the artifact prior's canonical player ID** (`web/lib/player-forecasts/seasonGameContributions.ts:20–23`). The adapter looks up `artifact.players[String(binding.playerId)]` and verifies NHL ID/team/season, but never verifies `prior.fhfhPlayerId === binding.playerId`. The recovered evaluator also trusts the map key. Consequently an internally inconsistent artifact is relabeled as the reviewed canonical player, despite the error message and runbook claiming exact artifact identity.

Demonstrated using a synthetic in-memory artifact through the existing `ts-node --transpile-only` runtime, without files or external access: map key `7`, `prior.fhfhPlayerId=8`, NHL ID 77, team 1, valid clocks/revisions, HITS rate 4 and appearance probability 0.5. Preparation succeeds and emits `forecast.playerId="7"`, `HITS=2`; expected behavior is rejection. All four allowed uses remain false, so this is an identity-validation defect in preparation, **not an admission bypass**. Smallest fix: add the equality check and one mismatched-prior-ID regression to the existing shared adapter fixture.

## Supported conclusions and limits

- Original primitive-presence and finite/nonnegative rate checks prevent absent primitive rates becoming evaluator-default zeros. Derived A/PTS/PPP require their listed primitive inputs; goalie saves require both SA and GA. Unknown appearance preserves null unconditional stats; invalid/absent or greater-than-appearance pStart stays null. Known zero appearance is a justified zero for supported counts, without treating unknown rates as zero.
- The evaluator multiplies appearance-conditional counts by appearance probability once. The adapter does not multiply by pStart. Original TOTAL_TOI is seconds; both native TOI outputs divide by 60 to minutes. Original GA>SA is rejected before evaluation, including zero appearance; evaluated saves/count identities, goalie W/SO bounds, and conditional minute ceiling are checked. These are mechanical checks, not predictive qualification or evidence that the old model estimates appearance/relief correctly.
- A fresh preview issue clock preserves the original training cutoff, model version, artifact checksum, component hash, and old-source limitation. Binding observation precedes issue, expiry precedes game, and future/expired clocks reject. This does not certify current news, membership, role, artifact lineage, or model freshness.
- Preview has no database writer, keeps every candidate's uses denied, reports `released=false`, and creates one exclusive private local file. The shared-view fixture explicitly changes permissions only for synthetic compatibility testing. No silent permission/admission promotion was found.
- Coverage is explicitly the supplied distinct reviewed bindings, capped at 1000, with up to 50 scope players/20 scope games. It reports absent scope-player/game representation and missing targets. The scope cannot establish expected team/player/game completeness; the returned `teamScheduleCoverage` limitation and runbook say so. Duplicate or unused scope rows do not create missing numeric contributions, but are not a complete release-universe inventory.
- The shared reader accepts 1–20 scheduled team games while retaining 21-day calendar/60-day discovery bounds. The new regression intentionally exposes only seven admitted rows in a 20-game request, leaving full totals and expected appearances unknown and retaining partial sums. It does not expand producer calendar admission or imply 20 player appearances.
- Runbook wording accurately leaves genuine inputs, native admission/publication, current roster coverage, role/participation evidence, and production/readback acceptance pending. No global readiness or predictive-accuracy claim is supported by this review.

Verification: inspected existing targeted tests without rerunning passing suites, per lead instruction. Ran only synthetic probes addressing demonstrated identity/context-validation questions. A nonfinite-context probe was rejected by canonical checksum validation, resolving that concern; the mismatched canonical-ID probe succeeded and establishes the finding above. Prior worker-reported 26 TS passes were **not independently rerun** here.

Reviewed SHA-256 pins:

```text
8c6e67d4f47000f747dff8dce8209ed44e4d124d1c3a0b7941ef343d21750d18 seasonGameContributions.ts
9e2541de9518d5cfcb2938f008190c5f7ed36c2005a2403465318d0e6ee10661 preview-native-baseline.ts
a46b3b08384bc279a2659aefdd4d5ea37a0a0a405f18a776c392f0b03698e1c1 preview-native-baseline.test.ts
7229622c0f0b7421f03ec8cb43779bc3e8572100733b20217e20c31a5b5c1fe9 gameExpectations.ts
efcc182f8363151043a94f539e87d57d1f1620466b3d383562d789664bc76800 gameExpectationReader.ts
36b15a0850a21fcc03b7517888ee8f700b1d9f800e484ddff8d8ad507afa4727 gameExpectations.test.ts
```
