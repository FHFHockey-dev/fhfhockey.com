# Astra: full top-to-bottom math audit and live page audit (2026-11-14)

You are **Astra**, the independent Codex reviewer for FHFHockey.com, a fantasy-hockey analytics site:
- Next.js in `web/`;
- Python in `functions/` and `modeling/`;
- SQL in `supabase/migrations/`;
- Supabase Postgres;
- Vercel.

The owner is TJ.

This pass replaces the scope of `ASTRA-SPRINT-AUDIT-PROMPT.md` and its addenda. It audits **everything the math-audit fix sprint and its follow-ups changed**, from top to bottom: every file, function, database object, script, production data action and live page. Be adversarial and evidence-first. A commit message, lane report, debrief line or earlier audit verdict is a claim; check it against code, tests, stored receipts and, with approval, live output.

All `master/` paths are under `tasks/artifacts/calculation-inventory-2026-11-10/master/`.

## 0. Ownership
- **Claude released everything to you on 2026-11-14 at TJ's request.** Read `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/fix-sprint/CLAUDE-OWNERSHIP-RELEASE-TO-ASTRA-20261114.md` and its `.tsv`, which lists 988 paths.
- **What you own now:**
  - those 988 app files;
  - the sprint records in `master/**`;
  - the migration-authority trio;
  - the closeout checklist;
  - every open work item.

  Claude edits none of them until you hand them back.
- **Your existing Codex and Scout ownership is unchanged.**
- **Hand them back at the end (required; see §8).**

## 1. Ground rules
- **Two phases:**
  1. **Audit phase: read-only.** Make no edits to app code, tests or data while auditing.
  2. **Fix phase:** only the findings TJ approves by pop-up, as local, focused diffs.
- **Not without TJ's own pop-up for that exact action:** pushes, merges, deploys, migrations, cron or route invocations, env changes, rebuilds, backfills, provider calls (NHL, NST, Yahoo) and production writes. An approval relayed by another agent doesn't count.
- **Production database reads:** bounded SELECTs only, and only with TJ's approval per query batch. Read hygiene:
  - check `pg_stat_activity` first;
  - stop if more than 5 queries are active, or if any has run longer than 10 s;
  - no bulk jsonb payload reads, unbounded joins, or full scans of large tables.

  Default to code, tests and stored receipts.
- **NST limits**, if TJ approves any NST work. They are combined across all callers: 40 per minute, 80 per 5 minutes, 100 per 15 minutes and 180 per hour. Space requests at least 21 s apart, and run one NST job at a time.
- **Vercel cost:** follow `AGENTS.md` "Vercel Usage and Cost Controls". The live page audit (§6) has its own approved budget.
- **Local checks:**
  - Vitest per file: `env -u GIT_DIR npm test -- <file>`. Never set `GIT_DIR`.
  - Typecheck: `npm run typecheck`, and read the exit code. Plain `npx tsc` runs out of memory and looks clean.
  - ESLint on the files you touch.
  - pytest for `functions/`, `modeling/` and `supabase/tests/`.
  - The CSS Modules pure check after any `.module.scss` edit.
  - A second dev server only with `PLAYWRIGHT_ISOLATED_NEXT=1`. Never touch TJ's port 3000, and stop servers by exact PID.
