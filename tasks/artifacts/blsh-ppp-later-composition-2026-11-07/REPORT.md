# Later official PPP evidence candidate

**Status: composed locally; independent reviewer accepted the frozen candidate for evidence-only use, with no blocking findings.** See the lead's separate [PPP composition review](../blsh-v3-integration-2026-11-07/PPP-COMPOSITION-REVIEW.md). The frozen candidate and composition-time receipts retain their original pending-review state; they are not rewritten to imply approval at creation. Current recommendations, scoring, and activation remain unqualified. This packet is not a runtime input, recommendation, source repair, score calculation, NST-policy acceptance, or release.

## Result

Deliberately composed exactly the 44 later official PPP comparisons identified by the November 2 independent direct audit. The selected population remains **3,461 rows / 740 profiles**, drawn from the unchanged 8,135-row current capture.

| Evidence measure | Previous sidecar | New local candidate | Change |
| --- | ---: | ---: | ---: |
| Unresolved PPP fields | 212 | 168 | −44 |
| FP count-and-exposure-supported rows | 3,140 | 3,184 | +44 |
| FP count-and-exposure-supported selected windows | 482 | 507 | +25 |

Exactly 44 rows, 44 PPP field-evidence objects, and 44 profile FP-evidence aggregates changed. No supported window was lost. **The 507 supported selected windows include 417 five-record windows; they are not 507 five-game windows.** The gain of 25 consists of **24 five-record windows and one three-record window**. Nineteen affected profiles still have another unresolved field, discrepant field, or exposure hold. `PROFILE-DELTAS.json` identifies every affected profile and all 25 newly supported selected windows.

These are evidence-support counts, not new FP totals or scores. All captured metric objects, source counts, source IDs/order, source discrepancies, other fields and other tracks remain unchanged. Every existing `scoringAdmission`, `fullProfileQualified`, and `wholeProfileQualification` flag remains false. The candidate's added flags also remain false.

## Preserved holds and provenance

- All 18 genuine TOI mismatches remain held and their entire original row objects remain unchanged. Sixteen observations precede the source capture. The two later mismatches, **5598688 and 5599832**, remain held.
- All **207 older annotations** are copied byte-for-byte, including all **150 older agreements**. Those 150 PPP fields remain unknown. Held and outside-collection annotations are preserved too.
- All 62 original comparison objects are copied byte-for-byte, retaining literal matches, holds, prior sidecars, prior combined evidence, and older observations.
- Each of the 44 changed rows preserves its old PPP field object, exact old-sidecar and source-row hashes, comparison hash, source/player/game/date/team identity, native body/receipt hashes and paths, URL, source-capture time, observation time, and unknown original-publication time.
- Proof operands were rechecked against the retained native payloads using Decimal TOI comparisons. Complete payload counts, duplicate-player bounds, native identity/team, point partitions, dispatch/receipt bindings, and timezone-aware microsecond chronology were checked locally.

## Freshness is separate

The source was captured at **2026-11-01T19:57:38.026058+00:00**. Composition occurred at **2026-11-07T22:07:04.250415+00:00**, about **146.16 hours later**, beyond the capture's 24-hour threshold. `SUMMARY.json` explicitly marks it **stale**.

The previous profiles' `captureFreshness` objects are preserved as historical metadata assessed on November 1. They must not be read as a freshness assessment at composition time or now. Later literal field corroboration does not establish original publication, source freshness, source-revision cause, current recommendation quality, or full-profile qualification.

## Authentication boundary

`INPUT-BINDINGS.json` records 163 checked files and the retained binding used for each. The direct-audit pins, result, and inspected verifier are locally anchored, as are the previous sidecar's retained handoff and receipt. The previous profile output and composer are authenticated against that receipt; the previous composer is inspected but never executed.

The old direct audit's broad pin set is intentionally **not** rerun. `SKIPPED-AUDIT-PINS.json` explains all 126 omitted pins: 12 obsolete/unrelated application pins, 2 historical script pins, and 112 unneeded audit inputs. No historical script or holdout data is opened by this implementation. Obsolete application pins have no bearing on this separate evidence artifact and are not repinned.

## Checks actually run

- `python3 -B -m unittest -v test_compose`: **28 tests passed**, including zero/nonzero PPP, zero-shot eligibility, immutable inputs, duplicate identities, wrong source/team/date, source-row hash and old-sidecar drift, null/bool/negative operands, TOI/count/finality holds, forged flags, naive/equal/future/microsecond/offset chronology, selected-profile/metric drift, file-hash drift, partial/duplicate native payloads, native point partitions, and unchanged unrelated fields.
- `python3 -B run.py`: **passed**; wrote a new immutable candidate, preserving original files.
- `python3 -B recount.py`: **passed**. This separate implementation imports neither the composer nor runner nor old window code. It reconstructs exact changed-row/field/window totals and validates source identities, raw native operands, unchanged metric hashes, holds, annotations, and candidate hashes. This is additional verification by the author, **not independent acceptance**.
- No application suites, build, server, provider request, database operation, score computation, source repair, holdout read, runtime repin, NST-policy change, commit, push, or deployment. The bounded Python checks completed in under a second each; no heavy slot or process was left running.

## Exact hashes

- `candidate-01/ROWS.json`: `1552e2a043f549a34b178131f9ecc8ab50b01f7b481473dee37e98b15469a262`
- `candidate-01/PROFILES.json`: `b03ce39656537671d5d0d9e3d70e5273556581c105a8209d1a4aeda324d46f19`
- `candidate-01/SUMMARY.json`: `64e0d4370e27837c93da898f2d0b2299d6919f721bdadbcbf7a4f9a37150ad10`
- `CANDIDATE-SHA256.json`: `eb6fb9fef49cf9214af8f42cad2e392a05bcf9c1c9cefd98431cb3e92198fdb5`
- `INPUT-BINDINGS.json`: `95caacbd78770441d4ea9a56818c3b2f41f837a49c56fc28505eb77845e9a949`
- `RECOUNT.json`: `9abf77ecaa70bf4354672ce031e5eba0e16c08dfc6600d1d9109fd7d94e53f30`
- Unchanged captured-metric canonical digest: `a5239ab026f664b43530efd478283029c035ef0c00efddcc7f0c41281bd5766f`
- Unchanged selected-source-row canonical digest: `13ea4bfa98b0c4aa38986608e66170af14ea161bb5e383645f9dc984168c657c`

`FINAL-RECEIPT.json` binds all implementation, tests, logs, report, and candidate files. `CANDIDATE-SHA256.json` covers every candidate file.

## Remaining gates

Independent review accepted this composition for evidence-only use and verified all 163 input bindings and six candidate hashes. The 18 exposure holds, 150 older-observation limitations, retained discrepant fields, upstream 280 raw Game Score input gaps, stale current capture and operational-reference acceptance, real NST native-definition acceptance policy, full scoring qualification, and practical thresholds remain unresolved. No fresh recommendation or release follows from this packet.
