# Settled goalie policy and trusted Yahoo review

**16/16 focused review tests pass under TJ's explicitly selected policy.** Likely80% / projected65% remain floors, confirmed Starting is100%, confirmed Not Starting is0%, and unknown/unconfirmed leaves the modeled prior unchanged. The floors are chosen product policy, not empirically calibrated probability claims. A higher0.9prior remains0.9 under either floor; neither floor sets confirmedStart.

This artifact supersedes the two policy-sensitive unchanged-prior assertions in `../confirmation-review/`. Their historical12pass/2fail receipt remains untouched. The change is explicitly authorized by TJ's “80/65% based on likely or projected yes” instruction, not an expectation change to hide a defect. `review-expectations.patch` shows the exact artifact-only update and two added higher-prior controls. No application file was edited.

The same14previous source-to-bridge/adapter/worker cases remain, with only likely/projected expectations revised. Two additional cases prove floor semantics. Verified server accepted confirmed/ruled_out still produces1/0 through the actual worker and adapter despite contradictory serialized Yahoo labels. Unaccepted, expired, future-published/available/created, wrong-game/team/player and absent observations cannot alter the prior. Existing earlier Yahoo parser/mock-loader3pass evidence is reused; no fullsuite or unrelated passing checks repeated.

## Independent review of the proposed trusted Yahoo path

Reviewed the release owner's `tasks/artifacts/release-integration-2026-10-23/confirmed-news-correction/REPORT.md`, including “Smallest proposed Yahoo extension — not implemented,” against current source. **The proposed direction is consistent with the authority boundary, but it is not implemented or accepted as working Yahoo support.** Current public planning GET still has no authenticated live Yahoo confirmation source. The earlier spoofing correction remains necessary and the baseline three-file fix remains unchanged.

Confirmed constraints:

- `requireApiUser` accepts a Bearer authorization header; the existing worker GET sends only same-origin credentials and read nonce. Cookies alone do not satisfy this handler. The component's session-aware auth helper operates in the main thread.
- The existing worker request contains snapshot/intent/options. Treating another serialized response field or option as trusted would recreate the original flaw. An authenticated fetch broker must correlate principal, verified team/league, range, generation and fresh request nonce; reject obsolete or unsolicited responses; and keep current-read authority tied to the actual fetch path. A dedicated runtime response capability/channel must remain distinct from saved input JSON. No access token belongs in saved snapshots or worker request options.
- Authentication and provider-sync entitlement do not by themselves establish player/game validity. Server ownership/account/season mapping, roster date and response freshness, canonical NHL identity, scheduled game, team applicability and contradictory-source handling remain required. Explicit0 must remain distinct from absent/unknown. Native target approvals remain independent and unchanged.
- Provider-confirmation validity needs to participate in the runtime publication deadline, including transit/computation expiry. Reusing the forecast row's longer lifetime alone must not extend a short-lived Yahoo observation. Current timestamp/nonce checks cannot validate a receipt that never reaches the trusted path.
- The existing full `loadYahooPlanningSnapshot` fans out to settings, rosters, scoreboard, historical lineups and available-player pages. The proposed one-current-roster-resource scope is appropriately narrower, but requires a declared timeout/retry/coalescing budget. There must be no per-candidate provider fetch or unbounded request growth as intent changes. No provider calls are authorized or needed for mocked implementation/review.

Future acceptance should exercise current verified Yahoo1/0 through both worker and fallback; unknown preserves the server prior; forged and replayed labels fail; cross-account/team/game/season inputs fail; expired/future/contradictory evidence fails; logout/context change during fetch aborts publication; conditional rates and native target gates remain unchanged; and the per-generation/read-sharing budget is observable in mocks.

## Current outcome

Policy-sensitive review is green. **CR-TJ-03 trusted positive Yahoo integration remains open** because the implementation path is absent, not because the parser or server-news confirmation path is missing. The release owner has the proposal and independent review constraints. No source lease was granted and none was taken. No pending tool action, denied action or uncertain outcome; implementation and subsequent acceptance are future owner work.

`CANDIDATE.json` pins all reviewed current source files, records source matches and the16case receipt. `confirmedStartReview.test.ts`, `tests.json`, `tests.log` and `review-expectations.patch` preserve reproducible evidence. Tests used the existing isolated copy/network-denial harness at `/tmp/fhfh-rso-correctness-20261023`; no production API/provider call, private export, credential change, migration, dependency, commit, push or deployment occurred.
