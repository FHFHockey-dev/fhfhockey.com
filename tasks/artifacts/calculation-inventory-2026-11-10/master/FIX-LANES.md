# Math-audit fix lanes: index (fix-sprint Chef, 2026-11-11)

FIX-SPRINT-PLAN step 3. Built from the Wave 2 draft grouping (L1–L15), the Wave 3 lane-grouping update (L4 split into L4a/L4b; L16–L21 added), and the Wave 1 findings folded in. One lane was missing from the drafts and is added here: **L22 game predictions and odds** (W1-10; decisions 1, 42–45), because `web/lib/game-predictions/**` had no owner.

Every lane follows [fix-lanes/_COMMON.md](fix-lanes/_COMMON.md) (ownership, Codex paths, no production actions, test rules, checks, diary, report). Each brief lists exact owned files, findings with sources and Astra-corrected wording, decisions and traps, readers and tests, production steps for TJ, Tier B questions, out-of-scope items and done criteria.

**Ownership check.** A script expanded every lane's owned patterns against `git ls-files web modeling` (with the documented exceptions: L9b inside `lib/projections`, L12's files inside `lib/trends`, L15's three files inside `lib/fantasy-projections`, L22's `pages/stats/game`, L4b's radar, L8's `socialShare/trends.ts`, and the Codex files). Result: **0 files owned by two lanes, 0 patterns matching nothing.** New SQL migrations belong to L4a only, together with `migration-authority.json` and `supportedBaselineMigration.test.ts` (granted to L4a on 2026-11-11 so the authority counts have one writer).

## Lanes

| Lane | Area | P0s carried | Stage | Depends on | Tier B Qs (asked at start) | Brief |
|---|---|---|---|---|---|---|
| L1 | Event state, parity, PBP ingestion | W1 #4 (parity), #6, #7; root of W2-P0-2, -5 | 1 | — | 30, 31 | [L1](fix-lanes/L1.md) |
| L4a | NST SQL views, migrations, NST game-log ingest | W2-P0-1 | 1 | — | 2, 4, 40 | [L4a](fix-lanes/L4a.md) |
| L6 | Rolling averages and trends | W1 #9, #10 (producer), #11; W2-P0-11 (producer) | 1 | — | 21 (if L5 has not) | [L6](fix-lanes/L6.md) |
| L14 | xG model, aggregates, gate, shot map, Metrics Timeline | W1 #1 (code side), #2 (model side), #3 | 1 | — | 44 | [L14](fix-lanes/L14.md) |
| L17 | Player stats page and stats leaderboards | **W3-P0-1** | 2 (first) | — | 41, 46 | [L17](fix-lanes/L17.md) |
| L2 | Underlying-stats landing and team summaries | W1 #2 (display), #4, #5; W2-P0-2–7 | 2 (first) | L1, L14 (pin) | 12–17 | [L2](fix-lanes/L2.md) |
| L3 | Variance pages, roster matrix, TOI parser | W2-P0-8 | 2 | — | 10, 11 | [L3](fix-lanes/L3.md) |
| L5 | Rankings, splits, impact ratings, team unit TOI | W2-P0-9, -10, -11 (consumer); W1 #10 (consumer) | 2 | L6 | 11, 20, 21, 23, 24, 25 | [L5](fix-lanes/L5.md) |
| L8 | Lines, PP combos, TOI API, shift charts | W2-P0-12, -13 | 2 | L1 | 4, 7, 8 | [L8](fix-lanes/L8.md) |
| L4b | WiGO readers, ratings, writer, radar | W1 #8 | 2 | L4a, L8 | 41 (2) | [L4b](fix-lanes/L4b.md) |
| L16 | Homepage analytics and pulse | — (P1 A1 may become P0) | 2 | L14 | 45 | [L16](fix-lanes/L16.md) |
| L18 | Social share | — | 2 | L12, L13 (registry) | 41 | [L18](fix-lanes/L18.md) |
| L9a | FORGE skater path, context, uncertainty, markets | W1 #18, #19, #21 | 3 | L1, L4a, L6 | 3 | [L9a](fix-lanes/L9a.md) |
| L9b | FORGE goalie path, starters, Start Chart | W1 #16, #17 (cond.), #20 | 3 | — | — | [L9b](fix-lanes/L9b.md) |
| L12 | Team ratings, CTPI, SOS, Game Grid, pickup, Week Score, Top Adds, Power Terminal | W1 #12, #13, #14, #15, #22, #29 | 3 | L2 (helper) | 47 | [L12](fix-lanes/L12.md) |
| L13 | Draft, Draft Pro, category value, projections page | W1 #30; W2-P0-14 (cond.) | 3 | — | 28, 29, 43 | [L13](fix-lanes/L13.md) |
| L22 | Game predictions, odds, game pages (**new**) | — (decisions 42/43 live) | 3 | L14, L12 | — | [L22](fix-lanes/L22.md) |
| L15 | Season evaluator and models, TS + Python twins | — (dormant) | 4 (before L10) | — | 52, 53, 54 | [L15](fix-lanes/L15.md) |
| L10 | Served ledger, planning, season settlement (TS) | — | 4 | L15, L9b | 32, 35, 53, 54 | [L10](fix-lanes/L10.md) |
| L11 | RSO bridge and optimizer | W1 #26, #27, #28 | 4 | L9b, L10, L4a, L13 | 34, 35 | [L11](fix-lanes/L11.md) |
| L7 | Sustainability, trend bands, /charts | W1 #23, #24, #25 | 4 | L3, L9a | — | [L7](fix-lanes/L7.md) |
| L19 | Misc legacy routes | — (dormant) | 4 | — | 50 | [L19](fix-lanes/L19.md) |
| L20 | Legacy sKO | — | 4 | — | 50, 51 | [L20](fix-lanes/L20.md) |
| L21 | Sko Element contracts | — (dormant) | 4 | — | 55, 57 | [L21](fix-lanes/L21.md) |

