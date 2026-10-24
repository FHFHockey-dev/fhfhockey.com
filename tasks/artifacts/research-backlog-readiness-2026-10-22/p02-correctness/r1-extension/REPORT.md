# P02-R1 summary consumer extension

Implemented locally in the parent-granted three-file lease. Both independent imported-component failures now pass: a 27/30 appearance followed by a null-participation row no longer displays `0.900` as the selected window's SV%. Overview and Trends render `-` for SV% and GAA when participation is unknown or invalid. No ratio formulas changed.

## Exact delta and preserved work

- `web/components/PlayerStats/PlayerSummaryStrip.tsx:65–76`: check unfiltered participation before excluding nonappearances; withhold only goalie ratio metrics when support is incomplete.
- `web/components/PlayerStats/PlayerStatsSummary.tsx:22–35`: apply the same check to the selected regular-season/playoff log, before filtering.
- `web/components/PlayerStats/PlayerGoalieSummaries.test.tsx`: 18 imported-component regression/control cases.

The predicate matches the existing contextual consumer: numeric, finite, nonnegative `games_played`. Known numeric zero remains excluded before count/exposure aggregation. Complete paired appearances retain pooled SV and exposure-weighted GAA. Skater counts/SH%, observed zero ratios and playoff selection behavior have controls. This is caller validation, not a new participation definition or formula.

Both source pins matched the independent review before edits, with no local diff. All nine original P02 pins and 13 A7–A9 pins matched at start and finish. The original nine-file manifest is unchanged; the two extended consumers have **new** hashes in this directory's `CANDIDATE.json`. Earlier A7 edits are retained in before/after snapshots and the separate `extension.patch`. No shared registers were edited. HEAD at extension checks: `a565238f670edc4cf65da79ad52ba82ec41f3b71`; file hashes establish the candidate's scope in the shared checkout.

## Actual imported-code verification

| Check | Result | Evidence |
|---|---|---|
| Original independent reviewer fixture, unmodified | Before: two caller failures / six controls passing. After: eight passing | `RED.log`, `GREEN.log`, `ORACLE.json` |
| New summary regressions | Before: 11 failures / seven controls passing. After: 18 passing | Same logs; application test file |
| Combined focused run | 26/26 passing, two files | `GREEN.log` |
| Scoped TypeScript | Exit 0; original P02 scope plus the three extension files/imports | `TYPECHECK.log` |
| Three-file ESLint | Exit 0, no warnings/errors | `LINT.log` |
| Tracked source diff whitespace | Exit 0 | `git diff --check` over the two consumers |
| Candidate/source integrity | All 52 staged source files match checkout; nine original and 13 A7–A9 pins unchanged | `TESTED-SOURCE.json`, `FINAL-INTEGRITY.json` |

The first new skater-control assertion used the wrong existing Trends label/format (`Goals`/`1.0` instead of `G`/`1`). It was corrected before implementation; that diagnostic remains in `RED-initial-fixture.log`. The final red receipt contains only the 13 intended behavior failures. The independent reviewer fixture was never edited.

Tests imported actual components/helpers from a copied source closure. Existing installed dependencies were used, with an empty process environment except synthetic `.invalid` configuration, Vite `envDir:false`, and the existing network-deny setup. No API/DB/private data or credentials were accessed. The prior 96-test owner suite passed in independent review; it was not repeated for this extension because its nine source/test files remained pinned and the focused caller checks cover the changed behavior.

## Review and limits

No remaining execution blocker. Independent review of this three-file extension remains pending. `CANDIDATE.json`, `extension.patch`, `before/`, `after/`, and source/test receipts support that review; `COMMANDS.md` reproduces checks. Original nine-file acceptance is a separate receipt.

This does not qualify live goalie data, add omitted profile fields, reconcile the existing TOI type mismatch, or establish end-to-end P02 closure. Unsupported GAA/QS inputs remain unavailable. Existing all-zero/no-appearance summary visibility is unchanged. No browser runtime test, build, dependency change, query change, migration, formula/weight change, commit or deployment occurred.
