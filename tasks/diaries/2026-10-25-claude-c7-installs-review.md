# C7 diary — 2026-10-25 in-tree installs review (ticket 17)

- Scope: read-only independent review of today's installs: C1 (9dbc55afb evidenceBundle), C3a/C3b v2 (uncommitted), SS1 tickets 17/18 + low-year fix (pending RECEIPT-19). No edits, Git, live reads or server.
- Where: receipts handoffs/C7/RECEIPT-C1-INSTALL.md, RECEIPT-C3-INSTALL.md; evidence handoffs/C7/r17-evidence/{c1-install,c3-install}/.
- State: C1 accepted with limits (89/89; F1/F2 confirmed: validator trusts self-labels in `retained`, no importer yet). C3 accepted with limits (104/104; 400-case selector property 0 violations; L1 TSC_RESULT placeholder, L2 test file outside lease).
- Next: SS1 review when handoffs/SS1/RECEIPT-19.md appears (recent-form grain caps/isolation/logging, meta-caption removals, streak rules vs CLAUDE-065 + TJ pop-ups, year 0000–0999).
- Gotchas: the workspace cleanup moved earlier C7 receipts and the luna network-guard.cjs to /Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/; I use a scratch copy of the 8-line guard. The previous C7 diary also moved there.
- SS1-19 (item 2) done: RECEIPT-SS1-19.md accepted with limits. 15/15 hashes; auth/access files clean vs HEAD 80425a4a9; 192/192 (owner 175 + mine); streak oracle 20,000 cases 0 mismatches (run1 kept: my FP tolerance error); year 0000–0999 closed. Limits: prod root cause unconfirmed (logs after deploy), dormant hits/blocks, avg_season assumption; F1 stale tier alt text (pre-existing).
- Ticket 17 complete (C1, C3, SS1-19). Heavy lock was held by c3-cron-repro (C3d typecheck) during my light Vitest run; not touched.

## Ticket 18 — GS, HIR, WiGO, C3d, TG S06 (2026-10-25)
- Receipts: handoffs/C7/RECEIPT-{GS,HIR,WIGO,C3D,TG-S06}.md; evidence handoffs/C7/r18-evidence/{gs,hir,wigo,c3d,tg}/.
- GS accepted (48/48; 1,600-window property 0 violations). HIR accepted with limits (34/34; no parent render test; filter by player not reason). WiGO accepted with limits (32/32 paths, 168/168, e2e 7/7 per owner; W1 pp_toi vs pp_toi_per_game; receipt hash/test-count text). C3d accepted (302/302; diagnostic only). TG S06 accepted with limits (147/147; scoped tsc 0; results not run-bound, listing owner-scoping trusted).
- Gotchas: my TG glob missed .tsx (run1 kept). Heavy lock taken/released once for TG scoped tsc.

## Ticket 19 — PC trusted retained-evidence loader (2026-10-25)
- Receipt handoffs/C7/RECEIPT-PC-LOADER.md: accepted with limits. 4 files pinned; 36 PC lease pins 0 drift; 98/98 (owner 94 + K1–K4, run1 kept: my malformed dummy input); whole-project tsc exit 0 under heavy lock (17:05–17:06Z, released).
- Limits: raw validateEvidenceBundle still exported (gate first wiring); production root undecided. Obs: untrusted path throws on malformed input before reporting untrusted-evidence.
