# Independent review — acquisition-rules workflow, final v2

Verdict: **ACCEPT bounded two-path source/test increment. No actionable findings.** Acceptance applies to manifest d6287c2f2308181f2c3527ceacbd6d58e8092276d4ac2179397ff5cf406ddcaf and its intake-relative patch, not the superseded v1 pins. Release inclusion, compilation and actual-account readiness remain separate.

Reconstructed the complete patch against the retained d13dac954bb9998368249bebb71a4a737c14c38a5a39abd2aae2f3bbe651f0e6 main and the absent new test. It exactly matches current files. The nearest existing main test remains b06810f3a1150aba29740cdfd059618b60b105abccd6c275f93e9b49cc235c9c. All17 final recorded input hashes match before, after and current source.

## Source and behavior

At main:971 and :1113–1124 the existing acquisition timing, counting-cost and complete period editor now share the labeled Acquisition rules fieldset inside the existing League rules disclosure. Byte comparisons confirm the original control markup and handlers are identical after relocation. Unknown timing, nullable cost, unknown remaining allowance, selected-date suggestions and existing local-midnight period boundaries remain unchanged. No values are inferred from these UI changes. The unchanged updateRules/manager-override path preserves provider facts and existing edit/history/persistence semantics.

The legacy Scoring, budgets, and lock windows disclosure now provides Review acquisition rules (:1131), wired at :971 through the unchanged reachInput helper (:194). Its selector reaches the timing select inside the consolidated group; reachInput switches to the roster view, opens the closest disclosure, focuses the control and scrolls it into view. The group id is unique and its legend labels it. The bridge keeps the unchanged warning destination actionable without shared planner changes. Existing read-only section behavior and the no-auto-account-save boundary are preserved by the exact diff.

## Evidence assessed

The retained initial red log demonstrates two failures at a closed disclosure ancestor. The final v2 log records10 passed/191 skipped: two new manual/Yahoo integration variants and eight nearby rule regressions. Scoped lint records zero errors and three warnings; the entire warning log is byte-identical to the accepted intake lane's lint log. These are inspected author runs; no test or compiler was rerun by this reviewer.

The new tests mount the actual main and real hooks, structured-clone worker messages, and invoke the real candidate engine/planner through an isolated stand-in. Manual enters through League settings; Yahoo enters through the legacy disclosure bridge and verifies timing-select focus. Both check that all three controls have open disclosure ancestors. They explicitly enter next-day timing, acquisition cost2 only where absent, and two New York midnight periods with allowances2/4. Known provider cost is retained without a manager override. Assertions preserve scoring, roster slots, protected/empty intent, local schema roundtrip/history and reopened overrides; worker packets retain zero steps. Candidate output updates automatically to +1netAGP with points unavailable. During rule edits the mocked request count does not increase and no PUT is sent.

This verifies a synthetic local workflow with mocked authentication/HTTP and isolated jsdom storage. The planning stand-in uses bounded search settings; native browser Worker packaging, real browser geometry/assistive technology, production search/runtime parity, actual TJ rule values/session/account and provider/cache freshness were not observed. No model or qualified forecast claim follows from +1AGP/nullpoints. The existing date editor supports midnight resets; this increment does not add intraday reset support. No source, persistence, planner, hook/worker or forecast implementation outside the named main was edited by the author delta, and none was edited during review.

## Exact reviewed pins

| File | SHA256 |
| --- | --- |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `faee5d21dc2df01ed47fbf1da2ebb811ca99109a8bd2c23e9be4906a5318d14e` |
| `web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx` | `a6ea6e10be148eac99d2f86cae1e05507420247459ce84f9f3f70e6dcfb3614b` |

- `candidate.sha256`: `d6287c2f2308181f2c3527ceacbd6d58e8092276d4ac2179397ff5cf406ddcaf`.
- `change.patch`: `b7f328ad2d406734103c9d1a514a744e2b895a188a625ba910f6edbafa110e53`.
- `before.json`: `0551ac2dc4dec1fc873757831a9e0b2284ee54de16137bdc3207210fba855d15`.
- `HANDOFF.md`: `80d6f5b7f6e3b8fd25bcc589427129b83081dabcee9f0e4a5d14bddebb1e14ee`.
- `receipt.json`: `35197a9c8b4e390f67116c3d065607f468d6ab984646d52df66c82c8da1bb683`.
- `red-tests.log`: `959f200630175c5c3810a2158ac6593de40b8a7ce7ed9e6cf56cf93bed3a5f60`.
- `final-tests.log`: `8ae977ea9c55becb64d5be551a558923a424ed02b7a274f9c14a439b54d7a678`.
- `final-lint.log`: `65e30339da9362757c4738f79810c299f78560036879fa6f7506bbc47e700018`.
- `verification-inputs-before.json`: `acb7d604e48f652b6d757086ef31799b2fdd02948efb0d742c6bb1cad54e760b`.
- `verification-inputs-after.json`: `acb7d604e48f652b6d757086ef31799b2fdd02948efb0d742c6bb1cad54e760b`.

Read-only source/evidence review and local hash/diff comparisons only. No application edits, compiler/build/browser, actual network/DB/provider/account/storage actions, sealed-pilot access, Git operation or deployment occurred. Only this report was written.
