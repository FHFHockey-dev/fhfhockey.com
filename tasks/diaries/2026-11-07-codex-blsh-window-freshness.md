# BLSH source/window freshness review

- Scope: independently review and locally correct the native provenance/window-recency contract if supported, preserving integrity, independent acceptance, 2025–26 holdout, and all shared owner changes. No collection, production writes, deployment, commit or push.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `671ece2ea4ea78f79662b6a4db421f0d51512185`. Initial gate/current-input/current-window files are clean; broad unrelated dirty work is present and preserved.
- Start: read repository instructions, named November 7 assessment, gate, input and window implementations. The gate combines observation age with per-member event age; research assembly uses latest-window-event age. No code changed yet.
- Next: reconcile review decisions and test contract; coordinate exact file ownership with BLSH owner before edits. Keep a source-authenticated old row distinct from a current eligible window.
- Authorization: parent provided the user's acceptance of starting the two implementation lanes without a production release. Local safe edits only.

## Ownership and implementation checkpoint
- BLSH owner confirmed no overlap and reserved the gate/test pair to this task. Shared NST client remains untouched and frozen. Existing audit proved the exact microsecond boundary; its checks must remain.
- Implemented additive source-observation qualification and captured-window recency diagnostics. Legacy v1 admission/provenance decisions remain unchanged. Captured windows never assert independently established latest-five membership or current-use admission. Server UTC date is the recency anchor; original row/capture clocks remain untouched.
- Verification next: synthetic multi-game regressions, legacy output comparison, focused types and lint. No real input replay or scoring needed.

## Verification and handoff
- 59 gate tests passed (UTC); seven new source/window regressions also passed in America/New_York. 66 full legacy-output comparisons passed against frozen pre-change source. Focused strict ES2015 TypeScript, scoped ESLint and scoped diff check passed.
- Earlier test-append command had a wrong relative path and failed before edits; corrected it and verified the final new suite. No action denied or uncertain.
- Unchanged pins: currentInput, currentWindows, shared NST client, research snapshot. No production gate caller found in bounded web search. Added only source diagnostics, not scoring/adoption.
- Handoff: `tasks/artifacts/blsh-freshness-separation-2026-11-07/HANDOFF.md`. Parent review and future exact census/native acceptance remain pending; keep this diary for continuation. No owned process or lock remains.
