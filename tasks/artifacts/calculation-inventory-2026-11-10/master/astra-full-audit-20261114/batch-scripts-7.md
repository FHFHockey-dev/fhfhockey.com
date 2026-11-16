# Offline native qualifier

All three frozen files read in full at `89da739cb`: 509 implementation lines, 463 test lines and 76 guide lines. Long markdown output was recovered before credit. Supplied tests were read, not executed; no qualifier, native producer, global fence, environment load, client, child or external action was run.

## AFULL-OFFQUAL1-01 — P2: offline timestamp sorting is lexical

- **Location/claim:** `web/scripts/qualify-native-players-offline.ts:115–123`. The retained-table adapter should preserve database ordering when the native reader selects latest evidence.
- **Evidence/scenario:** the exact adapter selects `2026-10-09T01:00:00Z` ahead of the later instant `2026-10-08T23:30:00-04:00` in descending order with limit 1. It also selects `18:00:00Z` ahead of `18:00:00.000001Z`. Comparisons use raw strings, although scalar timestamp filters correctly use microsecond-normalized values. Both counterexamples and filter/mutation/missing-column/count controls passed in `scripts7-probe-output.json`.
- **Fix/readers:** normalize timestamp sort keys with the existing microsecond helper, preserving null placement and ordinary text sorting. Add offset and fractional-precision ordering cases to the existing adapter tests. Affects native reader results and retained diagnostic provenance; no real retained export or production mismatch was observed. Qualification remains explicitly false.

## AFULL-OFFQUAL1-02 — P2: guide names an obsolete runtime

- **Location/claim:** `web/scripts/qualify-native-players-offline.md:3` says Node 22.11.0 for reproducibility; the frozen `web/.nvmrc` is 22.23.4.
- **Evidence/scenario:** both frozen strings are checked in the probe. Following the guide uses a different runtime than the repository pin. No actual runtime incompatibility is alleged.
- **Fix/readers:** reference the repository runtime pin in the operator guide and retain the approved typecheck command. Affects operators reproducing the diagnostic.

Receipt hashes/counts, original publication/receipt/verification ordering, pre-cutoff timestamps, cutoff-day completion, canonical roster identity, one regular-season pregame, immutable fictional fixture detection, suppressed writes, actual creation times and unchanged consumer admission were traced. Operator-provided bytes cannot authenticate their own provenance; the guide correctly disclaims that. Category coverage and qualification remain blocked even after successful native calculation or consumer admission. Code/input/output/query/result hashes are retained, input mutation is checked, and the output is exclusive-create with mode 0600.

The fence is installed before native imports, rejects network/child processes and mutations, and restores patched entry points and scoped flags. Its documented fresh-process assumption matters; this review does not claim isolation from arbitrary hostile module loaders. The trusted native graph is statically imported before its code hash. Tests cover inert client/config sentinels, microsecond cutoff filtering, missing tables/columns, hostile adapters, fictional relabelling, native provenance and category limitations. Timestamp **ordering** lacks the reproduced cases.

| Script | Bounds and stops | Resume and gating |
|---|---|---|
| qualify-native-players-offline | Input at most 32 MiB; one game/explicit targets; 150-second native calculation deadline; strict supported in-memory operations; rejects unobserved/missing/late inputs and attempted I/O | Exclusive output, input byte/hash consistency, no hosted writes or selected revision, qualification always false; fresh process required. No production approval consumed. |

The audit harness initially had a missing brace and then passed cross-realm plain options to the adapter. Both harness-only issues were corrected (null-prototype supported options); the exact source was unchanged, and the final finite probe passed once. These are not application findings.
