# Independent confirmed-start review — October 23 follow-up

**The current implementation preserves trusted server-news confirmations but does not yet meet the positive Yahoo-confirmation requirement.** The authenticated Yahoo loader reads valid scoped marks; no trustworthy current Yahoo receipt reaches the forecast-authority constructor. The spoofing correction must remain, but it is not a complete implementation of TJ's clarified requirement. The earlier baseline three-file fix remains intact and no application files changed in this follow-up.

This report supersedes the earlier packet's Yahoo product-readiness recommendation only. Its spoofing regression result and baseline acceptance evidence remain valid at their pinned bytes.

## Results

The focused new artifact fixture has **12 passed / 2 failed** cases. It runs accepted-observation resolution, the real bridge builder, compact wire reconstruction, current planning read and execution adapter; the positive case also exercises the actual worker module. Existing Yahoo parsing/loader tests add **3 passed / 75 skipped** (filter intentionally selects only goalie starting-status tests). No full suite was repeated. The earlier four-case serialized-input/expiry/native/authority-lifetime review is reused, not recounted as fresh execution; its source files still match the earlier tested hashes.

| Input / path | Observed result | Assessment |
|---|---|---|
| Server-accepted `confirmed`, matching game/team/player and available at cutoff | Start probability1, confirmedStart=true, saves25 from per-start25; contradictory saved Yahoo Not Starting ignored; adapter and worker agree | Positive confirmation preserved |
| Server-accepted `ruled_out`, matching game/team/player and available at cutoff | Start probability0, confirmedStart=false, saves0; contradictory saved Yahoo Starting ignored; adapter and worker agree | Positive negative-confirmation preserved |
| Unaccepted, expired, future-published/available/created, wrong-game/team/player, absent server observation | Prior0.3 / saves7.5 preserved despite serialized Yahoo Starting | Negative boundary passes |
| Server observation status `unknown` or `unconfirmed` | Prior0.3 / saves7.5 preserved | Negative boundary passes |
| Accepted status `likely` or `projected` | Existing bridge floors modify the prior (0.8/0.65); neither becomes confirmedStart | Two literal unchanged-prior assertions fail; separate scope/policy decision below |
| Authenticated Yahoo loader/parser | Current date's explicit1/0 retained; missing, wrong-date/coverage, invalid value, unknown response time stay null | Trusted input acquisition exists upstream |
| Yahoo mark after browser serialization into current planning | No quantitative override, regardless of genuine upstream origin | No trusted positive-Yahoo path exists at this boundary |

One semantic trap: `DailyBoardEvidence.confirmed` is true only for status `confirmed`; an accepted `ruled_out` assertion carries confirmed=false. Valid negative confirmations must be recognized by their explicit status, not accidentally dropped by a blanket boolean confirmed check.

## Authority trace

1. `web/pages/api/v1/roster-schedule-optimizer/provider.ts` authenticates with requireApiUser, checks provider-sync access, and calls `loadYahooPlanningSnapshot` with the server-authenticated user ID. The loader checks an owned team/account/league, provider roster scope/date/login ownership, unique Yahoo↔NHL identity, and freshness. `providerFresh` requires a usable response date within120seconds and Age absent or0–60seconds. `yahooStartingStatus` parses only explicit1/0 for the requested roster date; the parser itself does not confer runtime authority.
2. The provider result becomes plain JSON and browser `connected` state, then a planning snapshot/worker message. `startingStatus` has source/date/boolean/observedAt fields but no trusted runtime capability. A fabricated object has the same shape. Moving those fields to a query parameter would not repair provenance.
3. `currentPlanningRead.ts` obtains only the public current data GET using season/date/timezone and nonce. `data.ts` loads shared server forecasts; it does not authenticate a current private Yahoo roster or return a Yahoo confirmation receipt. The correction ignores snapshot marks before fingerprinting bridge rows. This protects provenance, but cannot selectively retain a genuine Yahoo mark whose provenance was discarded upstream.
4. A separate existing trusted news path does work: `loadForgeDailyBridgeForecasts` calls `loadDailyBoardEvidence` against server DB observations; its resolver checks accepted state, cutoff/expiry and conflicts, and the bridge joins exact game/team/player. The current GET's bridge rows already contain its1/0 result. The new positive tests prove the spoofing correction does not erase those legitimate confirmations.

## Likely/projected scope

The literal instruction supplied to this reviewer says unconfirmed/unknown should not override; the artifact therefore retains ordinary failing assertions for likely/projected versus an unchanged prior. The release owner subsequently stated that existing likely/projected probability floors are a separate policy decision and are being preserved. They do not falsely claim confirmedStart, but they do alter numerical probability and expected stats.

No application change or expectation weakening was made here. If TJ's clarification governs only the binary Yahoo confirmation override, keep this as an explicit separate policy observation rather than claiming a new authorization to remove established probabilistic floors. If it governs every unconfirmed news adjustment, the two preserved failing tests are the bounded regression evidence for a separately leased correction. Parent/release owner must reconcile that scope; this reviewer does not silently decide it.

## Readiness and next boundary

Keep the baseline fix and serialized-input rejection. Do not claim Yahoo Starting/Not Starting quantitative support is complete until a fresh authenticated server-owned confirmation path reaches the same planner boundary used by worker and fallback. A legitimate positive control must obtain source/game/player/time-bound evidence through that trusted path; copying a provider-looking label or setting a browser flag is insufficient.

The missing work is a trusted current Yahoo evidence connection, not an absent Yahoo parser and not permission to disable legitimate server confirmations. Authentication, entitlement, team/account ownership, identity/date/game scope, freshness/expiry, unknown versus explicit0, contradiction handling, and generation/worker transport must remain enforceable. No new architectural implementation is proposed as already approved by this review.

Source pins, exact unchanged baseline identity files and current HEAD are in `SOURCE-PINS.json` / `END-INTEGRITY.json`. The fixture is artifact-only and executes at `web/lib/rosterScheduleOptimizer/confirmedStartReview.test.ts` in the existing isolated source copy. Existing harness/network denial and clean environment from the original packet were reused. No live provider or production request, private export, migration, credentials, dependency, commit, push or deployment occurred. No tool operation is denied/pending/uncertain. Product completion is **pending a trusted Yahoo path and scope reconciliation**, not blocked by permissions.
