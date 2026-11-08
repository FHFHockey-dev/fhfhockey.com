# Independent BLSH provenance-gate review

**One P2 finding: fractional timestamps lose precision before chronology and freshness checks.** The real default policy remains closed, zero/missing handling is preserved, and no scores are computed. The positive admission path needs the timing correction before it can be accepted as enforcing the stated exact boundary. There is no demonstrated current native-source admission leak: real acceptances remain empty and the candidate is not installed.

Reviewed the actual contract, final TypeScript candidate/tests, unchanged qualifier copy, compiled output and saved replay in `/Users/tim/Documents/Codex/2026-10-27/task-3/current-process-provenance-gate-20261101-01/`. Candidate gate SHA-256: `7f01a95aa48b9121bf3a9b47307051b4aab5f468a84d606694b68e5dd05e4ab6`; tests: `907c9dc4e086d5887e2ba9ae2727c1c093bd58840d78b24bce99c2c454d3e52d`.

## P2: timestamps beyond milliseconds can cross the boundary undetected

Root: [currentProcessEvidence.server.ts:51](/Users/tim/Documents/Codex/2026-10-27/task-3/current-process-provenance-gate-20261101-01/candidate/currentProcessEvidence.server.ts:51). The regex accepts arbitrary fractional seconds, but `Date.parse` converts them to millisecond precision. That truncated value controls request/evaluation ordering at line 90, completion/evidence/evaluation ordering at lines 161–163, and capture age/future-capture rejection at lines 168–172. Lines 164–165 then serialize the rounded-down observation time as apparent millisecond availability.

Using only the existing explicitly fictional fixture builder and freshly hash-bound synthetic policies, the following independent probes admit the individual group with `qualified: true`, `provenance.state: "exact_reviewed_row_provenance"` and no provenance reasons when they should reject/withhold:

| Case | Relevant exact values | Expected |
| --- | --- | --- |
| Native receipt 1µs after evaluation | Receipt `2026-11-01T20:00:00.000001Z`; evaluation `2026-11-01T20:00:00Z` | Withhold individual |
| Official frame 1µs after evaluation | Frame observation `20:00:00.000001Z`; evaluation `20:00:00Z` | Withhold both groups |
| Observation 1µs before completion | Completion `19:10:00.000001Z`; receipt `19:10:00Z` on November 1 | Withhold both groups |
| Evaluation 1µs before source request | Request as-of `20:00:00.000001Z`; evaluation `20:00:00Z` | Reject evaluation |
| Source capture 1µs after evaluation | Individual capture `20:00:00.000001Z`; evaluation `20:00:00Z` | Withhold individual |
| Capture 1µs beyond allowed age | One-hour policy; captures `19:00:00Z`; evaluation `20:00:00.000001Z` | Withhold both groups |

All six admitted both synthetic groups. The first future receipt was additionally returned as `availableAtUTC: "2026-11-01T20:00:00.000Z"`, losing the portion that made it future evidence. The corresponding six **1ms controls correctly reject/withhold**, isolating the precision issue. All 12 probes give identical results under `TZ=UTC` and `TZ=America/New_York`.

Evidence: [TIMING-UTC.json](TIMING-UTC.json), [TIMING-America-New_York.json](TIMING-America-New_York.json), and [timing-probes.cjs](timing-probes.cjs). The original synthetic fixture builder was extracted into the audit's helper without constructing any real native acceptance. The probes deliberately assert the reproduced bad behavior and separately assert correct rejection of controls; their successful process exits are **not** evidence that the six negative cases satisfy the gate contract.

Preserve supported precision through comparison, duration arithmetic and availability serialization, or explicitly reject unsupported precision before admission. A fix must account for the actual retained request's six-digit timestamp `2026-11-01T19:57:38.026058+00:00`; silently truncating it or broadly rejecting existing valid captures is not a verified compatibility solution. Add boundary regressions for the cases above. No code change was made by this audit.

## Verified protections and limits

The frozen default policy accepts zero bundles. The original test that supplies caller-labelled all-strength/game-date/seconds feeds still admits zero groups without exact accepted provenance. No positive production or real NST compatibility claim follows from the fictional positive fixture.

The gate's trusted configuration binds the exact request, bundle, review, required artifacts and full rows. The policy is cloned. Missing/corrupt artifacts, changed request/bundle bytes, duplicate or empty witnesses, missing group witnesses and row-hash/identity drift withhold admission. Group qualification remains independent; a missing on-ice feed does not erase separately supported individual evidence. Only the declared scope/unit/date reasons are removable; other identity, participation, metric and exposure failures remain.

