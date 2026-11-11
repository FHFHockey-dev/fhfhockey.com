# 2026-11-10 · claude · math audit W1-1 xg-part1

- **Scope:** audit M-XG-001–060 (packet `tasks/artifacts/calculation-inventory-2026-11-10/master/packets/xg-part1.md`, brief TRIAGE.md §2 W1-1). Read-only; no code changes. Deliverable: `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/xg-part1.md`.
- **Where:** `octoberBranch` at 692fd8104 + dirty tree. Files written: the audit file and this diary. Nothing else touched.
- **State:** audit file written, **uncommitted, left for Chef** (the brief allows either). Verdicts: 16 sound, 23 mis-specified, 21 wrong, 0 undetermined.
- **Checks run:** offline scoring of 4 committed artifacts; bounded DB reads (listed at the end of the audit file); 230-game scalar-column sample refit (scratchpad only, not in the repo). No tests, no builds, no deployments, no writes.
- **Next step (Chef/owner):** decide the six owner questions in section 4 of the audit; the first is whether to demote the leaky champion `cfg9bac2706` in `nhl_xg_model_registry`. W1-2 (nst-derived-stats) owns the heuristic-xG fix (D6).
- **Blockers / pending approvals:** none for this lane. Registry demotion and any re-scoring are production writes and need explicit approval.
- **Gotchas:**
  - Stored `nhl_xg_shot_features` rows predate the 2026-07-14 shift-boundary fix; shooter shift age is null on ~80% of goals. Do not train or score from stored rows until rebuilt.
  - Blocked-shot events: owner = shooting team, zone code = defender-relative.
  - The MCP SQL tool returns rows into context; pull samples with a local script to a scratch file instead.
  - Retire this diary once Chef has committed or registered the audit file.
