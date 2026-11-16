# Saved RSO response preflight — November 9

This file-only tool checks an existing planning response against its capture receipt and the current application codecs. It closes the bridge-response preparation gap; the existing native readback normalizer deliberately rejects bridge rows. It neither fetches a response nor grants forecast use or authenticated acceptance.

**Status:** implemented and tested with synthetic inputs only. No original current private response was supplied in the inspected handoffs, so no real-input result is claimed. Application code, provider state, refresh choices and manager-selected moves are unchanged.

## Inputs and command

Keep private files outside the repository. Supply the exact original response body, without reformatting or reconstructing it, and a separate receipt with these fields:

```json
{
  "version": "rso-saved-response-receipt-v1",
  "kind": "planning_data",
  "bodySha256": "REPLACE_WITH_SHA256_OF_ORIGINAL_RESPONSE_BYTES",
  "observedAt": "REPLACE_WITH_RECORDED_CAPTURE_TIME_AND_UTC_OFFSET",
  "seasonId": 20262027,
  "startDate": "2026-11-09",
  "endDate": "2026-11-09",
  "timeZone": "America/New_York"
}
```

This is an intentionally invalid illustrative template. Replace scope values with the original request's actual season, dates and league time zone. `kind` is `provider_snapshot` for `{success:true,snapshot:...}` or `planning_data` for `{success:true,data:...}`. The latter accepts the application's raw or compressed planning transport. A bridge response needs its original top-level `bridgeForecasts`, including response-only `proofs`; a saved workspace can omit that proof and is not a substitute. Do not insert today's clock, filesystem modification time, a deployment SHA or guessed identifiers to repair missing provenance. A caller-supplied receipt is not proof of capture authenticity.

Run from `web/` with the repository's Node 22.23.4 and already installed dependencies. No installation, server or credentials are required:

```sh
cd /Users/tim/Code/fhfhockey.com/web
env -i PATH="$PATH" TZ=UTC \
  TS_NODE_PROJECT=tsconfig.json \
  TS_NODE_TRANSPILE_ONLY=false \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' \
  NODE_OPTIONS='--require=/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-daily-beta-2026-11-08/verification-harness/guard.cjs' \
  node -r ts-node/register -r tsconfig-paths/register \
  ../tasks/artifacts/rso-daily-beta-2026-11-08/saved-input-preflight-2026-11-09/inspect-saved-planning.ts \
  /absolute/private/original-response.json /absolute/private/capture-receipt.json
```

The CLI verifies [source pins](SOURCE-PINS.json), bounds response reads to 4,000,000 bytes and receipt reads to 16,384 bytes, refuses non-files, and writes only a JSON report to stdout. Errors use fixed wording rather than payload fragments. The command clears inherited credentials and uses the existing outbound guard. Neither input file is written. Symlink entry paths are tested.

The optional third positional argument is an explicit evaluation timestamp, for reproducible historical replay only. Omit it for a current-expiry check. It cannot establish current serving, account access or transport authenticity.

## What a result means

| Result | Meaning and next step |
| --- | --- |
| Exit 0, `consistentAtCapture:true` | The supplied response passes this bounded schema/clock/binding check. Inspect every `currentUseHolds` entry. This is not forecast qualification or an acceptance pass. |
| Exit 1 | One or more fixed `findings` explain inconsistent, incomplete or unsupported evidence. Preserve the original bytes and route the discrepancy; do not edit the response to obtain a pass. |
| Exit 2 | Invalid CLI arguments, file/JSON problem or changed source pins. No acceptance result. Inspect the local files and source drift before retrying. |

The report emits counts, hashes, validated timestamps and fixed reason codes. It does not emit player, game, run, league or account identifiers, names, raw errors, tokens or input paths. Tests verify that malformed payloads and invalid evaluation-clock strings do not leak their contents.

The tool checks complete bridge row decoding, duplicate identities, scope and manifest bindings, run/proof population, issuance/cutoff clocks, current expiry, canonical player-game context and declared release/producer-closure registration. It counts literal unknown (`null`) and zero statistics separately. Registered release/closure declarations are not proof that a particular run executed that code or has predictive quality. A `captured_snapshot` declaration still requires its original evidence.