The reviewed source requires verified HTTPS receipt metadata, exact expected NST host/path/date/strength/count query scope and group, matching parser-input/body size and hash, producer/redactor versions, definition evidence, declared conversion contract and official final GP1 exposure equal to both stored exposures. Extra query keys such as `constructor` are rejected rather than accepted through prototype membership. Receipt JSON errors return stable reason codes and do not echo the malformed fixture text. Byte/count limits withhold instead of truncating inputs. These are source/fixture checks, not proof that the bound native HTML cells or model definitions are correct.

The native body is intentionally authenticated but not parsed. The contract correctly requires separate exact-cell/scope/conversion/model and official-frame review before a real server acceptance is configured. A trusted policy must remain deployment-owned; installing this function does not authorize taking policy or evaluation time from a client. No application route imports or installed candidate files were found in the bounded BLSH paths.

Zero shots and zero xG/process operands remain observed zero; there is no shot threshold. Missing/null metrics and GP=0 remain unqualified rather than coerced to zero. Ambiguous/missing process matches remain held. Counting discrepancies remain separate from process exposure admission. Crotty-like 700/702 and Deslauriers-like captured445/official444 fixtures reject admission. All successful synthetic outputs, including the timing-defect cases, retain `score: null`, `trusted: false`, and `productionAdopted: false`.

## Tests, lineage and saved replay

- **15 original focused Vitest tests passed independently** under Node 22.11.0 and explicit network denial. The three candidate TypeScript files were copied byte-for-byte into this audit's owned directory; no producer or application source was edited. See [TESTS.log](TESTS.log).
- **Targeted strict TypeScript compilation passed.** Independently compiled gate and qualifier JS are byte-identical to the pinned `compiled-final/` files used by the saved replay. See [CHECKS.json](CHECKS.json), [TYPES.log](TYPES.log), and [run-checks.cjs](run-checks.cjs).
- **24 targeted timing executions:** six reproduced boundary failures plus six rejecting controls in each of two timezones. No native source or scoring was involved.
- **38 pinned files authenticated and unchanged.** The application `currentInput.ts` and candidate copy both match `58a87ea119a98b33d7d67fb6849a269e375c22210610b607dfa30ba034c76232`; all ten shared scorer/preview/snapshot pins match. See [PINS.json](PINS.json).
- The completed producer lint receipt is authenticated as passed/zero warnings; lint was not independently rerun for this source-review-only task.

The checkpoint expressly asks not to repeat the unchanged full replay. I verified its exact executed source, compiled lineage, input pins, completed result/log and assertions, then independently recounted the captured inputs and saved profile memberships without rerunning the gate on all real rows. [REPLAY-INSPECTION.json](REPLAY-INSPECTION.json) confirms:

| Invariant | Verified value |
| --- | ---: |
| Unique captured WGO records | 8,135 |
| Raw production-complete / incomplete | 7,855 / 280 |
| Unique selected records | 3,461 |
| Saved profiles | 740 |
| Zero-shot profiles | 20 |
| Saved default-policy individual/on-ice admissions | 0 / 0 |
| Saved scores / network attempts | 0 / 0 |

Every selected ID exists in the captured source; selected player identities and zero-shot totals agree. The replay code compares every returned WGO row's canonical hash to the original and checks both groups remain withheld. Its recorded current evaluation is `2026-11-01T23:32:41.118Z`, separately retaining the request as-of `19:57:38.026058+00:00`.

Crotty remains WGO700 / captured NST702. Deslauriers remains captured445; the closed no-proof replay does not independently encode official444, and I do not claim that it does. Dvorak13–4 and Dubois4–11 remain the captured faceoff values. No saved counts, metric availability or source values changed. The gate and tests remain absent from the two proposed application paths.

## Disposition and remaining gates

Fix and re-review the P2 precision issue before accepting the positive provenance path. The evidence supports default-closed behavior and preservation of current data, not real NST admission, installation/consumer wiring, source repair or score adoption. Exact path ownership/registration, separate native semantics/receipt review, native evidence availability or explicit non-retention, and existing full input/reference/scoring gates remain open. No new threshold judgment or provider request is needed for this review finding.

No production/provider/database requests, source/app edits, holdout/excluded-season access, producer replay invocation, repair, score computation, build, deployment or Git mutation. Only own audit artifacts/diary were written. No owned process/lock or pending approval remains.
