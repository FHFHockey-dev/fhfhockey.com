# Selected Release C restoration — local packet for independent review

TJ selected restoration of the previously approved model and deferred the hybrid k re-fit. This packet implements that choice in the canonical `octoberBranch` checkout at `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. The model baseline is `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd`. No Git mutation, capture, production call or migration occurred. This is not a new model qualification or a release commit.

## Exact scope and resulting behavior

`CANDIDATE.json` pins fifteen paths: nine source files and six tests. `before/` preserves every pre-edit byte; `after/`, `packet.patch` and `fixed-source.tar.gz` make the correction reviewable.

- `web/lib/projections/stages/skater-stage.ts`: restore Release C daily conversion, assist allocation and legacy bootstrap path; explicitly choose the legacy rest buckets. Preserve the null-safe team-goal accounting guard and standalone research helper definitions. Held Q7/Q8/count adjustments are not activated by the production call path.
- `web/lib/projections/constants/projection-weights.ts`: restore Release C conversion and assist k values; shot priors remain unchanged. `runProjectionV2.test.ts` restores the corresponding four numerical expectations without removing floating-point tolerance fixes.
- `web/lib/projections/run-forge-projections.ts`: stop claiming external-fantasy exclusion while the selected legacy producer permits those inputs. This file now matches Release C exactly.
- `web/lib/projections/apiHelpers.ts`, `web/pages/api/v1/forge/{players,goalies}.ts`, and `web/pages/api/v1/projections/{players,goalies,teams}.ts`: retain the released public legacy-reader contract. Do not require newer native-only provenance merely to display a legacy run. Off-release and horizon fences remain. `apiHelpers.ts` matches Release C exactly.
- Five contract tests: `apiHelpers.runAdmission.test.ts`, `nativeInputEligibility.test.ts`, `web/__tests__/pages/api/v1/forge/{players,goalies}.test.ts`, and `web/scripts/qualify-native-players-offline.test.ts`. Public-reader expectations reflect the explicit restoration; the actual producer-to-native-consumer tests now require rejection of legacy provenance, no admitted values, and `qualificationEligible: false`.

The public legacy API can therefore return the selected released estimates, including estimates which do not meet native target evidence requirements. This is the retained product baseline, not evidence that missing native inputs became known or that model quality improved. Native admission implementation, RSO policy/catalog, native bindings, bridge selection and Start Chart separation are unchanged. The native consumer rejects the reconstructed legacy producer with `use_not_approved`. No target approval was added.

The held research is preserved in history and the experiment owner's separate clone. Its U/UK candidates and later proposed capture remain outside this packet. No held model capture was performed here and the Release C evaluation window is unchanged.

## Verification and honest contract transition

Node 22.11.0/npm, isolated source, synthetic environment and network guards. Heavy commands held and released only this owner's atomic lock.

The initial thirteen-file run was **416 pass / 30 fail**, preserved under `attempt-01/`. Twenty-nine failures were expectations incompatible with selected legacy output/provenance; one was the CLI receipt's missing Git metadata in the source export. No application behavior was changed to bypass native admission. Original test bytes and failures remain available for review.

The revised five-file run is **108/108 pass**. It preserves temporal cutoff rejection, unavailable participation, source completeness, immutable receipts and no-network/write controls. It explicitly checks every reconstructed target has no native authority and every applicable admitted value is null. Existing independent native-contribution positive and negative cases remain unchanged.

Deduplicated evidence is **449 passing cases across fourteen files**: 108 final cases, 338 earlier cases in unchanged files, and three parity cases. This total is not a rerun of the whole combined release. Per-file receipt selection is in `CANDIDATE.json`.

Three artifact-only parity cases compare actual Release C sources: prior objects; 98 rest-factor combinations; twelve goal-conversion and twenty-four assist-share combinations. Shot-prior constants are checked, but the third historical test title overstates dynamic shot-rate coverage: no dynamic shot-rate comparison was executed. These checks establish selected formula equivalence within those fixtures, not forecast accuracy or replay equivalence for unavailable historical captures.

Final scoped TypeScript and ESLint both pass with no warnings/errors. Diff check and reverse patch dry-run pass. Fifteen canonical pins and protected native/bridge dependencies have no drift. The first run's Git-metadata problem is fixed only in the verification harness: a read-only `.git` symlink serves the CLI's `rev-parse HEAD` and `branch --show-current`; no `GIT_DIR` or Git mutation is used. The source hashes identify the overlay; its reported origin commit alone does not.

## Reproduce and review

- Patch SHA-256: `fe0347df83454378072103b669bfee9a594fb69138215e281b5e9fac14f54c2c`.
- Fixed source archive SHA-256: `362c8020b99d5b7993d8c0028e6293ac588da1e62dfc76a4298dd28b75e41556`.
- `FIXED-SNAPSHOT.json` pins the entire supporting source export. Foreign files inherited from the trusted-Yahoo snapshot are test context, not blanket release acceptance.
- Extract the archive into a disposable directory, link the existing `web/node_modules`, use the synthetic environment and offline config in `COMMAND.json`, and run its exact npm argv from `web/`. The CLI receipt case additionally requires readable origin Git metadata as described above. `STATIC.json` records the scoped type/lint argv. The earlier unchanged-file commands and parity evidence are in `attempt-01/`.
- `verify.py` builds a new overlay from canonical files; it is not the immutable replay command.

Independent review and parent inspection of the restored producer/public-reader/native-consumer distinction are pending. Final accepted-source composition, full candidate type/lint, exact-SHA browser acceptance and deployment checks remain separate gates. No release SHA has been created or supplied to Claude.