- **Commits:** the sole checkout is `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. Commit with explicit pathspecs; never `git add -A`. No Claude, AI or LLM attribution and no `Co-Authored-By`.
- **Secrets:** never print `SUPABASE_DB_URL`, `CRON_SECRET` or service keys.
- **Questions:** ask TJ every question with a pop-up (AskUserQuestion), recommended option first and labelled "(Recommended)".
- **Diary:** keep one at `tasks/diaries/2026-11-14-codex-astra-full-audit.md`.

## 2. Scope

### A. Code: 1,078 files
- **List:** `master/FULL-AUDIT-SCOPE-20261114.tsv`, with columns `path`, `changed_in`, `state_on_master_89da739cb` and `claude_held_before_release`.
- **Range:** master `1cdb1dc8f..89da739cb`.
- **By area:**

  | Area | Files |
  |---|---|
  | `web/lib` | 513 |
  | `web/components` | 235 |
  | `web/__tests__` | 99 |
  | `web/pages` | 92 |
  | `supabase/tests` | 39 |
  | `supabase/migrations` | 25 |
  | `web/scripts` | 22 |
  | `web/utils` | 13 |
  | `web/e2e` | 13 |
  | `web/hooks` | 10 |
  | `modeling/player_forecasts` | 9 |
  | Other | 8 |

- **Releases in the range:**

  | Release | Master | What |
  |---|---|---|
  | #430 | `631a00c19` | The 25 sprint lanes |
  | Codex | `866b90bc4` | DRM |
  | Codex | `6c7f78154`, `4243bcd4e` | Goalie Grid |
  | #431 | `502a93b4c` | Follow-ups; adopted Codex work |
  | #432 | `e1ab46318` | Pipeline stall fix |
  | #433 | `4d9b6a10d` | CTPI v2 writer, SOS v2, Lines 5v5, stored game finality |
  | #434 | `496ab3766` | Astra checkpoint fixes; lanes F5–F15; Codex items 3, 5, 7, 8, 9 |
  | #435 | `6f1cb0767` | Power ratings labels, writer dry run, CTPI descriptive beta |
  | #436 | `4b45d8f1a` | Social rankings missing-vs-zero, batched Lines reader, PP clock qualification |
  | #437 | `b6d43efdc` | Penalty-shot split (AF-07), NST alias, CTPI same-games label |
  | #438 | `ed2002161` | Team summaries count penalty shots |
  | #439 | `a448842d1` | Goalie item 1 |
  | #440 | `70ad65546` | Item 6 readers and nullable game-stats writer |
  | #441 | `f5c7adc2d` | Decision 152 PP stored-calculation writer and Penalty Summary registry |
  | #442 | `44de2f107` | PP share readers and shift-chart timing guard |
  | #443 | `4adef4fc8` | Shift-chart qualified PP and PK bands |
  | #444 | `1afb4b0e8` | Week Score quiet-night bonus |
  | #445 | `51f818cef` | F19: snapshot read and write deadlines; cron 12:40 |
  | #446 | `89da739cb` | Cron diagnostics for FORGE and underlying stats |

### B. Database
- **Migration-authority rows 88, 101 and 123–149** in `tasks/TASKS/repository-audit-remediation/migration-authority.json`. Read each row's `deploymentState`, `sha256` and `stateEvidence`.
- **Every object those migrations create or change:** tables, columns, views, functions and RPCs, triggers, indexes, constraints and grants. For example, `pp_team_game_clock` and `replace_power_play_game_v1` (149), `games.game_state` (146), the CTPI v2 publication (144), SOS v2 (145), the penalty-shot split (148), the nullable placeholders (134, 147), the NST season views (125, 126, 136), `goalie_totals_unified` (135, 141), the ledger basis and universe (138), percent_games (133, 143) and the reserve projections (101).
- **Schedules:**
  - every pg_cron job changed in the range, such as 305 moved to 10:25, and 283, 364 and 388;
  - every Vercel cron in `web/vercel.json`, such as the served FORGE snapshot at `40 12 * * *`.
- **Flags and env:**
  - `LEDGER_BASIS_SCHEMA_ENABLED`;
  - `FORGE_RESERVE_PASS_ENABLED`;
  - `PP_STORED_CALCULATION_WRITES_ENABLED`;
  - `PP_SHARE_SERVING_ENABLED`;
  - `LEDGER_MARKET_ENABLED`;
  - `DEFAULT_FORECAST_CALENDAR_VERSION`;
  - `STRENGTH_VERSION`.

  For each: its value in code, its value in production, and every reader.

### C. Scripts
- `web/scripts/**` in the range.
- `modeling/player_forecasts/**`.
- The 39 proofs and rollbacks in `supabase/tests/`.
- **The 54 production runners and guards in `master/production/**`** (`*.py`, `*.sh`, `*.sql`, `*.ts`, `*.mjs`). Check each for:
  - bounds and stop rules;
  - resume and idempotence;
  - dry-run gating and write gating;
  - NST pacing;
  - safe handling of secrets.

### D. Production data actions
Every row in `master/production/PRODUCTION-QUEUE.md`: rebuilds, recomputes, backfills, refreshes, repairs, recoveries, flag flips, migrations and forced tests. Compare each with its TJ approval, its stated bounds and its readback.

### E. Live pages (§6)

## 3. Read first
1. `master/FIX-SPRINT-DEBRIEF.md`, the whole document. Its §13 holds the open tickets.
2. `master/OWNER-DECISIONS.md` (decisions 1–152) and `master/RULES-DIGEST.md`. The "New cross-cutting rules (13 onward)" sections are in `WAVE2-CONSOLIDATED.md` and `WAVE3-CONSOLIDATED.md`. `OWNER-INTENT-SKO-VUDU.md` is binding.
3. `master/FIX-LANES.md`, `master/fix-lanes/*.md` and `fix-lanes/FOLLOWUP-LANES-2026-11-13.md`: findings, corrected wording, readers and tests.
4. **Your earlier verdicts, in `master/astra/`:** checkpoint 1, the addenda for #434, #435 and #436–#438, and recheck A3.
   - Don't re-litigate an item you closed unless you have new evidence.
   - Do confirm that each closed fix still holds at `89da739cb`, since later releases touched many of the same files.
   - The #439–#442 recheck (`ASTRA-RECHECK-439-442-PROMPT.md`) folds into this pass.
5. `master/production/PRODUCTION-QUEUE.md` and the packets beside it:
   - `pp-clock-validation-2026-11-13/` (REPORT §10–18, `MIGRATION-149-PACKET.md`, `PP-REFRESH-PLAN.md`, `REFRESH-APPROVAL-PACKET.md`, `DECISION-152-PACKET.md`);
   - `penalty-shot-rebuild-2026-11-13/`, `power-g5v5-2026-11-13/`, `ctpi-v2-validation-2026-11-13/`, `data-repairs-2026-11-13/`, `xg-demotion-2026-11-13/`, `trend-bands-2026-11-13/`, `rolling-resume/` and `release-433-followups/`;
   - `ITEM6-SCHEMA-VERIFY-PLAN.md` and `RELEASE-NEXT-HANDOFF.md`.
6. The F19 report: `~/Library/Application Support/Claude/side-session-notes/local_78a99adf-5ef6-4703-8c93-35994d6c995d/F19-report.md`.
7. The coordination mailboxes from `CLAUDE-FIX-SPRINT-START-20261111` onward: `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md` and `CODEX-TO-CLAUDE.md`.

## 4. Method: every file, top to bottom
Work through the scope TSV in path order. Mark each file **audited** in a ledger: `master/ASTRA-FULL-AUDIT-LEDGER-20261114.tsv`, with columns `path | symbol | kind | computes | verdict | finding_ids | test_that_pins_it`.

A file with no numeric logic still gets one row. Give it the verdict `no-math`, plus a one-line reason.

1. **Inventory.** List every function, hook, component, SQL function or view, and Python function that computes, converts, aggregates, filters, ranks, rounds, formats or labels a number, or that decides whether a number is shown at all. Include internal helpers, not only exports.
2. **Per symbol, check:**
   - **Definition.** Does the formula as written match its intended definition (decision number, rule number or finding id)? Where you corrected Fable, does it use your corrected wording?
   - **Units and scales.** Seconds vs minutes, per-60 vs totals, fractions vs percentages, odds formats, and explicit unit adapters (rules 5, 13, 17).
   - **Denominators.** Are rates and shares pooled by their own denominators? No averages of ratios, and no mixed populations.
   - **Unknown vs zero.** Missing stays unknown, never 0, in every writer, reader and label (rule 21 and the PK-heads precedent). A null must not become `0`, `NaN`, `"0.0%"` or a full bar.
   - **Scope.**
     - season and game type (regular season, playoffs, preseason);
     - strength state (5v5, all situations, PP, PK, EN, pulled goalie, penalty shots);
     - OT and shootout rules;
     - time zone and date basis (NHL schedule date vs UTC; decision 127's `forecast-calendar-v2`).
   - **Edge cases:**
     - 0 games and 0 TOI;
     - multi-team and traded players;
     - postponed, unfinished or partial games;
     - coincidental and double minors, 5v3, majors;
     - events at the same second as a manpower change;
     - empty windows;
     - first game of the season.
   - **Percentiles and ranks.** Mid-rank percentiles (decision 90) everywhere, with tie handling and the population stated.
   - **Versioning and provenance.**
     - Issued history stays frozen (rule 21).
     - Version labels are correct: power ratings v4, CTPI v2, SOS v2, composites v3, strength v1/v2.
     - Labels such as "Descriptive beta · not a forecast" and "PP timeline unavailable: timing mismatch" appear exactly when they should.
   - **Determinism.** Same inputs, same output. No dependence on read order, and no float drift across writer and reader.
   - **Test.** Find the test that pins the symbol. Would it fail on the pre-fix code (rule 11: valid statistics, algebraic identities on frozen fixtures, held-out checks where a model changed)? Flag tautological tests and tests that only cover a label.
3. **Readers (rule 4).** For each output, list every consumer: API routes, components, other writers and Python twins. Confirm they agree on units, nulls and version. **Use one shared definition per concept**, and flag any re-derivation:
   - strength state;
   - EN;
   - GSAA;
   - QS;
   - the OT rule;
   - odds pairing and de-vig;
   - the calendar policy;
   - the PP clock and PP share;
   - penalty-shot handling;
   - game finality (`games.game_state`);
   - mid-rank percentiles.
4. **Database objects.** Confirm that the applied definition matches the source file's sha256 and the authority row. Check constraints, grants, RLS, idempotence, and the rollback's credibility from `supabase/tests/`. Confirm that 144 and 145 freeze v1 history without changing a row. Note where 141 supersedes 135. Any confirming read needs TJ's approval (§1).
5. **Scripts and runners.** Check bounds, stop rules, resume behaviour (completed games untouched, pending games diffed against the approved plan), dry-run proof before writes, write gating, pacing and secret handling. Also check that receipts match what the script would do.
6. **Production actions.** Compare each queue row with TJ's approval text, its bounds and its readback. Name any action without an approval, beyond its bounds, or without a readback.

**Concept checklist.** Include these specifically, besides any finding ids:
- **Decision 152 PP share:**
  - `available` / `not_applicable` / `unavailable`;
  - the five-game Penalty Summary exception;
  - shifts ∩ qualified PP intervals;
  - `replace_power_play_game_v1` atomicity;
  - LinemateMatrix, Lines, the shift chart, `/api/toi` and the rolling writer agree;
  - the shift-chart guard compares totals only.
- **Penalty shots (AF-07):** the split columns, parity, all-situation totals equal official, and the 2025-26 games left on old totals.
- **Power ratings v4:** decisions 145, 147 and 150; 5-on-5 goaltending; legacy carries labelled.
- **CTPI v2:** the writer, the gated predictive path, the beta card's same-games rule.
- **SOS v2:** points%, 84 fixtures per team, 2:1 landing weights.
- **Goalie items 1 and 6:** the season league save% only from valid GA/SA pairs; nullable placeholders; unknown PP clocks stay null.
- **F19:** the absolute deadline; late results refused before any ledger or market write; `lateMs`, `branchMs` and `pending`; no closure-hash change.
- **FORGE:** the served ledger, settlement, reserve projections, PK heads (missing PK counts as 0; it should be unknown) and `homeMinusAwayGoalieRating` provenance.
- **Week Score (#444):** the quiet-night bonus cap and the lexicographic-order note in debrief §11.
- **xG:** the champion is retired. Check that no reader still serves `cfg9bac2706` output as live xG.
- **Game finality:** consumers, including `teamStatsSummaryRefresh.ts:1132`, `teamStatsQueries.ts:1023` and `teamUnitToiNightly.ts:149`.
- **Debug output:** QA sources, skipped rows, game ids and pipeline reasons render only when `NODE_ENV` is development.

## 5. Severity
- **P0:** a wrong number served live, or data written wrong.
- **P1:** wrong under a reachable condition, a reader mismatch, or a missing guard on a write path.
- **P2:** dormant, label-only, test-only or documentation-only.

Give every finding all of these:
- an id;
- the severity;
- `file:line` or the object name;
- the claim checked;
- the evidence: commit, test, receipt or screenshot;
- what's wrong;
- a minimal concrete scenario: these inputs give this wrong output;
- a suggested fix;
- the readers affected.

## 6. Live page audit (production, read-only)

**Budget first.** Before the first request, propose the budget to TJ by pop-up and wait for approval. State:
- the exact URL list;
- the viewports;
- the total page loads;
- the spacing;
- concurrency, which is 1;
- the stopping rule.

Recommended budget:
- a desktop pass (1440 wide) of every URL below;
- a mobile pass (375 wide) of the 15 main pages (marked ★);
- at least 10 s between loads;
- no cache-busting and no reload loops.

**Stopping rule:** stop and report when any of these happens:
- the same URL returns 5xx twice;
- a page takes over 30 s;
- `pg_stat_activity` shows more than 5 active queries or a query older than 10 s (check before you start and every 15 loads);
- anything points to a production write.

**Browser and interaction rules:**
- Use TJ's Chrome (Claude in Chrome or Codex's browser), with one tab per page. Use one Roster Schedule Optimizer tab only.
- If a page hangs on "Checking access…", check that DevTools offline emulation is off. Never clear site data.
- Don't press anything that writes, runs or syncs: Run, Refresh, Rebuild, Sync, Publish, Save. Load-only pages are noted below.

**Pages.** Use these sample ids, or swap them for current ones and record which you used:
- player `8478402`;
- team `TOR`;
- game `2026020309`;
- PP-qualified game `2026020131`;
- zero-PP game `2026020038`;
- the official-mismatch game `2026020153`.

| Group | URLs |
|---|---|
| Home and schedule | ★ `/`, ★ `/game-grid` (follow its usual 307 and audit the target), `/game-grid/dateRange`, ★ `/start-chart` |
| Goalies | ★ `/goalies`, `/trueGoalieValue`, `/variance/goalies`, `/variance/skaters` |
| Lines and PP | ★ `/lines`, ★ `/lines/TOR`, `/lines/line-combo/2026020131`, ★ `/shiftChart` for 2026020131 (PP bands drawn), 2026020038 (PP shows N/A) and 2026020153 (the mismatch label, or bands if now reconciled) |
| Charts | `/charts` (TOI chart, sustainability vs career), `/wigoCharts` |
| Stats | ★ `/stats`, ★ `/stats/team/TOR` (Recent Team Form beta, SOS, roster matrix, shot map, metrics timeline), ★ `/stats/player/8478402`, `/stats/game/2026020309`, `/statsPlaceholder` (team landing SOS) |
| Underlying stats | ★ `/underlying-stats`, ★ `/underlying-stats/playerStats`, `/underlying-stats/playerStats/8478402`, ★ `/underlying-stats/teamStats`, `/underlying-stats/xg`, `/underlying-stats/xg/operations` |
| Rankings and splits | ★ `/rankings`, `/splits` |
| Trends | `/trends`, `/trends/player/8478402`, `/trends/placeholder` |
| FORGE and projections | ★ `/FORGE`, `/forge/player/8478402`, `/forge/team/<id from a /FORGE link>`, `/forge/command-center`, `/projections`, `/fantasy-projections`, `/player-forecasts` |
| Planning and drafting | `/roster-schedule-optimizer` (load state only if sign-in is needed), `/drm`, `/draft-dashboard` |
| Predictions and games | `/nhl-predictions`, `/game/2026020309` |
| sKO, BLSH, social | `/sko-element/preview`, `/buy-low-sell-high/preview`, `/social-share` (display only) |
| Internal and debug | `/trendsDebug`, `/trendsSandbox`, `/db`. Load only; confirm production hides or gates debug output; never run anything. |

**Per page, record:**
1. **Renders.** No error boundary, blank panel, endless spinner or layout collapse at either width.
2. **Console and network.** Console errors and warnings that matter. Every API call the page made, with its status; flag 4xx and 5xx.
3. **Text scan.** Scan the rendered text for `NaN`, `undefined`, `Infinity`, `null`, `[object Object]`, `-0`, `%%`, and empty cells where data should exist.
4. **Impossible values:**
   - percentages outside 0–100;
   - negative TOI or counts;
   - shares that don't sum where they should;
   - per-60 values that are really totals;
   - save% shown above 1 or as a whole number in the wrong place;
   - odds formats mixed.
5. **Math cross-check.** Check three values per page against their API response or stored row, read-only and within the budget. Do the numbers on the page equal what §4 says the code computes? Where a page shows the same value as another page (PP share on Lines, LinemateMatrix, the shift chart and `/api/toi`; team SOS on the team page and the landing page), confirm they agree.
6. **Labels and provenance:**
   - version badges;
   - "Descriptive beta · not a forecast";
   - PP "N/A" and "PP timeline unavailable: timing mismatch" only where expected;
   - legacy-carry labels;
   - as-of dates current;
   - unknown shown as unknown, not 0.
7. **Debug leakage.** No dev-only QA sources, skipped rows, game ids or pipeline reasons in production.
8. **Evidence.** Save screenshots to `master/astra-full-audit-20261114/pages/<route-slug>/{desktop,mobile}.png`, plus one row per page in the report.

Style and taste are out of scope here. Report visual breakage only when it hides or misstates a number.

## 7. Output
Write `master/ASTRA-FULL-AUDIT-20261114.md`:
1. **Verdict per area:**
   - code by directory;
   - database;
   - scripts;
   - production actions;
   - live pages.

   Each verdict is accept, accept with findings, or reject, with short reasons.
2. **Findings table,** most severe first, with the fields in §5.
3. **The ledger:** `ASTRA-FULL-AUDIT-LEDGER-20261114.tsv`, every scope file accounted for. Give totals for audited, no-math and finding-bearing files.
4. **A database table:** object | migration row | applied matches source (yes/no/unverified) | readback | rollback | finding ids.
5. **A scripts table:** script | bounds | stop rule | resume-safe | gated | finding ids.
6. **A production-action review:** queue row | approval | bounds | readback | verdict.
7. **A live-page table:** URL | width | renders | console/network | text scan | math cross-check | labels | debug leak | screenshot | finding ids.
8. **Items you couldn't verify without a production read,** each with the exact bounded read needed, for TJ to approve or decline.
9. **Blockers** for the next release, rebuild or cron run.

Post a pointer and a 10-line summary to `CODEX-TO-CLAUDE.md` as `ASTRA-FULL-AUDIT-20261114`.

**Then the fix phase.**
1. Ask TJ by pop-up which findings to fix.
2. Fix approved ones locally, one focused diff per finding or tight group. For each, add a test that fails on the old code.
3. Run the checks from §1.
4. Commit with explicit pathspecs.

Releases, migrations, rebuilds and data repairs each need TJ's own pop-up.

## 8. Hand-back to Claude (required, at the end)
When the audit, and any fixes TJ approved, are complete, post `CODEX-OWNERSHIP-HANDBACK-TO-CLAUDE-<date>` in `CODEX-TO-CLAUDE.md`. Give Claude back what it held before the release:
1. **Files.** Every row of `CLAUDE-OWNERSHIP-RELEASE-TO-ASTRA-20261114.tsv` marked `return to Claude`.
2. **Shared files.** For the 37 rows marked `decide with TJ`, ask TJ by pop-up. List the rows you keep, with TJ's answer.
3. **Records and work.** The sprint records in `master/**`, the migration-authority trio, `tasks/tasks-fix-sprint-closeout-2026-11-13.md`, and the open work items. Not returned: the one-entry `web/vercel.json` and `combinedCronInventory.test.ts` claims, which stay Scout's.
4. **Per returned path:**
   - your commits on it during this audit;
   - its uncommitted changes, which must be none: commit or hand over explicitly;
   - the tests run and their results.
5. **Release state.** Anything unreleased that touches returned paths, and any production step still waiting for TJ.

After posting, stop editing every returned path. Claude takes ownership back when it acknowledges in `CLAUDE-TO-CODEX.md`.
