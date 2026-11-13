# Astra addendum: audit of release #434 (2026-11-13)

You are **Astra**. Your checkpoint 1 audited the frozen release #433 (`master/astra/ASTRA-FIX-SPRINT-AUDIT-checkpoint-1-2026-11-13.md`). This addendum covers **only what release #434 changed**. The ground rules from `ASTRA-SPRINT-AUDIT-PROMPT.md` still apply: read-only; production reads only with TJ's per-batch approval under read hygiene; ask TJ by pop-up; keep a diary; never print secrets.

## Scope
- **Range:** master `4d9b6a10d..496ab3766` (PR #434), a squash of candidate `01ed7f7bc`, which is octoberBranch `6873c28ce` without lane diaries. Verify the tree equality yourself.
- **Held out of #434** (out of scope, but confirm they're absent from the tree):
  - Codex dev items 1 (`fc34b053a`, goalie writer), 2 (`284f99045`, accuracy job) and 6 (`c89ff5d24`, game-stat placeholders, with an unapplied migration `20261113190000`);
  - the CTPI descriptive beta card (`122dd880b`).
- **Independence:** Codex's handback says **item 5 (`4aabe49ee`, `e86f903c0`, the cron skip audit status) was authored by Astra**. Don't audit your own commits. Mark item 5 "needs another reviewer" (Scout or Claude) and audit only its interactions with other lanes, for example the drafted-prospects audit status now `skipped`; test updated in `58891fa46`.

## What #434 claims to fix (verify each against code and tests)
| Your finding / item | Lane and commits | Claim |
|---|---|---|
| AF-01 (P0) | F12 `738191ecf`, `a275d0ec7`, `6873c28ce` | The RSO bridge (`forgeDailyBridge.ts`) and the later-impact inputs (`laterImpactInputs.ts`) read `forge_goalie_candidates_v1`. A goalie gets only his own line; an unlisted goalie is unknown with a label; partial probability mass is never renormalized. The Chef ran fail-first swaps: 4 laterImpactInputs tests and 6 bridge contract tests fail on the pre-fix code. |
| AF-02, AF-06 | F13 `0eaa1f5b4` | Unknown goalie-history counts are dropped before conversion. The opponent-goalie goal and assist multipliers are 1.0, with the posterior kept as `opponent_goalie_context`, `neutral_unvalidated` (decision 148). |
| AF-03, AF-04 | F14 `150e57cc0` | Regulation ties split 50/50 through the shared rule (λ (4,2) gives .7147543100). The goalie moneyline de-vigs each book, then takes the median, using complete, fresh, same-observation pairs only, with no stale fallback. The market table had no rows since 2026-04-21 (read 11-13), so the path is dormant. |
| AF-05 | F7 `369e00828`; bridge label `a275d0ec7` | Version-aware PK admission (`pkBasis` `pk_head` / `pk_unmodelled`); `sumModeledHeads` needs all three heads; `ppPoints` stays PP-only. |
| AF-07 | F15 `8463912d8` | **Adapter only:** `classifyEventStrengthBucket`, with penalty shots in no strength bucket (decision 149). The derived builder is unchanged by TJ's choice, because the tables only have ES, PP and PK columns, which readers sum. Confirm it is correctly labelled partly fixed. |
| AF-08 | F7 `5bb89aef1`, `706937676` | Summary refresh, team queries, refresh windows, admin helpers, summary backfills, the raw gamecenter backfill and `/db` read the stored game state. `teamUnitToiNightly` and settlement were left, with reasons. |
| W1 P0 #14 | F6 `9b51a17ea`, `9b97c4656` | Game Grid odds go only through the withheld helper and are labelled "Odds n/a". Transposed-cell away team fixed. |
| Reserve D2 / L9c | F6 `9b51a17ea`, `9b97c4656` | Exposure is kept for zero-shot history; scratched skaters carry `scratched_not_expected_to_dress` with availability and time-away blocks; skater-stage wiring. |
| Lines | F8 `60874b471`, `655b3263b`, `a4f98e059`, `febf0546e` | Line-source labels; TOI per GP with unknown withheld; season-scoped latest-snapshot unit-TOI reads; 5v5 time share on the 5v5 board. |
| Power ratings v4 | F9 `06c8316a4`, `820e5cb6d`, `d6626b521` (plans `4ed451bd3`, `cbe6d7c9c`, `b9bfe96fa`) | 5-on-5 goaltending from one 5v5 scope (decision 145), and only gp = 1 rows count as games for every component (decision 147). **Code only; not rebuilt** (decision 150 keeps the 47 labelled carry-forward rows). |
| SOS v2 headline | F10 `b2d777ac9`, `5d7c5e2da` | Opponents' points%, completed games only, null not 0%, on four surfaces. The landing keeps 2:1, labelled. Trends SOS pills are neutral (decision 146). |
| PP clock | F11 `a98eda63f` (report `48dd8fe8f`, `8261ab4e2`) | MAT/15 is one 5-minute major. PP share is still withheld (decision 144). Report C1–C3 and O1–O4. |
| sKO read API | Chef `aae1d7c93` | Decision 124: a 503 withheld response; `PREDICTIONS_SKO_READ_API_ENABLED=true` reopens it. Request logs showed no caller in the last day. |
| Codex items 3, 7, 8, 9 | `cd67fb728`, `1dcbf2f12`, `08e0cdc06`, `ee6abc65d`, `adc77310d` | Goalie stage opponent PK shots when known; Yahoo dated roster identity and unknown non-appearances; Yahoo category direction; BLSH admission and signed gaps. |
| Test updates | Chef `58891fa46` | Drafted-prospects skip audit status, and Yahoo `teamAbbreviation: null` in stored lineup entries. Check these are the intended behaviour, not masked regressions. |

## Also check
- Decisions 144–150 in `OWNER-DECISIONS.md`, and that each change implements them as written.
- The CTPI v2 study (F5 `9e2bfd98a`): v2 narrowly fails against v1 only because PDO is dropped. TJ chose a descriptive beta plus checkpoints at games 10/20/30/40. The study also found that the issued 2025-26 v1 history can't be reproduced from current code (Pearson 0.746).
- The release record: `production/PRODUCTION-QUEUE.md` (release #434 entry) and debrief §2, §3, §5, §13.
- Your post-checkpoint finding (social skater rankings score a missing stat like a known zero) is a ticket, not in #434.

## Output
- Append an "Addendum: #434" section to your audit: a verdict per finding and lane, a findings table, and blockers.
- Post `ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-434-<date>` to `CODEX-TO-CLAUDE.md`.
