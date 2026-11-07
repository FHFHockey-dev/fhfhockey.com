# FORGE v2 independent tests

- Scope: independently test exact local candidate, five prior defects and issuance/API/UI with synthetic inputs; no product edits or external actions.
- Where: octoberBranch HEAD 514614ed79; product 7113329d2. Read-only source copied to /tmp/forge-v2-independent-hkh8ulbm; evidence in /Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-v2-independent-test-2026-10-30. Existing dirty work preserved.
- State: PRD, task list, ownership and test harness inspected. All copied source matches HEAD: True.
- Next: one-worker v2/native tests, original adverse reproductions, browser integration and credential-free cloud feasibility sizing.
- Blockers: runtime does not expose verified model/effort; proceeding solo rather than unverifiable delegation. Scientific/external gates remain outside authorization.

- Checkpoint: 173 existing tests passed; native initialization sandbox failure and stripped-locale startup failure resolved with explicit execution permission and LC_ALL=C. All 13 native/artifact tests pass (10 native plus 3 already counted in 173). Independent five regressions pass after updating old test doubles to atomic store/bundle interfaces; original failures retained. Browser needs loopback execution permission.

- Final handoff: REPORT.md and verification.json record 183 unique existing v2 passes, five independently adapted prior-defect passes, four Chromium passes, eleven intake passes and synthetic chronology. New P2 context-head race reproduced with real preparation plus separate native DB confirmation (two expected failing regressions). Product source remained pinned/unchanged.
- Remaining: owner remediation of F1 (not authorized here), scientific/external gates. No pending tool approval/denial/uncertain action. No transfer; cloud feasibility 51 initial files ~349 KiB gzip excludes dependencies but contains private project code. Preserve diary for handoff of unresolved finding.
