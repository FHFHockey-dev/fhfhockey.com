# S05-R1 — preserve background withdrawal across auth refresh

2026-10-24. Canonical `octoberBranch`, HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. **Frozen for focused independent re-review; Scout retains acceptance.**

Corrects the single P2 from `../slice-05-review/REVIEW.md`: after a hidden-page withdrawal, a subsequent auth callback previously started verification and could mount the sample while the document remained hidden. This was a synthetic workspace lifecycle defect, not evidence of an owner-identity bypass or real/sealed-data disclosure.

Exactly two application files changed:

- `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx`
- `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx`

The gate now requires a visible document and no outstanding `pagehide` suspension before session reads, before an access request, and before accepting asynchronous results/errors. `pagehide` remains authoritative even if the document still reports visible; auth refresh and visibility events cannot clear its latch. `pageshow` clears that latch, and a visible return reads the current session and re-verifies. Existing generation/account/sign-out checks and abort behavior remain in place. Hidden auth events cannot authorize or trigger a new access fetch. No previous capability is reused as authorization.

The original independent `[S05-R1]` reproducer is unchanged. Its SHA-256 is `a8ad74b144108e085fcc497a7d32698b3264c0662e8403b688c95ff3aadd3f42`. Original slice05 source is retained in the revision's `before/` snapshots as well as its original patch. The original owner packet, independent failure log and all reviewer artifacts remain unchanged. `correction.patch` contains only the two-file revision; `EVIDENCE.json` pins before/after, dependencies, preserved evidence and revision artifacts.

Checks actually run:

- **9 focused tests passed; 8 intentionally skipped.** This includes the unchanged reviewer failure; unchanged late-JSON logout, late-success logout, account-switch and late-initial-session controls; and four focused cases for initially hidden mount/visible return, pre-hide JSON arriving after return, and `pagehide` restoration while visible or still hidden. New controls assert no hidden requests, abort of old requests, fresh-session verification on return and no stale remount.
- Scoped TypeScript for the two changed files and imports passed. Scoped ESLint for those files passed. Direct whitespace inspection passed.
- The first harness attempt used a repository-relative artifact path while the command cwd was `web`, so config creation failed and Vitest could not load it. Corrected only the artifact path before the successful focused run. The original harness failure and changed approach remain in `checks.log`; no source/test assertion was weakened.
- **138 preserved pins matched** before final freezing, including original packet and reviewer evidence. No broad suite/build, server request, browser automation or native lifecycle/visual test was performed for this revision.

This fulfills only the local S05-R1 lifecycle correction within task 7.1/10.2 contributions. It does not implement single-use live verification budgeting, isolate shared AuthProvider writes, activate owner configuration, connect persistence/read adapters, or qualify the full dashboard. The original adapter payload-validation/sealing limits remain unchanged.

Owner activation remains a separate, already approved but blocked action: **0 of 1 approved Auth reads used**; no verified UUID/configuration change or coordinated reload. Supported private session-verification transport, inherited profile/settings-write containment and existing-server ownership remain unresolved. No credentials, private identity values, live providers/model/data, real runs, schema, shared source, package/lockfile, Git, new workers or deployment changes occurred. The corrected Library preview identity/version is unchanged.