This preflight is deliberately stricter than the permissive display decoder: discarded rows, unused runs, or manifest/proof populations left over after response trimming require review. Such a finding is not by itself proof of an application bug. Non-wire/native forecasts receive a separate-use-review hold; this tool does not qualify them or evaluate scoring, lineup legality, completeness of pickup search or manager intent. A schedule-only response can be consistent while forecasts remain unavailable.

`authority` remains false for network verification, capture authenticity, serving-branch establishment, authenticated acceptance and forecast-use grants. The source selector's actual `source.kind` is not exposed as authoritative response metadata; neither a bridge prefix nor this report proves the deployed source-selection configuration. Saved data can be consistent at capture and expired now, which appears as a distinct hold rather than rewriting history.

## Smallest private acceptance and owner gates

1. **Existing input, manual first.** TJ confirms the actual league slots, eligibility, reserves, scoring and acquisition rules privately. On an agreed local/offline target, review the no-move baseline, one manager-selected add/drop chain with the dropped player's lost contribution, and a started-game lock. Check reopen/Undo/reconciliation without changing the user's refresh choices or replacing selected moves. Record only target/source identity, pass/fail and a non-sensitive discrepancy. Schedule planning can pass while forecast use is withheld.
2. **Existing saved Yahoo input.** The Yahoo owner supplies a previously authorized original response and capture metadata privately. Run this preflight once, then use that same input for slot/rule/roster continuity checks. Missing evidence stays unknown; unsupported provider rules retain their separate limitation. This is saved-input acceptance, not a fresh authenticated check.
3. **Current FORGE evidence.** The runtime/forecast owner supplies an existing non-secret source-selection receipt and original run/consumer evidence, or explicitly reports non-retention. For bridge inputs, bind each served run to the original response-only proof. For native inputs, use the retained installed checker and its unchanged prospective protocol. No new issuance, activation or production query is requested by this handoff.

The [previous bounded proposal](../2026-11-09/HANDOFF.md#smallest-private-acceptance-sequence) remains the reference if saved inputs prove insufficient. **No Yahoo operation is authorized in this sprint.** The normal Yahoo loader can refresh OAuth tokens, persist rotated credentials, claim/release refresh leases and update reauthentication state. A today-onward horizon only avoids past-lineup persistence. There is no confirmed enforced no-refresh/no-persistence mode. Any future live window therefore needs express authorization covering these effects, the exact target/principal/date window and complete request/concurrency/runtime/DB bounds; one provider POST can fan out to as many as 89 adapter calls / 178 resource GET attempts before additional auth/DB work. Do not invoke it under an assumed read-only label.

Native scientific qualification remains separate: the retained scope is `draft_identity_unpinned`, native RSO review entries remain empty in the inspected source, and the 14-slate/500-settled-game protocol is unchanged. No synthetic test, producer exclusion proof, deployment receipt or manual schedule check closes that gate. The earlier [private beta checklist](../PRIVATE-BETA-CHECKLIST.md) covers broader follow-up acceptance without authorizing live actions.

## Verification and source reconciliation

[RECONCILIATION.json](RECONCILIATION.json) records 32 distinct source pins, including all 16 reviewed RSO corrections, matching both their previous pins and locally recorded master #425 `d66408de3a0d1ccea1daaadfce8a3a9ae20cb680`. This lane did not query remote refs or deployment status. Prior 2,304-test/63-browser-case verification still belongs to its original candidate; it is not relabeled as a fresh full-master run.

The new focused suite uses actual application codecs, synthetic raw/compressed and provider fixtures, exact clock boundaries, malformed/oversized inputs, proof mismatch and CLI alias cases. See [tests-final.json](tests-final.json), [test log](tests-final.log) and [RESULT.json](RESULT.json). Earlier startup type failures are retained separately. No application suite, full build, live request, authenticated acceptance or production operation was performed for this artifact-only change.
