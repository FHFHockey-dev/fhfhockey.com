# Independent review — remaining RSO input trace and passive capture

Verdict: **bounded trace ACCEPT; passive-capture proposal REJECT pending one P2 artifact-only correction.** No application-source defect is established by this investigation, and the previously accepted four-file candidate-cache increment remains accepted/frozen. This is not permission to execute a capture, read an owner browser or relax an admission gate.

## Finding

**P2 — capture transaction controls from their actual sibling section.** `passive-capture.js:22–24` searches only `#rso-rule-settings label` while promising timing, cost and moves-left values. In the actual frozen main component, that details element ends before the sibling ExtraRules component (`RosterScheduleOptimizer.tsx:971`); ExtraRules renders Acquisition cost at1119 and Moves left at1129. Consequently the proposed script can collect Acquisition timing but silently omits cost and every period's remaining count on the real page, including populated values. `verify-passive-capture.cjs` places all three controls inside the same synthetic #rso-rule-settings details, so its assertion passes against a DOM structure the application does not render.

Before asking the owner to run the proposal, scope the allowlisted transaction-control read across the real rules/ExtraRules sections without scanning player bodies, and make the synthetic DOM mirror those sibling sections. Verify that populated and blank cost/moves-left values are both retained and that absent controls remain distinguishable from unknown/blank values. Keep the capture passive; this requires no app source edit, network, storage or event dispatch.

## Trace assessment

The nine composed cases use actual pure server-cache/planning-input/retained/supplement/metrics functions with synthetic rows and denied network/storage. reproduction-final.json reports nine cases passed, workspace unchanged, no owner storage or network; the earlier harness assertion/provenance mistakes remain disclosed. These show separate predicates: current exact cache positions can resolve eligibility, availability can still remain unknown, missing roster lineage/old cycle stays unverified, and one explicitly admitted synthetic candidate with manager rules and fresh schedule can produce +1AGP/null points. Substituting stale schedule evidence withholds netAGP. They do not identify TJ's branch, establish genuine free-agent status or validate actual league rules.

The relayed age arithmetic is consistent: 2026-10-14T00:12:54.911Z to2026-10-15T22:37:25.275Z is167070364ms, exceeding36h by37470364ms. This independently forces partial schedule coverage only if those game rows are in the actual selected returned scope. The trace accurately distinguishes data.evidence on the Shared schedule rail from snapshot.evidence used by candidate evaluation and preserves matching connected/account/saved-versus-retained precedence. No re-fetch, cache refresh or new source correction is justified solely by the197 display count or the synthetic fixtures.

The emitted-source inspection receipt binds the recorded local asset and matching main/hook source hashes; the current target/source and all15 retained application input pins match. This is evidence about the recorded on-disk asset, not TJ's loaded origin, browser cache or runtime bytes. No owner browser or emitted application was executed by this reviewer.

Apart from the selector completeness defect, the capture's static operations are passive DOM/control/text reads and construction of an output string. It does not call fetch/XHR, auth/session/storage, React internals, dispatch events, focus/click controls, navigate, mutate DOM or request a reload. Direct-text status reading avoids tooltip/player-list traversal and preserves the known overflow notice. Context fields and source-state reads match the actual markup; the uncommitted timezone caveat is appropriate. The synthetic no-request/no-storage/no-mutation record is a fixture result, not owner-context execution or a guarantee about unrelated page background effects.

Verification performed: read named artifacts, actual relevant main/cache/guard code already in the current review scope, checked all14 receipt artifact pins and all15 current application inputs, reviewed nine retained case results and synthetic DOM verification. No reproduction/capture, application tests/compiler/build/server/browser, account/profile/storage, network/provider/DB, model/pilot, scheduler/config, Git/deployment or application edit was performed. Only this report was written. Retain the rejected capture/verification bytes and supply a separately pinned artifact-only correction for re-review.

## Exact reviewed evidence SHA256

- receipt.json: `df89f64f4f89b3270631a73e334417883db9a5637472436f8a69633ea765229a`
- TRACE.md: `770469d4621b04f3fdeb65d43803537297d864aafec351b6713343f11ecc1044`
- reproduce.cjs: `37029a392e01a15615337d2700e41a37a5d0c87d0706f2f3162b66f577302fbc`
- reproduction-final.json: `fe206dcc92cade61c3f34df92340f108ba3a2cbe1d55153e566d32b78d30293b`
- passive-capture.js: `19e5d25f01063431530d3ebbd4801ea7bbe7f006929f8c69122987b053b6a90e`
- verify-passive-capture.cjs: `a5d5e2ae92c41c78bab6d03e7b8e3b89cdd9b6746ba4b378b49f6d9ba729c496`
- passive-capture-verification.json: `5206493488a8eeb4b98e222f228127c36d005c5792d17fb8920b55a24e801d41`
- emitted-source-inspection.json: `e6a9562354b0f6308a6f32d91322c163726d79f77133a4b0f06d2f194974568c`
- unchanged-application-inputs.json: `6f8d89a6e485323a3cad3b1aa1d14f4a5b8af5c83ab9c2d63609f5ab8157302c`

Main source pin: `d13dac954bb9998368249bebb71a4a737c14c38a5a39abd2aae2f3bbe651f0e6`.

Hook source pin: `5a8ff56cd3cf1896a0e7ed2d23f0eb103169d7362ed8aa17f7baaf430831cca0`.
