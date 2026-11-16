# Diary: calc-inventory-opus (Claude Opus, 2026-11-10)

## Scope
Read-only inventory of every in-house calculation (code + DB definitions) for the Fable math audit. Chef = local_c4e6c533. No code changes, no prod writes, no data-table queries.

## Where
- Branch octoberBranch, checkout /Users/tim/Code/fhfhockey.com
- Deliverables: tasks/artifacts/calculation-inventory-2026-11-10/{CALCULATIONS-OPUS.md, calculations-opus.json, coverage-notes.md}
- Working parts (outside repo): session scratchpad parts/*.json

## Log
- 10:5x UTC: read LANE-RULES (pause in force; read-only inventory only). Surveyed layout: web/lib ~400k lines, 384 API routes, 464 scripts, SQL baseline 44.8k lines + ~130 later migrations, functions/ Python (sustainability, sko_pipeline, player_forecasts), modeling/ Python.
- Plan: fan out read-only research subagents by family (each writes JSON parts to scratchpad), then merge/renumber with a script and write MD/JSON/coverage notes myself. No production catalog reads planned: repo migrations are the definition source.

## Next
Launch family agents; merge.

## Blockers / approvals
None.

## Gotchas
- Lane rules forbid commit attribution lines.

## Checkpoint 1
- Launched 12 read-only research subagents (xG, FORGE, player forecasts+RSO+scoring, rankings, sustainability+BLSH+trade, games/sKO/VuDu/team ratings, underlying+rolling+NST, lines/WiGO/goalie starters, draft+misc, API-route inline math, scripts+Python, SQL definitions). Each writes JSON parts + coverage md to the scratchpad.
- Wrote merge script (normalizes families, dedupes, assigns IDs like XG-001, emits MD/JSON) and a gap check: 994 candidate math-bearing files (rg pattern list, excluding tests/fixtures/output/archive) vs files cited in entries.

## Checkpoint 2 — scope update from Chef (TJ's brief alignment)
- New per-entry fields: input units, output scale/range, status (live/flagged off/legacy/draft), existing tests. Must-cover: weekScore (GameGrid/utils/calcWeekScore.ts), sKO, VuDu, BLSH, RSO, every FORGE stage, xG includes/excludes.
- New separate deliverable AUDIT-CONTEXT.md (intent/contract + source, external refs, fixtures/test data; UNDOCUMENTED flags) + audit-context-opus.json.
- Sent BRIEF-ADDENDUM to all 12 agents; merge script extended.
- Chef add-on: draft value math (VORP/VONA/VBD; replacement level, value source, next-available logic, VBD baseline, scarcity/multi-position). Folded into the draft/misc agent (no new agent) with explicit per-point recording.
- Chef add-on: discovery sweep for unnamed metrics + "Not on TJ's or Scout's lists" section. Built constant/function sweep (WEIGHT/FACTOR/MULTIPLIER/BASELINE/PRIOR/COEF/SHRINK/ALPHA/DECAY/HALF_LIFE/THRESHOLD/CLAMP assignments; softmax/sigmoid/logit/ewma/clamp/percent_rank/cume_dist/ntile/percentile_cont/stddev_samp/regr_) → 603 files; union with math sweep = 1,172 candidate files. Uncited ones go to a discovery agent after merge. Merge script emits the not-on-lists table (keyword seeds + manual review). Scout's own list file was not found in repo or notes folder; seeds = named items in Chef's messages.

## Checkpoint 3
- All 12 family agents done. Merge: 972 raw → 967 entries (23 families), 892 with red flags. Fixed family normalization (first segment exact/alias match). forecasts-rso A/B/C sub-parts moved to parts/fr-sub (consolidated file is forecasts-rso.json).
- Gap check: 577 of 1,172 candidate files uncited → 4 discovery-sweep agents (pages/scripts/SQL; lib a–o; lib p–z; components/hooks/utils), each records per-file disposition.
- Next: merge sweep, write coverage-notes.md (synthesis + per-agent appendices), commit, report to Chef.

## Checkpoint 4 (after 5-hour usage limit reset)
- Interim merge written to the artifact folder (976 entries) before the cutoff; sweeps 1/3/4 were cut off by the rate limit and resumed via SendMessage. Sweep 4 done (24 new). Gotcha: my interim merge moved partial sweep files to scratchpad/pending; do not move parts again.
- Chef asks: hand-review "Not on lists", recheck VuDu/BLSH, list web/scripts/blsh/* as Codex-owned pointer, commit, report.
- VuDu/BLSH recheck: uncited files (researchSnapshot.server.ts, storage.ts, useBlshLocalState.ts, BlshCandidateLists/PlayerDetail, pages/buyLowSellHigh.js, legacyQuarantine.ts, SkoElementPreview.tsx) are display/plumbing only → counts stand (BLSH 15, VuDu 3).

## Final state (2026-11-10 ~19:00 UTC)
- Sweeps 1–4 merged: 578 per-file dispositions (NEW 53, DUP-IMPL 7, COVERED-BY 122, INCIDENTAL 396), 62 entries added.
- Final: 1,029 entries (1,034 raw), 954 with red flags; intent documented for most, UNDOCUMENTED flagged in AUDIT-CONTEXT.md.
- "Not on TJ's or Scout's lists": hand-reviewed at metric level → 52 entries (ID list kept in scratchpad unlisted-ids.txt; IDs are stable for this merge order).
- Deliverables: CALCULATIONS-OPUS.md, calculations-opus.json, AUDIT-CONTEXT.md, audit-context-opus.json, coverage-notes.md (with per-agent appendices). Secrets/PII scan of artifacts: clean.
- web/scripts/blsh/* listed as Codex-owned pointer, not inventoried.
- Checks: no code run; JSON generated by node script; no DB/network.
- Next: Chef merges with Codex/Scout lists; Fable audit plan. Diary kept (handoff).

## Task 2: MASTER merge with Codex (Astra) inventory (Chef, 2026-11-10 ~19:10 UTC)
- Source: notes folder codex-calc-inventory-2026-11-10/ (1,318 records = 1,037 primary + 281 symbol candidates; Codex HEAD 11e4192d3; zip sha256 prefix 4fc10c2d per Chef; zip itself not in folder). Not copied into repo.
- Mechanical location crosswalk (same file + same symbol or ≤8 lines = strong; ≤40 weak): 593 Opus entries with strong candidates; 299 with no same-file Codex record.
- Codex's 151 family labels mapped to the 23 Opus families (famap.py, overrides + keyword rules); Codex distinctions kept as heuristic tags (percent scale, conditionality, denominators, generation) and the Codex family label on every Codex view.
- 6 match agents (batches by family) confirm pairs + relation (same / part-of / overlap), semantic matches for unlinked records, conflicts (units/scale/status/inputs/formula/window/denominator), and verify 8+8 one-sided samples each against code.
- build.py / render.py in scratchpad merge2/: master anchored on Opus entries with attached Codex records; Codex-only records become their own entries; packets split at 60 entries.
- TJ (pop-up, ~19:40 UTC): subagents were burning the 5-hour window → stopped all six match agents (no results written) and finished MECHANICALLY with no agents.
- Mechanical: kept pairs = name-token overlap ≥0.2, fanout ≤3, or Codex record in the Opus entry's primary file (codex_part_of_opus); others = low-confidence "possible" links only. Rule-based conflicts (scale 0-1 vs 0-100, TOI s vs min, live vs legacy). 40 pointer checks on one-sided samples: all resolve.
- Result: 1,358 master entries (both 592, Opus-only 437, Codex-only 329 = 258 primary + 71 symbol candidates), 1,283 pairs, 138 possible links, 3 entries with conflicts (floor), 3,632 leads, 35 packets.
- Deliverables in master/: MASTER.md, master.json, crosswalk.csv, packets/*.md, MERGE-NOTES.md. Codex package referenced by notes path + zip sha prefix 4fc10c2d, not copied.
- Gap: no semantic matching → one-sided counts are upper bounds; conflicts under-detected. Resumable single-agent semantic pass: inputs + brief in scratchpad merge2/.
