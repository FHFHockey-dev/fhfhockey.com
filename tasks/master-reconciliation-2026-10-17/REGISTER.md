# FHFH reconciled task register — 2026-10-17

Source: `Claude-Code-Handoff-Pack/master/unfinished-master-inventory.md` (Master Page sequence 42, edited 2026-10-15 05:25 UTC, plus the 2026-10-17 overlay). Every one of its 109 unchecked entries appears exactly once below. `inv:L41` is the line of the full verbatim entry in that file; the **Entry** column quotes its opening words. Child entries are indented under their parent with `↳`.

Decisions API / GPT-6 Luna / Vercel AI tweet-agent work is excluded and is not mapped here.

## How evidence was checked (2026-10-17)

- Repository: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch` at `448231ec` (merge of released `457435eb` into `7f094c8e6`), clean tree, pushed to origin. Local `master` = `origin/master` = `457435eb` (production per the 2026-10-16 receipt).
- For each commit hash named in the inventory, I checked: ancestor of `octoberBranch`? ancestor of `origin/master`? If neither, I checked whether its content is in `octoberBranch` anyway: whether its patch reverse-applies to HEAD, plus the share of its added lines found in HEAD. Results are in the ledger at the end.
- Vercel: project settings read through the API on 2026-10-17 (all four projects have previews disabled; production branch is `master`). No application/production requests were made.
- **Not checked:** hosted database state, Yahoo/provider accounts, cron ledgers, live pages, the ChatGPT Pages, and the external worktree/thread receipts the entries cite. A dated receipt quoted in an entry is kept as the source's own claim, not re-verified, unless the Evidence column says otherwise.

## Status vocabulary

`deployed` = in `origin/master` · `integrated` = on `octoberBranch`, not in production · `side-branch` = commit exists only on a separate worktree branch · `local-accepted` = reviewed locally per the source, integration not shown · `complete-at-level` = done at the stated level only · `blocked` · `planned` · `parked` · `unknown` (no current evidence; not treated as done).

## Owners (handoff-pack prompts)

| Code | Prompt |
|---|---|
| FORGE | `fhfh/01-forge-forecast-serving.md` |
| RSO | `fhfh/02-rso-actual-roster-acceptance.md` |
| SC | `fhfh/03-start-chart-shared-forecast-ui.md` |
| IFTTT | `fhfh/04-ifttt-lines-durable-ingestion.md` |
| REL | `fhfh/05-release-repository-synchronization.md` |
| DRAFT | `fhfh/06-draft-dashboard-personal-ranker.md` |
| OPS | `operations/cron-data-health-database.md` |
| UX | `site/site-ux-and-statistical-display.md` |
| AUTH | `site/auth-entitlements-billing.md` |
| GG | `site/game-grid-forecast-integration.md` |
| SOC | `site/social-share-content.md` |
| SEC | `other/03-fhfh-security-candidates.md` |
| QUEST | `other/01-scout-blender.md` + `other/02-vesper-basin-unity.md` |
| PARK | No owner; stays parked until you resume it |
| NONE | No prompt in the pack; needs an owner decision |

---

## 1. FORGE and Forecasting (19)

| # | Entry | Owner | Evidence (2026-10-17) | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 1 | "Extend next-game expectations to the next 10 and 20 scheduled team games…" inv:L41 | FORGE | None checked | planned | 5, 8 | Design note for fixed as-of origin and summed means | None until design |
| 2 | "Run a bounded goalie-start experiment against a simple recent-start-share baseline…" inv:L42 | FORGE | None checked | planned | 5 | Write experiment protocol (chronological, Brier, accuracy) | Authorize new empirical evaluation |
| 3 | "Apply the DRR correction layer before adopting methods…" inv:L43 | FORGE | None checked | unknown | — | Map current goal/point/goalie accounting in code against the listed rules | None |
| 4 | "Finish the goals research baseline, complete appearance histories and truthful coverage reporting…" inv:L44 | FORGE | PP auditor `7e8ff2f8` is **deployed** (in `origin/master`) | complete-at-level (auditor); rest unknown | 5 | Coverage report for appearance histories | None |
| 5 | "Establish defensible future participation and complete roster coverage…" inv:L45 | FORGE | Intake pair `971a43e7` **integrated** (on octoberBranch, not prod) | integrated | Real participation evidence | Separate appearance probability and conditional minutes, per entry | None |
| 6 | "Model full-game goals with disjoint regulation/OT/net-state categories…" inv:L46 | FORGE | None checked | planned | 8 | — | — |
| 7 | "Complete reviewed adapter and prospective test…" inv:L47 | FORGE | `9592e2e6` is **side-branch only** (`chef/forecast-m1-caller-integration`); `web/lib/forecast-diagnostics/loader.ts` is absent from octoberBranch; 0% of its added lines are present | side-branch | Item 9 policy | Decide whether to integrate `9592e2e6` into octoberBranch | Integrate the side branch? |
| 8 | "Align team/player/goalie accounting, cutoffs and model lineage…" inv:L48 | FORGE | `2a15a202` and `45c68485` are not ancestors, but their added lines are effectively all present in HEAD; `9592e2e6` absent (see 7) | integrated (2a15/45c6); side-branch (9592) | 5, 7 | Close impossible-date/source-lineage gaps against current code | None |
| 9 | "Preserve original forecasts and evaluate later versions separately…" inv:L49 | FORGE | Standing policy; not checked | unknown | — | Confirm immutability enforcement in the current writer | None |
| 10 | "Evaluate enough games to establish predictive performance and better legal lineup decisions…" inv:L50 | FORGE | — | blocked | Qualified forecasts (13–15) | — | — |
| 11 | "Model and validate every fantasy category:" inv:L51 (parent of 12–13) | FORGE | — | unknown | 12, 13 | — | — |
| 12 | ↳ "Skaters: G, A, PPP, SOG, HIT, BLK, PIM…" inv:L52 | FORGE | HIT/BLK v3 receipt BLOCKED, per source | blocked | 5 | — | — |
| 13 | ↳ "Goalies: SV, GA, W, SO, SV%, GAA." inv:L53 | FORGE | None | unknown | 23 | — | — |
| 14 | "Verify actual selected TOI storage/readers and strength-specific zeros in published inputs…" inv:L55 | FORGE | Sidecar fix `6767073e` **integrated**, not deployed | integrated | Release | Include in next reviewed release scope (REL) | Release approval |
| 15 | "Resolve the preserved failed game 0041 claim and separately qualify a future native run…" inv:L56 | FORGE | Not checked; never replay | blocked | Future run window | Plan a fresh native run; leave 0041 as failed | Authorize a future run |
| 16 | "Finish current capture-application composition, source/participant/history admission…" inv:L57 | FORGE | Not checked | blocked | Approvals | — | Application activation and budget |
| 17 | "Reconcile hosted migration versions `20261004132508`, `20261004132526` and shared-reader `20261004234756`…" inv:L58 | FORGE (with OPS) | Repo has **only** `supabase/migrations/20261004181455_forge_public_revision_reader.sql`; no local files for 132508/132526/234756. Raw-shift migration `20261011115124_preserve_projection_raw_shift_occurrences.sql` exists locally | blocked | Hosted migration list (read) | Read-only `supabase migration list` against the hosted project | Approve that read; raw-shift migration approval stays separate |
| 18 | "Continue the requested daily prospective-test program only under applicable permissions…" inv:L59 | FORGE | Closure commit `3d15e65e` is **not in this repository** | blocked | Permissions; driver ledger | Inspect daily driver ledger before any retry (overlay) | New daily program approval |
| 19 | "Retain final results separately for completed captures and verify each comparison receipt…" inv:L60 | FORGE | Not checked | unknown | — | Locate PHI–BOS receipt; ANA–CGY comparison | None |

## 2. RSO (8)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 20 | "Pass real-data acceptance using fresh, compatible FORGE forecasts…" inv:L62 | RSO | — | blocked | FORGE serving (5, 14) | — | — |
| 21 | "Verify real startable gains, maximum-starts versus projected-outcome comparisons…" inv:L63 | RSO | Engine fixes local-accepted per source | local-accepted | 20 | — | — |
| 22 | "Finish actual provider/rule acceptance for eligibility, lineup locks, acquisitions/resets…" inv:L64 | RSO | Not checked | local-accepted | Yahoo read access | Fix Yahoo reserve/IR reconstruction (overlay: before treating 19/17 as a defect) | None |
| 23 | "Verify availability completeness, exclusions and connected-league behavior." inv:L65 | RSO | None | unknown | 22 | — | — |
| 24 | "Complete connected Yahoo read-only acceptance for "2026-27 FHFH" / "FHFH TJ," October 12–18…" inv:L66 | RSO | Window ends 2026-10-18; persistence correction part of octoberBranch per source | blocked | 20, 22 | New dated acceptance window (old one is closing) | Pick the next window |
| 25 | "Verify premium automatic versus free on-request recalculation." inv:L67 | RSO (AUTH dep) | None | unknown | 60 | — | — |
| 26 | "Complete broad desktop/mobile workspace acceptance…" inv:L68 | RSO | `5c28f7e8b` (idle requests) **integrated**, not deployed | local-accepted | 20 | Reuse accepted UI; real-account pass only | None |
| 27 | "Accept daily-lineup beta and full-launch weekly-lock behavior…" inv:L69 | RSO | 38/90 checklist, 11 open cases, per source | blocked | 20–24 | Verify RSO task-list attachment delivery | Beta gate values |

## 3. Start Chart (4)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 28 | "Consume the same fresh forecast revision as RSO." inv:L71 | SC | — | blocked | 5, 20 | — | — |
| 29 | "Establish reliable goalie-start/participation evidence and category coverage…" inv:L72 | SC | Not checked | unknown | 5, 13 | — | — |
| 30 | "Finalize naming, layout and sources…" inv:L73 | SC | Route `web/pages/start-chart.tsx` exists, but its `<title>` is still **"Starter Board \| FHFH"**. `894fe7ea` is side-branch only, with about 46% of its lines in HEAD. `9984caf`, `c983535e` and `f3520f0` **do not exist in this repository** | unknown | — | Locate missing commits (other machine/archive) or treat as lost | Final display name |
| 31 | "Pass real-data release acceptance for daily skater and goalie comparisons." inv:L74 | SC | — | blocked | 28, 29 | — | — |

## 4. Game Grid (6)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 32 | "Finish expandable team-row real-data acceptance…" inv:L76 | GG | `web/pages/game-grid` exists | blocked | FORGE serving | — | — |
| 33 | "Reconcile team/player forecasts using matching scope and lineage." inv:L77 | GG | — | blocked | 8 | — | — |
| 34 | "Add category-specific opponent strength with separate skater/goalie effects." inv:L78 | GG | — | planned | — | — | — |
| 35 | "Finish empirical evaluation and release acceptance for graded slate crowding…" inv:L79 | GG | Local regression complete per source (36 tests) | complete-at-level (local) | — | Empirical evaluation plan | Authorize evaluation |
| 36 | "Evaluate timestamped O/U and market inputs without universal fantasy multipliers." inv:L80 | GG | — | blocked | 46, 55 (ESPN odds) | — | Market data rights |
| 37 | "Complete combined review, production authorization and live desktop/mobile verification." inv:L81 | GG | — | blocked | 32–35 | — | Production authorization |

## 5. Data, Lines, Goalies and Operations (9)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 38 | "Finish real-feed goalie confirmation and tweet-assignment acceptance across IFTTT, CCC…" inv:L83 | IFTTT | Parser fixes `90ae40f0` **integrated**, not deployed; IFTTT routes exist under `web/pages/api/v1/sources/ifttt/` | integrated | RPC deadline work (overlay) | Finish RPC deadline work, per overlay | Hosted activation |
| 39 | "Complete live Lines three-context acceptance…" inv:L84 | IFTTT | Not checked | local-accepted | Genuine game window | — | — |
| 40 | "Finish player resolution and real-feed assignment acceptance…" inv:L85 | IFTTT | Not checked | local-accepted | — | — | Authorize a genuine save |
| 41 | "Qualify historical shift/TOI identities, overlaps, observed zeros and parser lineage…" inv:L86 | OPS | Grouping `8b6332` is **side-branch only**; its two new files (`physicalShiftIntervals*.ts`) are absent from octoberBranch | side-branch | — | Decide whether to integrate `8b6332` | Integrate? |
| 42 | "Resolve held game 2026020031 and separate unrepaired 2026010014/2026010056 scopes…" inv:L87 | OPS | Not checked | blocked | Write approval | — | Repair approval |
| 43 | "Verify schedule/roster completeness and freshness…" inv:L88 | OPS | Not checked | complete-at-level (Oct 12–18 schedule) | — | Broader roster completeness check | None |
| 44 | "Finish NST identity, resumability, pagination, throughput and partial-table recovery…" inv:L89 | OPS | `395282458d` **deployed**; `cfaac232e4` **integrated** | complete-at-level (named repairs) | — | Other families only; do not repeat Oct 9–13 repairs | None |
| 45 | "Close the exact cron recovery scopes in the operational checklist below…" inv:L90 (parent of 47–59) | OPS | `c8d41ced` and `ac5d1560` **deployed**; `569245ef` and `26468a9f` **integrated**, not deployed | integrated | 47–59 | Include 569245ef/26468a9f in next release scope | Release approval |
| 46 | "Resolve ESPN odds access and source-specific permission failures." inv:L91 | OPS | Overlaps child row 55 (ESPN odds 403s); kept as its own source entry | unknown | 55 | Use row 55 diagnosis | Supported access method |

### Operational recovery checklist (13): children of #45

| # | Entry | Owner | Evidence | Status | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|
| 47 | ↳ "**Raw projection inputs:** verify usable results for game `2026010056`…" inv:L93 | OPS | Not checked | unknown | Read existing job receipts | — |
| 48 | ↳ "**PBP conflict:** reconcile game `2026020019` and its 741 partial writes…" inv:L94 | OPS | Not checked | unknown | Coverage check for the 4,817-upsert run | — |
| 49 | ↳ "**Weekly FORGE h5 / rolling child:**…" inv:L95 | OPS | Not checked | unknown | — | — |
| 50 | ↳ "**Projection accuracy:**…" inv:L96 | OPS | Not checked | unknown | — | — |
| 51 | ↳ "**NST:** confirm the six partially written tables…" inv:L97 | OPS | Not checked | unknown | — | Throughput choice (6 URLs vs 20 datasets) |
| 52 | ↳ "**Unknown outcomes:**…" inv:L98 | OPS | Not checked | unknown | — | — |
| 53 | ↳ "**Lineup/goalie capture keys:**…" inv:L99 | OPS | Not checked | unknown | — | — |
| 54 | ↳ "**Underlying-stats writer contention:**…" inv:L100 | OPS | Not checked (six Oct 11 games closed per source) | unknown | — | — |
| 55 | ↳ "**ESPN odds:**…" inv:L101 | OPS | Not checked | unknown | — | — |
| 56 | ↳ "**Yahoo ownership:**…" inv:L102 | OPS | Not checked | unknown | — | — |
| 57 | ↳ "**Schedule conflict:**…" inv:L103 | OPS | Not checked | unknown | Authoritative source comparison | — |
| 58 | ↳ "**Morning report timing:**…" inv:L104 | OPS | Overlay says evening job 234 is disabled and must not be restored | blocked | — | Consolidate the two report schedules? |
| 59 | ↳ "**In-season trust workflow (Original 7):**…" inv:L105 | OPS (UX dep) | Not checked | unknown | — | — |


## 6. Business and Access (2)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 60 | "Implement confirmed pricing/access terms and finish branding and genuine entitlement acceptance…" inv:L107 | AUTH | No billing module found by name. `web/lib/draft-pro/access.ts` and `contracts.ts` reference the 2027-07-01 cutoff; whether they are the "pure two-file candidate" is **unverified** | unknown | — | Confirm which files are the 44-test candidate | Proration rounding, refunds, post-cutoff collection, Feb promo |
| 61 | "Resolve duplicate purchases, refunds, late purchasers and entitlement edge cases…" inv:L108 | AUTH | Not checked | blocked | 61 | — | Refund policy |

## 7. Social Content (9)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 62 | "Complete integration, freshness and source/redistribution permissions…" inv:L110 | SOC | `9a26f4c8` patch **is present** on octoberBranch (reverse-applies), though not by ancestry. `2331cc1` is side-branch, with about 89% of its added lines in HEAD. `0a6fed7` **does not exist in this repository** | integrated (9a26); partial (2331) | — | Diff `chef/social-share-tools` vs HEAD for the remaining 11% | Redistribution rights; release approval |
| 63 | "Finish weekday content:" inv:L111 (parent of 64–67) | SOC | — | planned | 64–67 | — | — |
| 64 | ↳ "Monday: schedule rankings, low-ownership pickups and category specialists." inv:L112 | SOC | — | planned | 68 | — | — |
| 65 | ↳ "Tuesday: hot/cold trends, ownership/transactions and deployment changes." inv:L113 | SOC | — | planned | 68 | — | — |
| 66 | ↳ "Wednesday: rest-of-week advice excluding elapsed games." inv:L114 | SOC | — | planned | 68 | — | — |
| 67 | ↳ "Later week: WiGO and category-rescue content." inv:L115 | SOC | — | planned | 68 | — | — |
| 68 | "Qualify player recommendations using trustworthy forecasts and ownership data." inv:L116 | SOC | — | blocked | FORGE serving | — | — |
| 69 | "Label ownership providers, timestamps and observed versus projected values…" inv:L117 | SOC | Not checked | complete-at-level (schedule cards) | — | Ownership-provider labels | — |
| 70 | "Finalize one default image per weekday with optional extras…" inv:L118 | SOC | Not checked | planned | 68 | — | Automatic posting stays unapproved |

## 8. Draft Dashboard / Draft Pro (8)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 71 | "Verify Yahoo/Fantrax live draft sync, interrupted sessions and recovery…" inv:L120 | DRAFT | `31618864` **deployed** | unknown | Live draft (seasonal) | — | — |
| 72 | "Finish one parent acceptance checklist for recovery/resume/restart/import/CSV…" inv:L121 | DRAFT | `76d507e` is side-branch; about 39% of its lines are in HEAD and its patch still forward-applies cleanly. `f3520f0` **does not exist in this repository** | side-branch / unknown | — | Decide whether `76d507e` content is still wanted | Integrate? |
| 73 | "Verify keeper/order handling and resolve historical refund follow-up." inv:L122 | DRAFT (AUTH for refund) | Not checked | unknown | 61 | — | Refund |
| 74 | "Integrate God View and roster-impact features…" inv:L123 | DRAFT | `web/components/DraftDashboard/GodView.tsx` **exists** on octoberBranch | integrated (component present; inclusion of Original 18 inset unverified) | — | Compare inset work to divergent worktree | — |
| 75 | "Verify recommendation correctness, projection-value/table and roster-impact integration…" inv:L124 | DRAFT | `9d66892e` (branch `codex/draft-pro-w05`): its content is effectively present (same subject at `1efd2dfd5`) | integrated | — | Mobile roster-impact acceptance (Original 35) | — |
| 76 | "Finish targeted ADP, sound-cue, hero and dual-position acceptance against current code…" inv:L125 | DRAFT | `b86d6dcc` **deployed** | complete-at-level (tiers) | — | Browser mounting check | — |
| 77 | "Finish live DUST acceptance…" inv:L126 | DRAFT | Not checked | blocked | Live calendar; paid API | — | Paid API approval |
| 78 | "Complete ESPN league/draft feasibility and genuine acceptance…" inv:L127 | DRAFT | Not checked | blocked | ESPN access | — | Source rights / auth method |

## 9. Other Site and Analytics (11)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 79 | "Verify Underlying Stats mobile behavior, alignment and live performance…" inv:L129 | UX | `8374c562` and `d1593dca` are not ancestors, but their content is effectively present (same subjects at `619ff6973` / `ec2bd521c`) | integrated | — | One-game 140-row materialization | Exact write approval |
| 80 | "Finish genuine Shift Chart dashboard/data-state acceptance…" inv:L130 | UX | Not checked | local-accepted | — | — | — |
| 81 | "Finish WiGO polish and reference conformity…" inv:L131 | UX | `76d507e` is side-branch (see 72) | unknown | 72 | Establish timeframe/chevron inclusion | — |
| 82 | "Fix navbar/avatar synchronization and global navigation consistency…" inv:L132 | UX | `8811d3c3` **deployed** | complete-at-level (avatar) | — | Original 23 Stripe/Sass inclusion check | — |
| 83 | "Finish blog UI, search/topics/featured posts and 200% zoom overflow…" inv:L133 | UX | `2b92a17b` content present (reverse-applies); released per source | complete-at-level | — | Feature-specific live acceptance | — |
| 84 | "Resolve SEO/privacy facts: operator/contact, retention/deletion/tracking and indexing…" inv:L134 | UX (SEC for ACL/task-026) | `84eeeece` **deployed** | blocked | Owner facts | — | Operator/contact, retention, tracking facts |
| 85 | "Complete Auth/User Settings and connected-account/entitlement lifecycle." inv:L135 | AUTH | Not checked | unknown | 60 | — | — |
| 86 | "Reconcile Three Pillars, sustainability, trends, deployment changes and Performance Above Expected." inv:L136 | UX | Not checked; overlay notes a sustainability `player_totals_unified` timeout on 2026-10-17 (OPS) | unknown | — | — | — |
| 87 | "Continue Sustainability Barometer, streak research and visual sandbox." inv:L137 | UX | — | planned | — | — | — |
| 88 | "Finish homepage tables/sparklines/eligibility and Slate desktop hero against a concrete brief…" inv:L138 | UX | **Correction to the source:** `3f6dd959` homepage card fixes **are deployed** (an ancestor of `origin/master`), so "production release not established" is outdated | blocked (Original 37) | — | — | Acceptance criteria brief |
| 89 | "Verify completion of top-100/top-250 position-distribution analysis." inv:L139 | UX | — | unknown | — | — | — |

## Release and Repository (7)

| # | Entry | Owner | Evidence | Status | Depends on | Next concrete step | Decision needed |
|---|---|---|---|---|---|---|---|
| 90 | "Reconcile the Gmail "Fw: Weekly Usage Summary for fhfhockeydev's projects"…" inv:L142 | REL | Not accessible from the repo | blocked | You supplying the email | — | Share the summary |
| 91 | "Finish the remaining four-project owner/purpose/dependency and configuration dispositions…" inv:L143 | REL | Read 2026-10-17: previews disabled on all four. `fhfhockey.com` (empty root) is controlled by the root `vercel.json` `ignoreCommand: "exit 0"`, so it always cancels. CMS/functions run Node **20.x** vs web **22.x** (mismatch persists) | unknown | — | — | Purpose of the empty-root `fhfhockey.com` project; Node alignment |
| 92 | "Match deployments for the same commit SHA across all four projects…" inv:L144 | REL | `457435eb`: 1 READY (web) + 3 CANCELED (ignored). `448231ec` push (2026-10-17): **0** deployments in all four projects, 0 GitHub deployments/statuses | complete-at-level (two SHAs) | — | — | — |
| 93 | "Measure actual post-release savings against comparable periods…" inv:L145 | REL | — | blocked | 90 | — | — |
| 94 | "Finish the authorized consolidation to `master` and `octoberBranch`…" inv:L147 | REL | **Done 2026-10-17:** local `master` = `457435eb`; octoberBranch merge `448231ec` (tree `987da54b`) pushed; backup tag `chef/pre-sync-20261017` (local only). Stale prepared merge `f08e5909` and `synchronize-canonical.py` superseded, not run. Remaining: branch/worktree inventory (~79 prunable `/private/tmp` worktrees, ~26 `.codex` worktrees, 2 stashes) and the three generated test collections | complete-at-level (refs) | — | Branch/worktree preservation inventory; no deletions | Approve any cleanup later |
| 95 | "Reconcile the retained local RSO `5c28f7e8b…` checkpoint and all other unreleased work into an exact reviewed release scope…" inv:L148 | REL | `5c28f7e8b` **integrated**. octoberBranch is ahead of production by 7f094c8e6's 5,820 files (5,529 under `tasks/`) plus ~300 `web/` paths | blocked | Owner reviews | Path-level ledger for the ~300 non-task paths | Next release scope |
| 96 | "Review provenance and publish the next accepted local release scope…" inv:L149 | REL | `cbc77a62` **deployed**; `6e14053f` and `1ddef915d` **integrated**, not deployed | blocked | 95 | — | Release authorization |

## Parked and Deferred (7): no automatic restart

| # | Entry | Owner | Status |
|---|---|---|---|
| 97 | "Preserve older classifier/parser/goalie and other paused work…" inv:L151 | PARK | parked |
| 98 | "Keep broader Rankings paused…" inv:L152 | PARK | parked |
| 99 | "Keep FA Portal deprioritized." inv:L153 | PARK | parked |
| 100 | "Defer multiple RSO itineraries, public sharing/export and out-of-session notifications." inv:L154 | PARK | parked |
| 101 | "Explore regression/ML improvements with reviewed—not automatic—production replacement." inv:L155 | PARK | parked |
| 102 | "Explore richer archetypes, opportunity-change detection and separate skater/goalie research modules." inv:L156 | PARK | parked |
| 103 | "Expand integrations, draft polish and social formats after core reliability." inv:L157 | PARK | parked |

## Other Projects (6)

| # | Entry | Owner | Evidence | Status | Decision needed |
|---|---|---|---|---|---|
| 104 | "Verify Beacon app completion when its source and acceptance criteria are supplied…" inv:L159 | NONE | Not in this repo | blocked | Supply source and criteria |
| 105 | "Verify Pipeline Proxy GPT creation." inv:L160 | NONE | Not in this repo | unknown | Is it still wanted? |
| 106 | "Continue the explicitly resumed October 15 Quest sprint with separate map and mech ownership…" inv:L161 | QUEST | Not in this repo; overlay: V19 border resolved, v08 unsigned ARM64 APK built, headset acceptance open | unknown here | Approved mech scale |
| 107 | "Park Mac/iMac home-lab/server exploration." inv:L162 | PARK | — | parked | — |
| 108 | "Verify completion of CRT ident and halftone loading-animation assets." inv:L163 | NONE | Not checked | unknown | — |
| 109 | "Reassess historical guest/episode ideas only if still relevant…" inv:L164 | NONE | — | unknown | Still relevant? |

> **Count check:** rows 1–109 = **109** source entries. The 109 `inv:L…` references are unique and match the source's 109 `- [ ]` lines.

---

## Commit ledger (every hash named in the inventory)

| Hash | On octoberBranch | In production | Content in HEAD if not an ancestor | Used by rows |
|---|---|---|---|---|
| `7e8ff2f8` | yes | yes | — | 4 |
| `971a43e7` | yes | no | — | 5 |
| `9592e2e6` | no (side branch `chef/forecast-m1-caller-integration`) | no | **absent** (0/23 lines; `loader.ts` missing) | 7, 8 |
| `2a15a202` | no | no | present (~all lines) | 8 |
| `45c68485` | no | no | present (~all lines) | 8 |
| `6767073e` | yes | no | — | 14 |
| `3d15e65e` | **not in repo** | — | — | 18 |
| `5c28f7e8b` | yes | no | — | 26, 95 |
| `894fe7ea` | no (`chef/start-chart-consumer`) | no | partial (~46%) | 30 |
| `9984caf`, `c983535e`, `f3520f0` | **not in repo** | — | — | 30, 72 |
| `90ae40f0` | yes | no | — | 38 |
| `8b6332` | no (forge cron-chain branches) | no | **absent** (new files missing) | 41 |
| `395282458d` | yes | yes | — | 44 |
| `cfaac232e4` | yes | no | — | 44 |
| `c8d41ced`, `ac5d1560` | yes | yes | — | 45 |
| `569245ef`, `26468a9f` | yes | no | — | 45 |
| `9a26f4c8` | no | no | present (patch reverse-applies) | 62 |
| `2331cc1` | no (`chef/social-share-tools`) | no | partial (~89%) | 62 |
| `0a6fed7` | **not in repo** | — | — | 62 |
| `31618864` | yes | yes | — | 71 |
| `76d507e` | no | no | partial (~39%; forward patch still applies) | 72, 81 |
| `9d66892e` | no (`codex/draft-pro-w05`) | no | present (`1efd2dfd5`) | 75 |
| `b86d6dcc` | yes | yes | — | 76 |
| `8374c562`, `d1593dca` | no | no | present (`619ff6973`, `ec2bd521c`) | 79 |
| `8811d3c3` | yes | yes | — | 82 |
| `2b92a17b` | no | no | present (patch reverse-applies) | 83 |
| `84eeeece` | yes | yes | — | 84 |
| `3f6dd959` | yes | **yes** (source says not released) | — | 88 |
| `cbc77a62` | yes | yes | — | 96 |
| `6e14053f`, `1ddef915d` | yes | no | — | 96 |
| `a8f58de6`, `90d3d596` | yes | yes (`90d3`) | — | 94 |
| `f08e5909` | object only; never on a branch | — | superseded by `448231ec` | 94 |

"Present" estimates come from patch reverse-apply or added-line matching; they show the content survived. They do not prove the reviewed version is intact.

## Conflicts with the dated Page / overlay

1. The overlay says octoberBranch `a8f58de6` "predates substantial uncommitted overnight work". That work is now committed (`7f094c8e6`, 5,820 files) and public on GitHub. Sync is done at `448231ec`.
2. Row 88: the `3f6dd959` homepage patch **is in production**, contrary to "production release not established."
3. Rows 18, 30, 62, 72: five cited commits (`3d15e65e`, `9984caf`, `c983535e`, `f3520f0`, `0a6fed7`) don't exist in this repository. They may live in another clone or a cloud archive.
4. Row 30: the displayed page title is still "Starter Board", not "Start Chart".
5. Row 17: three of the four named migration versions have no local file.

## Recommended next moves (in order)

1. **FORGE (fhfh/01)** owns rows 1–19. First decision: whether to integrate side-branch `9592e2e6` (row 7). It is absent from octoberBranch and gates rows 7–8.
2. **REL (fhfh/05)** continues read-only: a path-level ledger for the ~300 unreleased non-`tasks/` paths (row 95), plus a worktree/branch preservation inventory (row 94). No deletions.
3. **OPS** can run in parallel without touching FORGE files: rows 41–59, starting from existing receipts only.
