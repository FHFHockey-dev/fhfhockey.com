# Independent re-review — shared forecast reload save correction

Verdict: **ACCEPT the exact corrected four-file increment for source integration.** The P2 account-save regression is resolved. No remaining actionable findings in the bounded reviewed change. This does not add the increment to the frozen release candidate or authorize live execution/deployment.

The initial rejection remains preserved in `independent-review.md` and `rejected-v1-receipt.json`. This report supersedes that rejection only for the corrected pins below.

## Correction assessed

`web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:838` now compares `workspaceContextKey(snapshot.context)` with the captured workspace identity. The existing key includes all seven identity fields: provider, season, league, team, start date, end date and timezone. Account/principal and late-request guards remain in place; context validation was not removed.

Lines 840–844 create a submitted workspace copy whose evaluation `asOf` matches the snapshot, then submit that copy with the snapshot. This removes the clock-only mismatch while leaving local workspace/Undo state, selected intent, rules and locks untouched. The original provider observation clocks remain in the provider evidence. The existing server `saveWorkspaceSchema` still demands equal complete submitted workspace/snapshot contexts.

The new component regression at lines 130–164 exercises shared reload followed by Save to account. It asserts exactly one mocked PUT, equal submitted contexts at the refreshed evaluation time, the selected manifest, retained intent/rules/locks/roster, the unchanged original provider roster-evidence clock, unchanged local workspace, no second provider refresh, and successful strict save-schema parsing. The author also reports the existing stale-version/account-switch case passed. These address the concrete rejected path.

The new helper and its 24-case test file are byte-for-byte unchanged from the initially reviewed candidate. The prior bounded assessment of identity matching, immutable provider inputs, unchanged contribution admission, unavailable/revoked sources and synthetic complete-swap arithmetic therefore remains applicable. No further broad review or test rerun was performed.

## Exact accepted pins

| Path | SHA-256 |
| --- | --- |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `a0dfe4351c8f7e4a021a0a7594c28981eb08391a221705993173f26c9d7d3870` |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `75f3c862c7a6f5accaa92534c72b4c4255b9e72405f7bbc903ba529bf9c46ad0` |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | `04e000d4d4b65fe2157a7bc45b0fe206ad9120fb491c2d9baaed8c334cbbe3a6` |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts` | `9deddddc4ed42adcbbcb4cfd73f4910527251836adbc028b354b42bbe51187eb` |

Artifact hashes observed after the final verification update:

- `change.patch`: `c5513b7a48d845aaf6f5076d53021f87c4acf1e3adcbc2113a09d3b6e070f85d`
- `receipt.json`: `6bd8d73170ad540e6f3a2cc81f39bb938d0534bb9e813be3cc070630f0c8199c`
- `HANDOFF.md`: `3d6d058435d0c433f7c12eabaeedef85b719d9996bedde46a5a711f55ab75ad3`
- Preserved rejected receipt: `6e0237253a9d611f58c0ef24a93ff35988339817bd5d923c3271ece390e2052c`

All four current source pins match the corrected receipt. Independent offline patch reconstruction from the retained before copies and the two additions reproduces all four current files exactly. The corrected patch remains confined to the declared four-file scope.

## Evidence and limits

The final retained author receipt reports main component 196/196 tests passed after the correction, helper 24/24 unchanged, scoped ESLint zero errors/three existing warnings, and diff check passed. The regression source, schema and receipt were inspected; the reviewer did not rerun tests or execute application code.

This re-review performed source/test inspection and local hashes/patch reconstruction only. The report is the only reviewer-written file. No source edit, runtime/browser/account/provider/database/network request, model execution, compiler or build occurred. Synthetic tests do not establish genuine issuance, released public-safe forecast availability, account acceptance, forecast quality or production parity.

The coordinated combined TypeScript pass remains separate and pending under sole compiler owner FORGE `01a135c8-567b-71d2-b610-6b78f3cc40d7`, after the required source freezes. No parallel global compiler was started here. Release inclusion and real-account/forecast qualification gates remain separate decisions.
