# Requirement status (SS 13.1)

Status words: **verified locally** means built, tested, and rendered from real data on a local dev server. Nothing here is released or deployed. SH requirements are tracked with the shared PRD and inherited through the shell (CONTRACT §1).

| Req | Status | Evidence and limits |
| --- | --- | --- |
| SS-R01 | Verified locally | Full `e2e/social-share*` run; old formats untouched (TJ, 13.5) |
| SS-R02 | Verified locally | What Changed; TJ approved |
| SS-R03 | Verified locally | BSH leaders and risers; TJ approved |
| SS-R04 | Verified locally, **with TJ's override** | Now Multi Cat Monsters. Average-percentile score and Points-First with P85 floor are TJ's decision and override "no aggregate score" for this card. Lane B: 2x with the floor only partly isolates scorers who contribute everywhere |
| SS-R05 | Verified locally | Role Watch; TJ approved |
| SS-R06 | **Partly blocked** | Comparison, windows and empty states verified; TJ approved Dahlin vs Hughes. Sourced selection has no qualified evidence and Gemini discovery is blocked by SENTIMENT-ASSESSMENT. 5.6 stays open |
| SS-R07 | Verified locally | Off-Night Edge, both date ranges; TJ approved |
| SS-R08 | Verified locally | Nightly Floor and Cardio; fixes rendered, TJ didn't separately confirm "# GP" |
| SS-R09 | Verified locally | Crease Shift, running share; TJ approved, TJ's VAN example is a fixture |
| SS-R10 | Verified locally | Goalie of the Period, TGV reconciled at CONTRACT §3; TJ approved |
| SS-R11 | Verified locally | GSAx NST model; FHFH model unavailable this season, printed so; TJ approved |
| SS-R12 | Verified locally, **live data gap** | Busy and Quiet approved. HD/GS prints "—" for goalies playing since 10-27 because the NST writer lags; handed to Codex, backfill is TJ's |
| SS-R13 | Verified locally | Goalie Rescue; spacing fix rendered, not separately confirmed by TJ |
| SS-R14 | Verified locally, **with TJ's addition** | Risky Starts approved. TJ added sourced market lines, never converted to probabilities; most future games print "No line yet" |
| SS-R15 | Verified locally | Ratio Impact plain rewrite; TJ approved. Sensitivity is one what-if chart, tables removed from the PNG at TJ's request |
| SS-R16 | Verified locally, **source gates** | Start/Sit approved. Forecast unavailable. IFTTT rows have null `source_account`, so reporter conflicts can't be detected; writer change is TJ's decision |
| SS-R17 | Verified locally, **with TJ's steer** | PNG carries a one-line evidence footer and full evidence sits beside the preview (TJ, 2026-10-31: less fine print) |
| SS-R18 | Audited | Independent audit and three rechecks: 0 blockers, 0 high; 2 mediums accepted by TJ. Released as f17bea20d |

Added by TJ beyond the PRD: **Top Multi-Cat Stars of the Week**, four views, approved. `wgo_skater_stats` hit a 3s statement timeout three times; the shared read retries once (435695923), which reduces failures but doesn't fix the query.
