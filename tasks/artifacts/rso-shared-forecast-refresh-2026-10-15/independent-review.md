# Independent review — connected-roster shared forecast reload

Verdict: **REJECT pending one P2 correction.** The statistical overlay has an account-save regression. No other actionable finding was identified within this bounded review. The increment remains outside the frozen release manifest.

## P2 — preserve the save contract after advancing the evaluation clock

Location introduced by this patch: `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts:18`, applied at `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:570`. The successful read handler at main-component line 376 updates `workspace.context.asOf` only for manual workspaces.

For a connected provider workspace, the helper changes `snapshot.context.asOf` to `read.checkedAt` while the workspace retains the original provider `asOf`. The existing save guard at main-component line 838 requires `JSON.stringify(snapshot.context) === JSON.stringify(workspace.context)`. Consequently, a successful later shared-forecast reload causes **Save to account** to throw “Provider context changed. Refresh this workspace before saving.” before authentication or the workspace PUT. Subsequent selected moves cannot be saved through this otherwise unchanged path until the context mismatch is removed, ordinarily by a provider refresh. That defeats the intended independent shared-data reload and regresses account-save behavior.

Concrete source-derived example: provider/workspace `asOf=2026-10-12T12:00:00Z`, shared manifest `asOf=2026-10-12T12:01:00Z`, read `checkedAt=2026-10-12T12:02:00Z`. The helper admits the read and returns a snapshot at 12:02, while the connected workspace stays at 12:00. The exact-context save predicate is then false. This mismatch is also implied by the new helper fixture, but its test stops before account saving; the new component reload fixture does not grant account-save capability or exercise that action.

Required correction: make the refreshed evaluation context compatible with the existing save/load contract while preserving the original provider evidence clocks, authority, roster, rules, locks and selected intent. Add a focused connected-workspace regression that performs shared reload, then Save to account successfully, inspects coherent workspace/snapshot contexts in the submitted payload, and confirms no provider-refresh call was needed. Do not simply remove context/identity validation.

## Reviewed behavior and boundaries

The patch is limited to the four declared files. The explicit shared-read action uses the existing public data path and fresh read token. The connected overlay preserves provider players, games, roster, rules, locks, realized totals, opponent and non-statistical evidence. Its full provider/league/team/season/date/zone comparison prevents applying a read captured for a different context. Saved-view selection bypasses the overlay. Failed reads retain the previously stored overlay.

The unchanged contribution resolver revalidates target identity, schedule and roster revisions, release/use permissions, conditioning and expiry. The new synthetic tests exercise released baselines through legal planning and a complete timed swap, including the dropped player's lost contribution, and exercise unavailable/revoked inputs. These fixtures establish contract mechanics; they do not establish genuine forecast issuance, forecast quality, real provider compatibility or account acceptance.

The review followed the relevant existing save path, planning hook, provider-rule supplementation, shared-data loader, contribution resolver and resolved-forecast revalidation. No producer, provider adapter, planner, metrics, ledger or persistence implementation was edited by the reviewer.

## Exact reviewed pins

| Path | SHA-256 |
| --- | --- |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `f13be006670e1ba34f4ca6b65e9206dfb0bfba7bdb2ef64c1fb525283022ade3` |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `1d620494dc2883114dac6679262dff3d5a01329494b117e65109ef38b0fbc2f0` |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | `04e000d4d4b65fe2157a7bc45b0fe206ad9120fb491c2d9baaed8c334cbbe3a6` |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts` | `9deddddc4ed42adcbbcb4cfd73f4910527251836adbc028b354b42bbe51187eb` |

Artifact hashes observed at review:

- `change.patch`: `25856be434acfcc4cf0129be1890f0f676038e97db363f93ee85afb6e918a41a`
- `receipt.json`: `6e0237253a9d611f58c0ef24a93ff35988339817bd5d923c3271ece390e2052c`
- `before.json`: `ed53aaece640be40705b736ed9240dbe6f37d934fd830f9e3b75cb50df893525`

Both retained before copies matched their declared hashes. Independent offline patch reconstruction produced all four current files exactly, and all current file hashes matched the receipt. The source pins above are reviewed/rejected candidate pins, not accepted release pins.

## Verification actually performed

Read-only source/test/dependency inspection and local SHA-256/patch reconstruction only. No test suite, application runtime, browser, global compiler, build, database/provider/network request, worker or model execution was performed by this reviewer. The report is the only written file.

The author receipt reports 24 helper tests passed, the main component file 195/195 passed before the final small request-context capture adjustment, the three affected reload cases passed after that adjustment, scoped ESLint with zero errors and three existing warnings, and a clean diff check. These retained claims were not rerun. There is no coordinated compiler result for this increment. Correction and focused regression review remain required before acceptance or any separate release-inclusion decision.
