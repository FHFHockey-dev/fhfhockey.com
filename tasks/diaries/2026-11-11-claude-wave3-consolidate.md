# Diary: Wave 3 math-audit consolidation (Claude, 2026-11-11)

**Scope:** merge the 7 Wave 3 audits with their 7 Astra reviews into `tasks/artifacts/calculation-inventory-2026-11-10/master/WAVE3-CONSOLIDATED.md`. Docs only; no code, no DB, no network, no sub-agents.

**Where:** `octoberBranch`, base HEAD `c05df316e`. Commit only the consolidated file and this diary (explicit pathspecs; no push).

## Log
- Read RULES-DIGEST, Wave 2 format sections (header, W2-1, defect map, P0s, open Qs 1–40, lanes L1–L15). Combined W1+W2 P0 = 44 raw, 40 by root.
- Read each pair and drafted its section in the session scratchpad; read OWNER-INTENT-SKO-VUDU §9.
- First assembly was 129 KB; rewrote the pass sections tighter → 86.5 KB (target 60–80 KB; head/tail tables kept whole).
- Fixed three code spans containing `|` that broke GFM tables; checked column counts per table.

## Decisions taken in the consolidation (for Chef to review)
- **W3-P0-1** = W3-3 D1 (player stats page averages game rates/shares). Fable rated P1 but said it meets the P0 letter; carried as P0 for consistency with W2-P0-12. Chef may demote (counts then 44 raw / 40 by root).
- Combined P0: 45 raw (43 live + 2 conditional); 41 by distinct root.
- Open questions 41–57: Tier A = 42 (WiGO PP/PK floor + F/D split), 49 (share-card W-L-OTL); 15 Tier B. sKO/VuDu questions kept inside intent §9.
- New rules 22–26. Lanes: L4 split into L4a/L4b; L15 now owns the TS season evaluator (`evaluator.ts`, `contracts.ts`, `seasonJobs.ts`) with the Python; new L16 Homepage, L17 Stats pages, L18 Social share, L19 Misc legacy, L20 sKO legacy, L21 Sko Element; VuDu no lane. Ten ownership conflicts listed.

## State
Done once committed. Nothing pending.

## Gotchas
- Command output over ~30 KB is persisted to a file; use Read with offsets.
- Pipes inside backticks still split GFM table cells.
- An active social-share lane (`2026-10-31-claude-social-share-chef.md`) has uncommitted edits; L18 must not start until Chef settles ownership.
