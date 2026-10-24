# S04-R1 — honest completion formatting

2026-10-24. `octoberBranch`, base HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. Frozen for focused independent re-review; Scout retains acceptance.

Corrected the single P2 in `../slice-04-review/REVIEW.md`. A valid9999/10000 processed stage previously displayed100.0%complete because of one-decimal rounding. The component now displays **Less than100%complete** when rounding would reach100.0 but exact processed count differs from eligible count. Other one-decimal labels remain unchanged. Native progress values/max and the operational JSON/underlying ratio/counts are untouched.

Every counted progress bar now has `aria-valuetext` containing exact processed, eligible and pending counts, followed by Work is incomplete or All declared work processed. This prevents a native rounded percentage from being the sole accessible completion description. Terminal processing remains distinct from successful work: all-failed units can be fully processed while status and failed counters remain explicit. Zero-eligible stages still have no percentage/bar; fitting still has no fabricated percentage.

Exactly two application files changed: `web/lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx` and `TestingGroundsPreview.test.tsx`. No styles, fixtures, pure contracts, runner, auth or shared source changed. Original slice04 renderer/HTML/receipts and independent failure/reproducer remain unchanged. This directory has its own renderer copy and regenerated `preview.html` so the original artifact is preserved.

Checks actually performed:

- Original independent S04-R1 reproducer unchanged, plus unchanged zero/pending/all-failed control:2passed.
- Four minimal owner boundaries:99.9%,99.99%, one pending near Number.MAX_SAFE_INTEGER, and exact completion. Visible/accessibility labels, exact bar counts and unchanged JSON projection asserted.4passed.
- Combined focused run: **6passed,12intentional skips**. No unrelated UI/runner/timestamp suite. Scoped TypeScript/ESLint passed with no output.
- Sass/local bundle generation passed. Actual new HTML executed in jsdom: correct heading and exact accessible count text, launch disabled, zero fetch/external resources/runtime errors. **Not browser visual, native accessibility or screenshot QA.** No failed R1 correction checks; original failures remain in their original logs.

The corrected236446-byte HTML replaced the existing Library item using `expected_current_version:0`, after these checks. Same identity **libfile_cc38ec891b2481918b7a88ecd0c24341**, new version**1**, returned file `file_000000009e9c81fdb6b4a09b473d9f4a`, filename `preview(2).html`. No new identity or sharing change. Local identity metadata applied successfully. Full receipt: `LIBRARY-REPLACEMENT.json`. Native download remains `https://chatgpt.com/api/library/files/libfile_cc38ec891b2481918b7a88ecd0c24341/download`.

Candidate before/after, dependency, protected-packet/reviewer checksums and artifact hashes are in `EVIDENCE.json`. Historical slice04 runner pins retain their explicitly parent-accepted S03-R1 replacements; no original receipt was rewritten. The updated Library preview remains synthetic with disabled launch and no visual acceptance claim.

Parent subsequently granted all ten slice05 paths and accepted the generic locked SSR frame for local owner-gated integration. That separate work starts only after this correction is frozen; no page/auth edit is included here. Existing port3000 ownership must be inspected without replacing/interfering with it; no localhost auth bypass or live auth/data check is authorized. No server/browser/build slot, production/provider/model request, dependency change, Git mutation or new worker occurred in R1. Return this packet for focused Sol re-review.
