# Diary: calc-triage-fable (Claude Fable, 2026-11-10)

## Scope
Read-only triage of the 35 audit packets in `tasks/artifacts/calculation-inventory-2026-11-10/master/packets/`. Classify the top leads per packet against code, score risk/impact/effort, write `master/TRIAGE.md` (ranked table, wave plan with Wave 1 briefs, confirmed issues, undocumented intent, owner questions). No code edits, no DB data reads, no NST/NHL/Yahoo calls.

## Where
- Branch octoberBranch, checkout /Users/tim/Code/fhfhockey.com (HEAD 8440a7c29 at start)
- Output: tasks/artifacts/calculation-inventory-2026-11-10/master/TRIAGE.md (uncommitted unless Chef says otherwise)
- Working notes: session scratchpad (compact lead extracts, per-packet verification notes)

## Log
- Start: read MASTER.md head, MERGE-NOTES.md, packet layout. Codex leads are almost all boilerplate ("not vetted"); the substantive leads are the ~2,000 Opus red flags.
- Decision: no subagents. TJ stopped the merge agents earlier today for burning the 5-hour usage window, so the lead checks are done solo with narrow code reads.

## Next
Extract compact leads per packet, verify 3–5 per packet, score, write TRIAGE.md.

## Blockers / approvals
None.

## Gotchas
- Packet line numbers are from d31dcb33f / 11e4192d3 and may have drifted; re-locate by symbol.

## Checkpoint: TRIAGE.md written (2026-11-10)
- Output: tasks/artifacts/calculation-inventory-2026-11-10/master/TRIAGE.md (uncommitted; Chef may commit it alone, no attribution lines). Diary stays local.
- 63 leads opened in code: 44 confirmed, 11 likely, 5 unlikely, 1 false, 2 open (need stored data). Line references re-checked against the tree at 8440a7c29 + dirty tree.
- Wave 1 (12 passes, dependency order): xg-part1, nst-derived-stats, rolling part1, team-ratings, goalie-starters, forge part1, forge part2, player-forecasts part1, sustainability part1, game-predictions, rso, fantasy-scoring.
- Checks run: none executed (read-only); no DB, catalog, NST, NHL or Yahoo calls; no subagents.
- Shortfall vs brief: 7 Codex-only packets had no substantive leads to check; 13 light packets got 1–2 code checks instead of 3–5 (listed at the top of TRIAGE.md).

## Next
Chef: commit TRIAGE.md if wanted; get owner answers to section 5 (prod xG artifact, served game model, RSO form/zero policy, catalog-read permission) before dispatching Wave 1.

## Gotchas
- Compact per-packet lead extracts and verification notes are in the session scratchpad only (not in the repo).
- AUDIT-CONTEXT UNDOCUMENTED counts cover Opus entries only (395 of 1,029); Codex-only entries have no intent field.