**P0 coverage (45 raw, 41 by root cause):** every Wave 1, Wave 2 and Wave 3 P0 row has an owning lane above. Partly blocked: W1 #16's accuracy-job component (`run-projection-accuracy.ts`, Codex-owned) goes to Codex as a proposal.

## Order and concurrency (at most 4 lanes running)

Rolling queue: when a lane finishes and Chef has verified it, the next startable lane in this list takes the slot. A lane is startable when its "depends on" lanes are verified (soft dependencies such as a shared helper can be read-only imports of committed code).

1. **Wave A (definitions and units):** L1, L4a, L6, L14.
2. Then, in order: **L17** (live P0, no dependencies; first free slot), **L2** (after L1), **L3**, **L5** (after L6), **L8** (after L1), **L4b** (after L4a), **L16**, **L18**.
3. Then: **L9b**, **L9a** (after L1, L4a, L6), **L12**, **L13**, **L22**.
4. Then: **L15 → L10**, **L11**, **L7**, **L19**, **L20**, **L21**.

Chef may pull an independent lane (L17, L3, L13, L19–L21) forward when the next lane in order is blocked, and will say so.

## Codex coordination (not Claude lanes)

| Item | Why | Route |
|---|---|---|
| BLSH (W2-9 A1, A2, D1–D8; W3-2 D6, D7; W3-7 A1 consumers; Q37–39, Q48) | Codex-owned paths | Codex BLSH lane; L21 posts the Sko contract change |
| Accuracy job (`run-projection-accuracy.ts`: W1-5 outcome, W1-6 D10 gates, W1-7 080) | Codex-owned (LANE-RULES) | L9b proposal in `CLAUDE-TO-CODEX.md` |
| Yahoo historical points and credits (W1-12 R2, `integrations/yahoo/rosterPlanning.ts`) | Codex-owned | L11 proposal |
| NST admission cadence (decision 14: SQL, TS, Python, resumable callers) | `web/lib/cron/nstRateLimitPolicy.ts` is Codex's; `web/lib/nst/**` admission is shared | Chef asks Codex in the mailbox whether its admission candidate covers decision 14 |
| `update-goalie-projections-v2.ts` | Codex-owned | Readers listed in L9b only |

## Not in any lane (owner design first)
- **VuDu** completion: no lane until Q56 is answered.
- **sKO summary design** (intent §9 items 1–3, Q57): components stay separate; L21 records the interim.
- Deletion of any legacy view, RPC, route or column (rule 6): a separate decision after the dependency inventory.

## Production steps queued (Chef asks TJ per action; lanes never run them)

| Step | Lane | Status |
|---|---|---|
| Demotion of xG champion `cfg9bac2706` with per-consumer handling (decision 5) | L14 plan | After L14 and readers land |
| Trend-band history rebuild (decision 36) | L7 | After L7 |
| Reserve projections migration (decision 52) | L11 | Confirm still needed at L11 |
| Bounded underlying-stats summary rebuild (rule 14) | L1 + L2 | After both land, with key-level receipts |
| NST season-view and other SQL migrations (one per pop-up) | L4a | After L4a |
| `wgo_skater_stats` 2010–2017 label repair | L4a | Data repair, own approval |
| Physical-totals migration `20261020211500` | L4a + L9a (Q3) | After the season/cutoff guard |
| `LEDGER_MARKET_ENABLED` off | L10 (Q32) | Env change |
| NST admission cadence fix (decision 14) | Codex coordination | Confirm owner first |
| Reconcile held rolling/FORGE writes before any retry | L6 / L9a | Before any rolling or FORGE rerun |
| Unapplied index migrations `20261109210000`, `20261109213000` | Chef | Confirm still needed |
| Bounded `forge_roster_events` count | L9a | Read, approval |
| WiGO seasonal rebuild after the writer fix | L4b | After L4a migrations |
| Rolling rebuild/backfill; FORGE rerun; ratings recompute | L6, L9a, L12 | After landing |
| Placeholder history repair (Q30) | L1 | Own approval |
| Ledger resettlement; season settlement reruns | L10 | Own approvals |
| Legacy sKO columns, crons, API gating, backfills | L20 (Q51) | Own approvals |
| Bounded log checks: scoreboard (decision 79), legacy routes (Q50) | L10, L19/L20 | Read, approval |
| Releases (Vercel inventory, push, PR, merge, ≤ 5-GET smoke) | Chef | After the integration gate |
