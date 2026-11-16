# RSO private beta — November 9 continuation

The retained offline checker is installed and verified. The remaining daily-beta work is private acceptance and current forecast evidence, with separate paths for the already permitted interim bridge and native forecast qualification.

## Completed locally

- Resolved the two-file installation under TJ's November 8 RSO retention decision and the current explicit installation task. The older FORGE-QUAL entry was an artifact-only audit with no exact write paths; there was no competing exact writer and neither original file had drifted. [CUSTODY.json](CUSTODY.json) records the authority interpretation, original hashes and exact claim. This does not assert a new Claude acknowledgement or alter anyone else's register.
- Installed the prepared patch in `tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.mjs` and its existing test. **29 installed-layout tests passed**, zero failures/skips, using synthetic fixtures, Node 22.23.4, inert environment and an outbound guard. [Receipt](installed-checker.json), [log](installed-checker.log). Scope, protocol, fixtures and all application files are unchanged.
- Reconciled the new locally recorded release: **all 16 reviewed RSO corrections match master #417, `1e170b6d028d3a0e67483ffa68ed8727fd05dca1`**. Its tree equals the observed canonical HEAD `483205af5`. Claude's existing release diary reports #417 READY and three successful smoke requests. This lane made no remote deployment query or smoke request. [Reconciliation](RECONCILIATION.json).

The November 8 2,304-test/63-browser-case receipt still identifies its original isolated candidate. It is not relabeled as a fresh test of the whole #417 tree. No application suite was repeated for this artifact-only installation. The 16-file release-composition gate is now superseded by observed inclusion in recorded master; do not replay that patch or request another deployment for it.

## Current FORGE evidence: select the actual path first

The live serving branch is **not established by the local source or existing release diary**. Obtain an existing saved current RSO response/source manifest from the runtime owner before choosing a qualification path. Eleven relevant source files match recorded #417; the source facts below are pinned in `RECONCILIATION.json`.

| Actual source | Evidence to obtain from an existing authorized capture | What it can establish |
| --- | --- | --- |
| Interim `forge-daily-bridge-v1` | Original planning response including `bridgeForecasts.runs`, `rows` and **response-only `proofs`**; served run IDs, issue/cutoff/expiry, season/player/game bindings and observation time; proof basis (`captured_snapshot`, `verified_producer_closure` or `verified_release`) bound to each actual served run. Retain exact bytes/hash privately. | The separately permitted bridge's current input/provenance and consumer behavior. A saved workspace alone may omit the response-only proof. This is not native forecast-quality approval. |
| Native catalog / detailed captured-live revisions | Actual selected catalog/revision/snapshot/run identities, model/configuration/artifact identity, issued participation, exact eligible player-game-target population, consumer readbacks and current allowed uses. For the retained SOG scope, supply the protocol inputs and comparator/settlement evidence below. | A possible prospective qualification packet. The source's RSO native review catalog is currently empty, so an emitted native row or an admitted producer closure alone grants no target use. |
| Flagged fallback, empty or withheld source | The actual source reason, exclusion/limitation counts and observed clocks; preserve unknown values and denied uses. | Schedule-only planning acceptance and a precise data prerequisite. Do not silently select a different forecast path to make a projected gain appear. |

Source selection matters: the bridge runs only when the selected source is `legacy`, no detailed forecasts/baseline sources were admitted, and the bridge is enabled. Native activation and its flagged/empty fallbacks do not silently switch to it. Denying native use also does not trigger the bridge. Readback labels or a revision prefix cannot authorize a branch.

The November 7 goalie-recovery receipt records **zero new FORGE runs in that check**. It is historical evidence about that recovery, not proof of present issuance or a present outage. Current producer-closure entries prove exclusion of external fantasy inputs; they do not identify today's served generation or establish accuracy.

### Retained native SOG qualification

The installed checker's scientific scope remains `draft_identity_unpinned`, SHA-256 `16b7092bea0ba307d07c1b8de3c4559533cc3a044a3af4264abd80dd397ffbe5`, protocol `49ae034acc864a291393dc27e86cc745697ca83e18cc2f9666508f07db46a4ef`. No scope identity or review approval was invented.

The current legacy FORGE runtime/qualification owner must supply or explicitly declare absent:

1. Existing deployment-specific non-secret source-selection/configuration receipt and original released `captured_live`, horizon-1 issuance identity; use the issuance's own model/configuration/artifact tuple, not the deployment SHA or current defaults.
2. Exact selected immutable revisions and RSO/Start Chart readbacks for the same population, including observation clocks. The first eligible post-October-30 slate and any missed first-capture window must be resolved by the qualification owner before a prospective restart; no retrospective substitution.
3. The issue-cutoff season-rate comparator, original participation evidence and versioned observed settlement evidence. Missing strengths/outcomes remain unknown; missing participation must not manufacture a non-dresser zero.

Use the existing fixed `inspect-identity.mjs`, `inspect-issued-packet.mjs` and normalizers on supplied files, then the **installed retained** checker with `--issued`, `--rso`, `--start-chart` and the actual pinned `--scope` (plus `--settlement` when supplied). Require explicit nonempty JSON results. `--allow-draft-scope` is only a synthetic preparation option, never acceptance evidence.

