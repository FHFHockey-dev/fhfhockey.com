# 2026-11-10 · claude · math audit W1-2 nst-derived-stats

- **Scope:** audit M-NST-001–034 (packet `tasks/artifacts/calculation-inventory-2026-11-10/master/packets/nst-derived-stats.md`, brief TRIAGE.md §2 W1-2). Read-only; no code changes. Deliverable: `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/nst-derived-stats.md`.
- **Where:** `octoberBranch` at 3c03df7dc + dirty tree. Files written: the audit file and this diary. Nothing else touched.
- **State:** pass finished. Audit file complete, **uncommitted, left for Chef**. Verdicts: 11 sound, 9 mis-specified, 14 wrong, 0 undetermined. TJ's six answers (in chat, 2026-11-10) are recorded at the top of the audit file and applied to verdicts and priorities; they are **not** yet in `OWNER-DECISIONS.md`.
- **Checks run:** local run of `buildPlayerStatsNativeGameParity` on six stored games compared with stored NST rows (scratchpad only); bounded DB reads listed at the end of the audit file. No tests, builds, deployments or writes.
- **Next step (Chef/owner):** copy the six owner answers into `OWNER-DECISIONS.md`; answer the two remaining questions in section 4 (the deployed NST admission function change, and radar all-situations versus 5v5); commit or register the audit file.
- **Blockers / pending approvals:** none for this lane. D10 (cap NST burst at 39 in the deployed `nst_admit_attempt_budget_v1`) is a production change and needs explicit approval.
- **Gotchas:**
  - `home_score` / `away_score` are on goal events only, so the parity score-state filter passes nothing else. `buildScoreStateContexts` has the running score.
  - Stored NST gamelog units: skater TOI seconds, goalie TOI minutes, goalie SV% 0–1, skater percentages 0–100, PDO 1.0 scale. Stored NST per-game GSAA is relative to that day's league SV%, so it is not additive.
  - Penalty shots: attempt has situation code 0101/1010 and no reason text; the infraction is type code PS, duration 0.
  - Stored WGO position codes are C, L, R, D (not LW/RW).
  - Production's event select omits `time_remaining_seconds`; mirror that when reproducing parity locally.
  - Retire this diary once Chef has committed or registered the audit file.
