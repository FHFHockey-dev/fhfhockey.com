# Smallest safe automatic-suggestion integration check

Both focused local cases passed through the real CandidateBrowser, real useCandidateMetrics hook, cloned worker-message boundary stand-in, real candidate solver and real CandidateCard rendering. The hook is not mocked. The transport stand-in calls the existing engine and does not implement another planner. Native browser Worker bundling/loading is not verified by this test.

Positive: empty selected intent; full C1/BN1 roster; no forecasts. Automatic legal drop/add results show the +1 netAGP candidate before the alphabetically earlier zero-AGP candidate. Both retain unknown points. No click, selection or intent/workspace mutation is needed to produce them.

Negative: unknown effective acquisition timing propagates actual no_proposals diagnostics through the same path, showing `No timed acquisition option could be generated from the current inputs.` and `Acquisition effective timing is unverified.` No fit ordinal or fake zero is added. Both cases reject any network or Storage get/set/remove/clear access and assert no calls. Manager snapshot/intent JSON is unchanged and add/selectPlan callbacks never run.

Passed:2/2 focused integration tests; scoped ESLint0/empty output; new-file whitespace. The accepted seven application/test pins remain unchanged. This is a new test-only path, with exact evidence in integration-receipt.json/integration.patch. No compiler/build, actual browser/profile, account/provider request, database write, pilot read/modification or production action ran. The subsequently announced FORGE invalid-clock guard is separately owned; the prior receipts retain their original source bindings.

## One owner reload/check

In the existing localhost RSO tab, reload once on the same roster/horizon without selecting a plan or pressing provider refresh. Let the candidate calculation settle, then report one previously affected card's message and first reason plus the counts under Plan & tradeoffs. Expected: verified inputs automatically yield ranked netAGP options even with points unavailable; otherwise the card names the actual input/filter/search/rejection stage. No initial plan creation is required. This owner readback is still needed to establish TJ's exact runtime state; the synthetic result is not live-roster acceptance. No agent browser/account access is requested.