The retained 14-slate/500-settled-skater-game protocol, T−60 readbacks, D+1 noon New York settlement, sealed October 23–30 block and fixed thresholds remain intact. Its claim covers Start Chart display and RSO totals/comparison; assignment and conditional tie-break remain denied. This native protocol is **not an extra gate on schedule-only private testing**, nor is it a substitute for the bridge's distinct evidence.

## Smallest private acceptance sequence

1. **Manual first, no live provider call.** In an agreed local/offline session using already authorized saved inputs, TJ supplies or confirms the actual league slot counts, eligible positions, reserves, scoring and acquisition rules privately. Check a no-move baseline, then one user-selected add/drop chain including the lost drop contribution and a started-game lock. Reopen/Undo/reconcile a saved input change; selections and refresh preferences must survive, and any repair requires acceptance. Record only candidate/source identity, pass/fail and a non-sensitive discrepancy. Schedule-only acceptance can pass while forecast totals remain withheld. This does not claim a fresh authenticated account check.
2. **Prefer an existing approved private Yahoo snapshot.** Validate imported roster/slot/rule/availability evidence and continuity locally, with private inputs kept outside the repo. If it is current and sufficient, no new snapshot request is needed. If only a fresh goalie mark is missing, propose just one confirmations request; do not reload the whole provider snapshot merely for that mark.
3. **If a snapshot is missing, propose one snapshot request.** One owned daily league/team, agreed current season, verified league time zone, horizon starting today or later and ending no later than that matchup's end. One `POST /api/v1/roster-schedule-optimizer/provider`; no initial second refresh, browser crawl or new workspace save. Use the returned capture for the manual assertions. Leave broader two-slot chains, later marks and repeated-refresh acceptance as explicit follow-ups only if the first result is useful and within its budget.

The acceptance target must be named before any live request: existing approved deployed #417 (or its actual successor), or a specifically configured local server. A local server connected to production credentials/data still performs live work. Current target, private team and league-local window have not been supplied; no live window is active.

| Minimal live option, if separately approved | Application requests | Source-derived Yahoo resource ceiling | Additional effects to settle before execution |
| --- | --- | --- | --- |
| Existing snapshot; fresh goalie confirmation only | One `POST /api/v1/roster-schedule-optimizer/yahoo-current-data` | 0–1 adapter call; at most 2 resource GET attempts | Planning-data/auth/DB work plus possible token refresh/status writes. No outer timeout retry. |
| Missing snapshot, no elapsed days | One provider POST | At most 89 adapter calls / 178 resource GET attempts, including timeout/401 retries | OAuth/auth/DB/planning work is additional. Base calls can run five concurrently; availability pages run one then batches of three. |
| Snapshot plus a necessary goalie confirmation | Two sequential application POSTs | At most 90 adapter calls / 180 resource GET attempts | Only propose the second call when the first lacks the required mark; include all other work and side effects in the same approval. |

These are conservative source ceilings, **not approved budgets or complete server-cost bounds**. The old 80/100-read plan is not enforceable. The 8-second availability limit is checked between batches and does not cancel in-flight work. The seven source pins underlying the [November 8 detailed bounds](../acceptance-preparation/YAHOO-ACCEPTANCE-BOUNDS.md) are unchanged.

### Credential effects and permission

**The normal Yahoo path can refresh and persist credentials.** It can POST to OAuth before its first resource GET or after a 401, claim/release refresh leases, store rotated tokens, and mark account/draft-session reauthentication state. Today's-or-later horizon avoids past-lineup persistence, but does not prevent those credential/status writes. The inspected API has no confirmed no-refresh/no-persistence option. Fresh credentials cannot be assumed, and stopping after receiving an error cannot undo a refresh already performed.

The current task does **not** authorize that live/auth-changing window. The Yahoo owner must first provide an existing private capture or a concrete approved path: exact target/principal scope, dates, request/concurrency/runtime/DB bounds, allowed token/status effects, and no background UI fan-out. A standard live path needs express authorization covering those effects; a strict read-only alternative needs an actually enforced implementation, not a label. No login, reconnect, credential handling or flag change is proposed as an automatic prerequisite. Keep the user's existing refresh choices and manager-selected moves.

Once approved, stop at the first conclusive result, unexpected source/scope, overflow, rate limit/access/reauth failure or unapproved side effect. Issue no new application request to diagnose a failure; first inspect the saved receipt. Do not issue provider lineup/transaction writes.

## Remaining owners and decision

- **Runtime/forecast owner:** return the existing current source/issuance/consumer receipt or explicit non-retention; identify whether this is bridge acceptance or native qualification. No new run or activation requested.
- **Yahoo connected-planning owner:** supply the saved private capture, or finish the bounded live proposal with token/status effects explicitly included. Global ownership-writer repair is separate.
- **TJ/private beta owner:** choose the private target/league/window and record the manual result; authorize a live Yahoo operation only if the supplied capture is insufficient and the complete proposal is reviewable.

The checker custody/install blocker is closed. Private authenticated acceptance and current forecast-use evidence remain open. No production, provider, database or auth operation; no push or deployment was performed by this lane.
