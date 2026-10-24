# Slice 02 — local TJ-only owner policy

2026-10-24. Source ready for independent review; no acceptance or activation claimed. Slice 01 remains frozen.

## Implementation and checks

- New `web/lib/forge-testing-grounds/ownerPolicy.ts`: request-scoped server policy using an explicit trusted owner UUID and a server-verified principal resolver. It has no body/query/role input. Missing/invalid owner configuration denies before authentication; another verified admin is denied. Every call re-verifies rather than caching a past authorization. Trusted stored-resource ownership is checked separately. Browser-side invocation and missing verifier deny. Failures return generic codes, never upstream errors or credentials.
- New `web/lib/forge-testing-grounds/ownerPolicy.test.ts`: ten synthetic cases covering those boundaries, including session loss, spoofed body/query/cron/local claims and cross-owner resources. No real account, credential or provider was accessed.

Focused Vitest **10/10 passed**; scoped strict TypeScript **passed**; scoped ESLint **passed**. No initial test failure, retry or weakened assertion. Commands/output in `checks.log`; exact candidate/dependency/frozen-slice hashes in `EVIDENCE.json`. Base remains `octoberBranch` at `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; both new application paths were absent at baseline. No candidate commit or patch application was performed.

No shared auth/model/schema/config files edited. No route, page, live owner setting, role/grant, worker credential, hosting or server activated. No production/provider calls, Git mutations, deployment or subagent. Browser/full application checks were not run because this is a pure policy seam, not wired UI/API behavior.

## Decisions for parent

See `DECISIONS.md` for evidence and the limited next choices:

1. Prefer proving a separate bounded-step Testing Grounds worker/store using the existing local architecture before selecting a dedicated service. Actual fit feasibility and both options' monetary cost remain unknown. No purchase/activation budget is invented.
2. Actual HIT/BLK shrinkage values exist and are used, but are not yet dashboard controls. Recommend a narrowly coordinated adapter seam rather than fake knobs or duplicate calculator logic.
3. Existing `goalie-rolling-14d-start-frequency-v1` is the best explicit binary-probability adapter candidate: true starter labels/opportunities, separate from relief appearance. It is uncalibrated; input/version/population/pairing validation remains needed. Rank-only expected-goals ROC/AUC is distinct and does not satisfy the probability pilot.
4. Preserve existing sealed/protected Release C rules. No exact October30 automatic reveal is established by inspected receipts. The release owner must supply authoritative issuance/finality/reveal evidence before protected real evaluation; synthetic work can continue.

## Acceptance and remaining boundaries

Local portions of Tasks **2.6 / 7.1** implemented and fixture-tested. TJ-only scope is preserved; another admin gains no authority. This is **not** completed §1/§7 authorization: an integration adapter must call a trusted server authentication service, pass its verified principal through this request-scoped policy, owner-scope storage reads before retrieving private payloads, and independently enforce mutation/CSRF, worker authority, artifact/log/export access and reveal rules. A resolver that merely decodes a client token or returns a request body would violate the explicit integration contract.

Pending: independent review; real request/session integration; owner configuration/activation; storage/persistence and reveal enforcement; model adapter and preregistered statistical contract; separately approved real-pilot resource/data/reveal plan. No safety auto-review denial or uncertain external model/job operation occurred.

Coordination delivery is **unconfirmed**: the exact status/lease message to thread `01a16e23-72b5-76ee-8ade-2d209d0e7002` returned “Could not determine whether Codex thread … exists. Unavailable or failed hosts: durable.” It was not retried. Parent had explicitly authorized this disjoint slice; OWNERSHIP.md records exact paths. Please reconcile the lease/status through the functioning parent channel. Master/ledger were not edited.
