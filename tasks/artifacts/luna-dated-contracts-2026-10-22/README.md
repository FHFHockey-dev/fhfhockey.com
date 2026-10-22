# Dated provenance and replacement contract packet

Task-local offline work on `octoberBranch`, starting HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. **No application file changed.** No credentials, private league/account export, network service, provider request, live alias/data write, deployment or automation was used. Existing trial inputs/results remain unchanged.

## Produced artifacts

| File | Purpose |
| --- | --- |
| `PUBLIC-EVIDENCE.json` | Minimal allowlisted derivative of the previously approved two-player export and owner-confirmed alias readback: public canonical identities, alias evidence and roster record metadata. No SQL, project/account configuration, credentials or grading labels copied. |
| `INPUT-PINS.json` | Exact original source hashes and saved request/directory bindings. Original files remain read-only. |
| `map-saved-provenance.ts` / `.test.ts` | Pure task-only projection into the existing v1 dated snapshot, with a complete retained provenance sidecar and explicit withholding reasons. |
| `DATED-SNAPSHOTS.json` | Two derived strict projections: knowledge cutoff at S06 publication, and knowledge cutoff at this review. Both retain two canonical players and withhold all four alias and two membership records from historical eligibility. |
| `S06-CLAUSE.json` | Exact source clause and unit spans plus incoming/outgoing occurrence IDs. This is an explicit development annotation, not proof of an automatic extractor. |
| `replacement-contract.ts` / `.test.ts` | Default-off, no-transport executable review contract for one explicit replacement grammar. Reuses the existing strict identity-output validator. |
| `REPLACEMENT-REVIEW.json` | Held two-subject S06 review packet using the saved validated proposal, with original full text, clocks, lineage, exact spans and source/hash bindings. |
| `APPLICATION-PACKET.md` | Separately described future application changes and decisions; none implemented in `web/`. |
| `prepare-artifacts.ts`, `vitest.config.mjs`, `tsconfig.json` | Bounded artifact generation and verification configuration. |
| `test-results.json`, `tests.log`, `tsc.log`, `prepare.log`, `PRESERVATION.json` | Final test/type/generation evidence and unchanged-input/reference proof. Initial failing logs are retained separately. |

## Time/provenance contract

`knownAt` is the earliest dated knowledge retained by this fixture: export observation time for legacy rows, owner confirmation time for RNH. It is **not** a claim that the fact first became true then. `recordCreatedAt` and `recordInterval` preserve database metadata separately. `effective` requires an explicit independently evidenced validity interval and provenance; none is present for these real saved rows. The mapper never copies a database creation or confirmation timestamp into `effective.startsAt`.

The output's `asOf = 2026-10-22T00:00:00Z` is a local projection bound, **not a new provider refresh or freshness claim**. `knowledgeCutoff` independently controls evidence availability. A causal historical evaluation must use the original source cutoff. A later retrospective review uses a different cutoff and must retain that distinction in its manifest. The snapshot's provenance hash binds the full sidecar and cutoff; per-record digest references preserve complete evidence within v1's 200-character provenance limit.

Saved real evidence:

- Ryan Nugent-Hopkins: `nhl:8476454`, registry `9521`; Vasily Podkolzin: `nhl:8481617`, registry `10190`. These namespaces never interchange.
- RNH remains owner-confirmed, verified and globally scoped for identity, known at `2026-10-20T23:03:35Z`. Its historical effective interval remains unavailable, including after confirmation. **Withholding it from this strict historical snapshot does not undo the completed live nickname write.** No new write is needed.
- Two canonical-name alias rows lack explicit scope/effective dates. The lineup alias lacks exported verification/effective dates. They are retained in the sidecar and withheld from dated alias eligibility.
- Both roster records retain their September 19 creation timestamps and open database intervals. Those are not independently verified team-membership effective dates. This strict adapter withholds them instead of silently promoting the earlier trial's record-interval convention to historical truth.
- Current position fields remain lexical directory attributes, not verified historical roles. Completeness remains a partial two-player universe; truncation forces partial/unknown omitted count. Conflicting evidenced memberships are preserved, not reduced to a guessed team.

Synthetic tests supply clearly marked effective intervals only to exercise valid admission, exclusive ends, microsecond ordering, knowledge cutoffs, team scopes and conflicting membership. Those test values are never written into the real `PUBLIC-EVIDENCE.json` or dated outputs. Wrong/foreign/swapped canonical links fail closed.

## Review-only replacement contract

The retained source says: “Podkolzin will take RNH’s spot on the first unit powerplay… via Babcock.” The development annotation binds incoming Podkolzin `[0,9)` and outgoing RNH `[20,23)` to separate occurrences. The contract requires a trusted locally prepared request and revalidates the saved raw proposal's request/directory/occurrence/ID/span bindings. It does not consume the owner grading artifact or ask a model again.

