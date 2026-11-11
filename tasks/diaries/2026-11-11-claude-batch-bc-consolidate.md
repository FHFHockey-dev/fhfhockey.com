# Diary: Batch B/C consolidation (W1-6 to W1-12)

- **Scope:** document only. Write `tasks/artifacts/calculation-inventory-2026-11-10/master/BATCH-BC-CONSOLIDATED.md` merging the seven Fable Batch B/C audits with Astra's reviews, in the style of `BATCH-A-CONSOLIDATED.md`, plus a cross-packet defect map, a Wave 1 P0 list and open owner decisions. Started by Chef (`local_c4e6c533`).
- **Where:** `octoberBranch`, `/Users/tim/Code/fhfhockey.com`. No code, DB or external calls; no sub-agents.
- **State:** done. Read Batch A template, OWNER-DECISIONS 1–60, all seven audit/review pairs, and the P0 headings of the five Batch A audits. File written (about 10,400 words) and committed with this diary; not pushed.
- **Result:** 30 P0 rows (29 live, 1 conditional: Start Chart L10 share). Demoted Fable P0s: spread sign (dormant), scratch tweets (conditional on event count), game-page Poisson (not rendered), FORGE evidence weight (P1 per W1-6). 8 owner decisions still open.
- **Next:** Chef builds the fix plan from the P0 list and the cross-packet map.
- **Blockers:** none.
- **Gotchas:** Batch A's consolidated file has no priority labels, so Batch A P0s came from each Batch A audit's own P0 section, cross-checked against the Batch A corrections. Shot-map (W1-1 D10) and trend-page (W1-3 D4) evidence came from the Astra Batch A reviews.
