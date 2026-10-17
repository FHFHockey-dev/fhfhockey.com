# Independent review — Yahoo discovery observability

Recorded 2026-10-16T01:26:15.429587+00:00.

Verdict: **ACCEPT, bounded local source/test increment; no severity findings.** This accepts the three frozen paths for engineering integration. It does not authorize deployment, provider/account/browser execution or a refresh, and does not diagnose TJ's actual 197 unknown candidates.

## Exact reviewed identity

Candidate manifest: `0f9133d90f8432e41a3e1ac07f865f2f1cabb90a672470d1320e577e6ddbafea`.

Intake-relative patch: `b20bf46c90327b468f3fc858edb857c01440034c040c5ceb509baae45c2111af`.

```text
709b5cba1cdf73405eafce5b4067bcefed3a18416bf4407f3978cf5ff360e1a7  web/lib/integrations/yahoo/rosterPlanning.ts
dc1abe03347a0308d888c1edc959cdbbf55854587a467fff940606d0738bd829  web/lib/integrations/yahoo/rosterPlanning.test.ts
b278e5cc5b91598217b8f10f36f5658e90394dfc71a377216260bc1f4a0504f8  web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx
```

All three current hashes and six unchanged dependency hashes in receipt.json match disk. Three before copies match intake.json, and in-memory application of every patch hunk reconstructs the exact three current files. The two test before copies are the prior accepted partial-discovery test-only candidate (`3cff9b16...` and `1412ff43...`); that historical review was not repeated or rebound to these new bytes. Runtime RosterScheduleOptimizer.tsx remains `faee5d21dc2df01ed47fbf1da2ebb811ca99109a8bd2c23e9be4906a5318d14e`.

## Assessment

- `rosterPlanning.ts:278–309` counts logical page calls, returned results and pages accepted after the unchanged freshness, league scope and complete collection checks. Failed/rejected pages do not contribute accepted rows. Row insertion/repetition accounting at lines 301–304 establishes accepted rows = unique keys + repeat occurrences, including duplicates within a page or across pages. Repeated ownership withholding is unchanged.
- The bounds, loop offsets, sequential provider calls, 8000 ms between-page gate, optional-error/backoff handling and player merge assignments remain intact. The additional freshness/scope evaluations are pure. Stop labels distinguish preexisting backoff/access restrictions, budget/end/page limits and request/validation failure stages; a failure during a provider call remains a request failure, with existing provider code/retry metadata retained separately. Page attempts do not count internal token reads or HTTP retries. The elapsed measurement does not turn the inherited between-page gate into a hard request deadline.
- `rosterPlanning.ts:311–342` counts each accepted unique Yahoo key against the unchanged current-game, bidirectionally unique mapping and canonical NHL catalog. Uniqueness makes catalog matches + unmatched = accepted unique keys, and candidate matches + rostered/excluded = catalog matches. The four mutually exclusive catalog buckets sum to non-rostered catalog entries. Eligibility uses the existing normalizer plus verified flag and player-class agreement; availability denotes explicit free-agent/waiver state. Waiver status alone does not establish clearance or legal acquisition.
- The catalog denominator is accurately labeled before search; it is not the currently filtered UI count, manager-added catalog or legal-candidate denominator. Neither an unmatched key nor an unseen player becomes known by counting it. Unknown acquisition cost/timing/periods, source freshness, schedule completeness and forecast gates are unchanged.
- The three new strings contain aggregate counts and fixed labels only. Existing limitations may still contain existing roster information; no broader redaction claim is made. The summaries use a new capabilities.limitations array at line 374 and are not appended to the limitations array referenced by snapshot.evidence.roster. Snapshot persistence therefore does not gain these strings. The unchanged main component holds capabilities as provider UI state and displays them in its existing Data health disclosure.
- Tests extend the real adapter boundary for partial results, duplicate identities, failed/stale/wrong-scope pages, unmapped/ambiguous/foreign-game identity, eligibility-only, availability-only and class mismatch. The existing full-main synthetic test checks visible summaries inside closed Data health, no request on opening, one mocked provider read, no account PUT and preservation of individually known facts. It does not observe the real account or native Worker packaging.

## Verification and limits

Reused retained checks after inspecting code/tests/logs: full nearest adapter 50/50 passed; one affected main UI test passed with 199 main tests skipped in the initial combined run; scoped three-path ESLint exit 0 with empty log. The initial combined run's 11 adapter failures were the newly incorrect mock-wrapper call-count expectation, not runtime regressions. The corrected adapter expectation is three fixed planning-wrapper calls plus logical availability pages, with two board and one draft calls; final full adapter log passes. No new test/compiler/browser/live run was necessary for this read-only review.

```text
7d39b53d401a2f2654012767129585b208edeceb7a4b2e9c2b507ca31d6abd03 intake.json
9ba8aa0a205bc21550fa5c500802ac7dcb785b56ffb9dddd18395b23c0cba0f9 receipt.json
81f6bca5149917a94a9704c5bbb424d1bd7da17e45da9eccffbbcf000658e8b2 HANDOFF.md
f46a53d59e37b797c6311fbd41106be171b44a7662bf8dcf9ac7c09632e49317 adapter-tests.log
8f9fc60c93223ab01ab2ac5639c4b65a84b60913da8c53c4235b9228044f0251 initial-assertion-count-error.log
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 lint.log
```

Actual TJ source/context/counts remain unobserved. Existing identity, ownership, freshness, acquisition-rule and selected-week schedule gates remain unresolved until separately evidenced. No conclusion that partial discovery alone caused all unknowns is supported. Source inclusion/release is a separate coordination decision. No application source or frozen receipt was edited; only this exclusive report was written. No network, provider, account, database, credentials, private outcomes, compiler, build or browser action was performed. Runtime model/reasoning settings are not exposed and were not independently verified.