The executable grammar is intentionally limited to `<incoming> will take <outgoing>’s spot`, optionally followed by `on the first unit powerplay` or `on the second unit powerplay`; straight apostrophes are also supported. The complete annotated clause must match exact source text, ordering and grapheme-safe spans. The explicit “first unit powerplay” supports the review label PP1. A missing unit stays null. Unsupported/conditional wording, malformed spans, reversed subjects, absent/ambiguous identities, invalid IDs and altered source/directory bindings stay held. This is not a general language parser.

The result retains `reported_future_replacement` and the literal source quote. **Claim certainty remains `unassessed`**, regardless of the identity confidence labels. It emits no native remove/add effects and has no writer/transport/callback. The packet is always held for:

- unsupported native multi-player operation;
- unavailable prior-slot state;
- unavailable game/effective applicability;
- unavailable independent source-time membership;
- unavailable unit, when the source does not explicitly name it.

Publication, alias writes, status changes, replacement execution and provider dispatch are all false. Literal `enabled:true` permits only packet preparation; absent/false/string flags return before reading inputs. Whole source text—including a synthetic hostile wrapper—remains data, never authority. The output is a quote for review, not model-written lineup prose or a native Decisions statement.

**The saved model proposal remains bound to its original trial directory hash `1e95394b5e380e815f16bbc9c7b2c84d8a36ce8144d807556b0179c64f517e30`.** It is not rebound to either new stricter snapshot. The two artifacts answer separate questions: what the retained identity response said, and which historical evidence can enter a strict new snapshot. A later caller must prepare fresh matching input for its chosen directory; it cannot relabel an old response as reviewed against new candidates.

## Verification actually run

Node 22.11.0, npm 10.9.0; existing dependencies only.

- **30 distinct tests passed**: 16 provenance and 14 replacement contract cases. The earlier 252-test readiness pass is separate historical evidence, not an additional run or a denominator for this packet.
- Scoped TypeScript: **exit 0** on both task modules, tests and artifact generator plus their imported type closure.
- Artifact generation: **exit 0**, two strict snapshots and one held S06 review; no transport.
- All 40 reviewed trial pins, all five direct input pins, and the 33 readiness pins remain unchanged. Retained adapter digest remains `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`.
- No network-guard diagnostics in final test/type/generation logs. Config has `envDir:false`; execution uses an empty inherited environment, inert npm config, disabled npm background checks and the existing fetch/HTTP/TCP/TLS denial preload.

Initial regression run: 21 passed/8 failed because full provenance strings exceeded the existing snapshot's 200-character limit. The correction binds full retained evidence by digest instead of truncating it or weakening the snapshot schema; final tests pass. Initial scoped compiler failed on an unrelated implicit `@types/dotenv` stub; specifying the actual Node types required by this packet fixed configuration without dependencies or application changes. Logs are retained as `tests-first-run.log` and `tsc-first-run.log`.

No full application compiler, lint, build, browser, database or real-model test was run. This packet proves fixture projection/binding behavior, not model efficacy, automatic extraction, historical membership truth, or successful lineup replacement.

From `web/`, the final test and compiler commands used this exact common environment prefix:

```sh
env -i PATH="$PATH" TMPDIR=/tmp \
  NODE_OPTIONS=--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/network-guard.cjs \
  npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false \
  npm_config_userconfig=/dev/null \
  npm_config_globalconfig=/Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/empty-global.npmrc \
  npm_config_cache=/tmp/fhfh-luna-readiness-npm \
  npx --no-install vitest run --config ../tasks/artifacts/luna-dated-contracts-2026-10-22/vitest.config.mjs \
  --reporter=default --reporter=json \
  --outputFile=../tasks/artifacts/luna-dated-contracts-2026-10-22/test-results.json
```

For the scoped compiler, the same environment prefix was followed by `npx --no-install tsc --noEmit -p ../tasks/artifacts/luna-dated-contracts-2026-10-22/tsconfig.json`. Outputs were redirected to `tests.log` and `tsc.log` in this directory.

Artifact generation, also from `web/`:

```sh
env -i PATH="$PATH" TMPDIR=/tmp NODE_PATH=/Users/tim/Code/fhfhockey.com/web \
  TS_NODE_PROJECT=../tasks/artifacts/luna-dated-contracts-2026-10-22/tsconfig.json \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' \
  node -r /Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/network-guard.cjs \
  -r ts-node/register ../tasks/artifacts/luna-dated-contracts-2026-10-22/prepare-artifacts.ts
```

The fixture derivative used only allowlisted columns from saved files; no source query or paid execution script was run. Missing historical sources remain unavailable. No new denied action or uncertain external outcome occurred; the inherited paid uncertainty and all spending state were untouched.
