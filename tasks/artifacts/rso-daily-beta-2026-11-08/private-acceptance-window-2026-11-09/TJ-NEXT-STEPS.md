# RSO private acceptance — resumed November 9 window

**21:04 UTC update:** TJ supplied the current loaded input. Its inspection, the local schema repair and the exact remaining Best Fit/acceptance gates are in [the current report](current-input-2039/REPORT.md). The card below preserves the earlier 20:32 UTC preparation and historical checks; its pending-download step has been completed.

## Smallest next input

If RSO is already open with the plan TJ wants to inspect, use **More tools → Download planning evidence → Download loaded inputs**, then provide the resulting local file path. Keep the file private. The click handler creates a local JSON download from loaded state; it does not call a provider or save the plan. Opening/reloading a connected page can run other readers, so this instruction does not authorize starting a fresh connected session or refreshing Yahoo.

The resulting `rso-planning-evidence-v1` export contains the snapshot, original input clocks, provider snapshot if present, manager overrides and selected intent. It is **not a restorable backup**, and its `exportedAt` is not the original input capture time. Preserve all original clocks. Its private contents should not be pasted into the chat, mailbox or repository.

If there is no loaded plan or saved file, the precise next input is TJ's chosen **manual/local test context**, planning window and actual league rules/roster. Confirm the league's real slot counts, eligibility/reserves, scoring, acquisition timing/limits and time zone privately. Do not reuse the October fixture's roster or slot configuration as today's league. No current target, league or accepted outcome has been supplied to this lane.

## Five bounded checks

Use the supplied saved input in an agreed isolated local/offline context. These steps are prepared, **not recorded as completed by TJ**. Existing selected moves and refresh preferences remain the starting state.

1. **Inputs:** in **Roster and setup → League rules and scoring**, compare actual slots, eligibility, reserves, scoring and timing with the league. Use **Planning setup** for the window/time zone. Confirm inputs only after review. Keep unknown facts and unsupported rules visibly distinct.
2. **Baseline:** inspect the built-in no-move comparison without clearing the user's selected plan. Distinguish scheduled games, usable starts and supported projected value. Unknown/expired/unqualified forecast values must stay withheld; schedule acceptance can proceed independently.
3. **One chosen move:** in the isolated test context, choose one add/drop chain TJ actually wants to compare. Check effective time, availability, add limits, a started-game lock and the dropped player's lost contribution. A candidate must not silently replace manager-selected moves or protected players.
4. **Continuity:** inspect the selected plan, use **Undo**, and reopen only in the agreed offline/mocked local context. Verify return to the intended prior selection, protections and unchanged refresh preferences. Any invalidated plan needs an explicit repair choice. The October export has empty intent and cannot prove this case.
5. **Saved Yahoo, when supplied:** compare imported roster/slots/rules and input timestamps with the league. Reuse the same saved response for this check. Do not click **Refresh provider**, reconnect, acquire credentials or issue provider lineup/transaction writes under this preparation task.

Record only the target/source identity, manual or saved-Yahoo mode, pass/fail/pending for each check and a non-sensitive discrepancy. Keep the private roster, account identifiers and full response outside repository evidence. A missing original input or unobserved step remains pending, never a synthetic pass.

## Forecast evidence needed from its owner

The current runtime/forecast owner must provide an existing source-selection receipt and the original response from the same observation, or declare non-retention. For the interim bridge this includes top-level `bridgeForecasts.runs`, `rows` and response-only `proofs`, bound to the actual served run IDs and original capture time. A loaded-input export or saved workspace may omit that proof. The [saved-response preflight](../saved-input-preflight-2026-11-09/README.md) checks supplied original bytes without granting forecast use.

Native prospective qualification remains a separate owner gate: actual issuance/revision identity, permitted consumer uses, readbacks and the unchanged retained protocol. Neither historical publication evidence nor a bridge declaration supplies native approval. Do not run a new issuance, activate a catalog or query production to fill this gap automatically.

## Actual work completed in this continuation

| Existing input | Observed result | Limit |
| --- | --- | --- |
| Original October 16 public planning response, 2,310,709 bytes | Hash matches its original HTTP receipt and independent audit. Current source-pinned preflight passes: 1,065 players, 100 games, no decoded raw forecasts or bridge rows/proofs. Original capture time and exact request scope retained. | Historical consistency only; no current serving, forecast-use or authenticated acceptance. |
| October 16 loaded-input export, 5,780,319 bytes | Hash matches the original independent audit. Current snapshot schema accepts it and preserves rules, roster, locks, realized inputs and opponent fields exactly. It has 19 roster members, no provider snapshot, no selected moves or protected-player entries. | Saved manual input only. Empty intent does not prove nonzero selected-move continuity; this is not a restorable backup. |
| Four small named historical publication/cadence receipts | Still match their retained November 1 hash pins. | Historical metadata. The 14 MB combined readback receipt was only inspected for file metadata, not opened. No sealed October 23–30 payload was read. |

See [historical-check.json](historical-check.json), [historical-preflight.json](historical-preflight.json), [historical-export-check.json](historical-export-check.json) and [historical-export-inspection.json](historical-export-inspection.json). All inspected original files remained unchanged. Bodies were not copied into the repository. Both checks ran with inert environment and outbound guard; no network attempt was logged. The earlier 18 unit tests and 29 installed-checker tests were not rerun because their source did not change.

## Explicit live boundary

No live Yahoo/auth operation or production change is authorized here. The ordinary Yahoo read path can refresh OAuth credentials, store rotated tokens, acquire/release refresh leases and update reauthentication state. A today-onward horizon does not prevent those effects. If saved inputs prove insufficient, first prepare and obtain separate approval for the exact target, principal/date scope, fan-out/concurrency/runtime/DB bounds and permitted credential/status effects. The prior [bounded proposal](../2026-11-09/HANDOFF.md#smallest-private-acceptance-sequence) remains preparation only.

Current local ownership is this artifact directory, the existing RSO diary and append-only coordination. Application files, existing checker code, scientific scope and Claude/BLSH/Rankings work were not changed. No server was started; no provider/application/DB/auth call, fresh credential access, push or deployment occurred.
