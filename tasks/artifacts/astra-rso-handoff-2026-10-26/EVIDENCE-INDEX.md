# RSO/FORGE evidence index for the Astra audit (2026-10-26)

This index was compiled read-only at octoberBranch, after cd73cbd69. Originals are preserved in place and nothing was moved. Hashes are full sha256. Mtimes come from `stat`; "doc" marks a date written inside the document.

Path abbreviations:
- **R** = `/Users/tim/Code/fhfhockey.com`
- **RA** = `R/tasks/artifacts`
- **C** = `RA/cross-platform/2026-10-24-coordination`
- **T** = `/Users/tim/Documents/Codex/2026-10-25/task-4`
- **ARC** = `/Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/clean-checkout-2026-10-25-1505/files` (read-only archive)

## A. Original plans, vision and PRDs (oldest first)
| Path | mtime / doc | Description | sha256 |
|---|---|---|---|
| R/docs/roster-schedule-optimizer.md | 2026-08-29 | Original RSO feature doc: pure TS engine, Bench Game definition | 92ca6de8ab3e027da95c465d9b7318feaf77a02cb43a9f90e40d41108f662e03 |
| R/tasks/prd-roster-schedule-optimizer.md | 2026-09-28 | Original approved implementation plan and forecasting extension | 3767a836dbcef9aad6dbf56a149b7ae8b908aea2e1202fc974bf5ba57419f19a |
| R/tasks/tasks-prd-roster-schedule-optimizer.md | 2026-10-02 | Prep list and verification for the original PRD | ced28e5f557e3d17cd3a0adb56164cac0f0f79ad6494d72bf3fea0ad942b49f8 |
| R/tasks/TASKS/prd-rso.md | doc 10-08 | Audited PRD (requirements finalized, release open) | f8f3cfc3724cf18ee82c4eb88446dd626e42328cfb5420df213b214dc644cd3f |
| R/tasks/TASKS/rso-audit-2026-10-08.md | 10-11 | RSO audit, Oct 8 | aff8c61e855d776d60794f768a989de96981c3935cb43729e89ac0d4c140cb98 |
| R/tasks/TASKS/rso-implementation-2026-10-08.md | 10-11 | Local implementation evidence | 2c168201cff10b74dc9fadf70c2732c316995b3d71e9dc5bdb10b801f696de70 |
| R/tasks/tasks-prd-rso.md | 10-11 | Task list for prd-rso | 7191ef3a8867e9049ea53c4b246baf85e429716d633d9ddfcf8ef0f15f86aacc |
| R/tasks/TASKS/rso-compact-layout-amendment-2026-10-09.md | 10-11 | Compact layout amendment | 7e1ead65338212938b4cd9589f20fb105c40d36c3525670b0f1e860bb99da2a1 |
| R/tasks/tasks-rso-compact-layout-2026-10-09.md | 10-11 | Compact layout tasks and receipt | 414cecb45a5edf97cc4bed34f53d68d57c016f093972d15a7549c43372b03e6c |
| **R/tasks/TASKS/prd-rso-consolidated-2026-10-09.md** | doc 10-09, with an Oct 13 amendment | **Consolidated PRD: the product authority.** Daily beta and full launch are not yet accepted | 9043fe42b9b39d310056acfe9fd4b25503918421188f6cf2ba16c5816c60dff1 |
| R/tasks/tasks-prd-rso-consolidated-2026-10-09.md | 10-13 | Implementation and acceptance checklist (tasks 30–31 local-candidate only) | 4158fd9ccb740621305576607406d66cb860ee2b70b38aa15ec6ccd15d1ff2f8 |
| R/tasks/rso-goal-handoff.md | 10-13 | Goal handoff: local candidate verified, live gates open | 78838e5377ba8523bf8651dd23034130790c0f433ca64b6941344bb270703971 |
| ARC/…/handoffs/RSO-FREE/FREE-RSO-ANALYSIS.md | 10-24 | Original free-RSO proposal | c84a2488914bff0e54247b4d67167a2fa4dff6226c577052b3f25038d67ad640 |
| ARC/tasks/artifacts/free-rso-analysis-2026-10-24/FREE-RSO-RECOMMENDATION.md | 10-24 | Corrected free-RSO recommendation (no-input discovery; keep the free manual optimizer) | bb25b9d83e374b33142f0ad5f2e9f2c0446192ef4934c90cfeb0f950d27d86f9 |

The PRD's source draft is also at `/Users/tim/Downloads/FHFH-RSO-Consolidated-PRD-2026-10-09.md` (not hashed).

## B. Owner (TJ) decisions and amendments
- **Mailboxes:**
  - C/CLAUDE-TO-CODEX.md (sha b906fe2d…, mtime 10-26 10:28; later entries 100–101 have been appended since).
  - C/CODEX-TO-CLAUDE.md (493d54a1…; no entries after CODEX-086).
- **Decision files:**
  - RA/rso-wave2-2026-10-25/FORGE-QUAL/TJ-DECISIONS-RECORDED.md (e6e5591c…)
  - RA/rso-yahoo-diet-2026-10-26/TJ-DECISIONS-RECORDED.md (3eafcb9e…)
  - RA/rso-wave2-2026-10-25/YAHOO/WINDOW-APPROVAL-2026-10-26.md (8bb544f2…)
- **Durable policy in Claude memory:** `forge-no-fantasy-projection-tables` (FORGE never uses draft-dashboard PROJECTIONS_* tables) and `yahoo-window-lessons`.

| Entry | Decision |
|---|---|
| CLAUDE-20261024-042 | TJ asks for a read-only free-RSO analysis |
| CODEX-20261025-086 | Codex keeps only BLSH; Claude owns RSO/FORGE and local commits; every push needs TJ's approval |
| CLAUDE-20261025-093 | Wave 1. **Daily-beta scope = daily-lineup leagues, manual/free plus connected Yahoo, with honest interim-bridge labels.** Weekly leagues, Fantrax and free discovery are out of beta |
| -094 / -095 | Wave-1 commits and C7 R29–R31 outcomes; TJ approves the push |
| -096 | TJ picks the wave-2 lanes; release #384 |
| -097 | Per-account local workspaces; first forecast target = skater SOG; FORGE-QUAL D1/D3/D4/D5 adopted; **no pundit tables in FORGE**; "ownerless" legacy migration; Start Chart Yahoo panel hides on 401/403 |
| -098 | D-1 flag read (serving=false, canary = 1 game); release #385 (master 538100d41); Yahoo window approved for 10-26 |
| -099 | Production stall: TJ chose diagnose-first; RSO-ONLINE rule; Yahoo diet D1–D8 (D1 keeps the full scan; D4 migration not applied) |
| -100 | Fix pundit-audit F1–F3; one bounded read before release |
| -101 | Bounded read found capture off; TJ's proof rules (captured proof OR an exact verified SHA; no blanket trust; no capture activation; no deploy) |

## C. Current plans and status
| Path | mtime | Description | sha256 |
|---|---|---|---|
| T/RSO-CURRENT-STATUS.md | 10-25 18:41 (cut 22:38Z) | Read-only status. **Predates every wave-1/2 commit and releases #384/#385** | 538052f73de200c9f9f54e2919e09c8e5fc85d5c3f192d3f28ea5bfb74fc8354 |
| T/RSO-FORGE-CONSOLIDATED-HANDOFF.md | 10-25 18:47 | Consolidated brief (same cut) | 0e2a8506b5657f9882b5342925d74240d6e2916309f8d6adc256dd5bc081269d |
| T/RSO-FORGE-SOURCE-INVENTORY.csv | 10-25 18:47 | 730-line source inventory | 200b864b3fb44d6a7822fd04afc05575f8c0fa4285c07b1d579f246cbe511a4b |
| RA/rso-wave2-2026-10-25/FORGE-QUAL/QUALIFICATION-PLAN.md · GAPS.md · DECISIONS-FOR-TJ.md · scope.json · EXTERNAL-INPUT-AUDIT.md | 10-25 | Forecast qualification plan; scope.json is still `draft_identity_unpinned` | 2c98640a… / bebb8c04… / a724f433… / 16b7092b… / 626847a6… |
| RA/rso-yahoo-diet-2026-10-26/PLAN.md · FIELD-MAP.md · INVENTORY.md · DECISIONS-FOR-TJ.md | 10-26 | Yahoo read reduction (64 reads per snapshot; ~768/hour today) | a64489f3… / 51f7a0a9… / 2e12c4f7… / 405db1af… |
| RA/projection-table-audit-2026-10-26/REPORT.md · TRACE-NOTES.md · PROD-READ-PLAN.md | 10-26 | Pundit-table audit F1–F3 and read plan. Full inventory at `/Users/tim/Documents/Codex/2026-10-26/task-2/audit/` | 9c8b2a0f… / 75a112a1… / 8c296ece… |
| RA/rso-wave2-2026-10-25/YAHOO/REAL-ACCOUNT-PLAN.md · REAL-ACCOUNT-PLAN-2.md | 10-25 / 10-26 | Real-account window plans (window 2 not approved) | 463c42d2… / 5c75824d… |
| **This folder** | 10-26 | CHECKPOINT.md, FLOW.md, PROVENANCE-SCOPE.md, CODE-PINS.md, BOUNDED-READ-RECEIPT-2026-10-26.md | — |

## D. Latest receipts
- **Wave 1** (RA/rso-wave1-2026-10-25/):
  - BRIDGE/RECEIPT.md (ce1dedb8…; e5975452c)
  - BRIDGE/RECEIPT-2.md (d956376e…; 842ea60f6)
  - FLAKE/RECEIPT.md (eb6c2662…; 649421f09)
  - MANUAL/RECEIPT.md (855e8f45…; 0f8a09fff)
  - MANUAL/DEFECTS.md (f6c06ed8…)
  - MANUAL/RECEIPT-2.md (b4ed6dd5…; e8e8c293c)
  - MANUAL/RECEIPT-3.md (95c3aebe…; 3f127f485)
- **Wave 2** (RA/rso-wave2-2026-10-25/):
  - E2E/RECEIPT.md…RECEIPT-8.md (604cd083…, 927012c2…, c086c42b…, d8132047…, 48c8f403…, 695d9120…, 5213dbb4…, 7f29d28c…), E2E/DEFECTS.md (2e3977e6…), E2E/HANG-DIAGNOSIS.md (0e14c171…)
  - FORGE-QUAL/RECEIPT.md (9eb266d6…), FORGE-QUAL/RECEIPT-2.md (8c513914…), FORGE-QUAL/tooling/README.md (bcecc24c…)
  - YAHOO/RECEIPT.md (763cdee0…), YAHOO/DEFECTS.md (cc2acb62…), YAHOO/RECEIPT-2.md (02e706b2…)
  - **YAHOO/WINDOW-RESULTS-2026-10-26.md** (6aa68e6a…: only R1 ran, ~131 reads, over the 100 ceiling)
- **Other lanes:**
  - RA/rso-yahoo-diet-2026-10-26/RECEIPT-P2.md (465ea0a0…)
  - RA/projection-table-audit-2026-10-26/PROV-GUARD-RECEIPT.md (5b17f205…), PROV-GUARD-RECEIPT-2.md (3b4d4c82…), DISCOVERY-RECEIPT.md (d7843e42…)
  - RA/projection-table-audit-2026-10-26/release-verification/538100d41ee87e721d2764b694f7bac8c2f2bb34.json (the verified-release receipt, committed in cd73cbd69)
  - RA/release-rc-2026-10-25/RC-RECEIPT.md (06436f4d…)
- **C7 independent reviews** (C/handoffs/C7/, with evidence folders r29–r39):

| Review | Verdict |
|---|---|
| R29 | e5975452c accept with limits; 649421f09 and 0f8a09fff accept |
| R30 | e8e8c293c accept with limits |
| R31 | 842ea60f6 accept |
| R32 | 3f127f485 accept |
| R33 | 4f9fb95c3, d9614eeaf, 46bc91caf accept |
| R34 | e8d223cc2 accept with limits |
| R35 | 7007a0527 accept, plus decision D-1; e168c841c accept |
| R36 | 233f59b52 accept |
| R37 | 8b1b17828 accept with limits (F1, closed in 7066306b3) |
| R38 | 5356dc616 accept |
| **R39** | 9eb4f0d36 accept with limits (**G1: team, goalie and game-prediction readers unguarded**); 97315cff3 accept; 3795abb43 accept for flag-off only (**Y1: non-holder tab busy-loop on the upkeep lease, which must be fixed before the flag is turned on**) |

Not yet reviewed by C7: **cd73cbd69** (PROV-GUARD step 2).

## E. Missing or relocated evidence
| Referenced by | Item |
|---|---|
| T/RSO-CURRENT-STATUS.md:137-138; T/…HANDOFF.md:153,174 | The free-RSO analysis and recommendation are only in ARC (RA/free-rso-analysis-2026-10-24/ is empty and untracked) |
| T/RSO-CURRENT-STATUS.md:137 | `rso-browser-fixture-reconciliation-2026-10-23/REPORT.md` and `diaries/2026-10-24-codex-forge-rso-release-readiness.md`: ARC only |
| T/…HANDOFF.md:139–308+ | 378 cited paths don't resolve in R, but 375 resolve in ARC (archived per R/tasks/ARCHIVE-INDEX.md) |
| T/…HANDOFF.md:52 | `deep-research-report.md`: in /Users/tim/Downloads and /private/tmp only |
| R/tasks/rso-goal-handoff.md:15–165 | About 60 evidence logs under /tmp and /var/folders **no longer exist** |
| projection-table-audit REPORT.md:34-37 | Inventory TSV/JSONL, import graph and offline checks are at /Users/tim/Documents/Codex/2026-10-26/task-2/audit/ only |
| PROV-GUARD receipts | head-baseline.log and head2-baseline.log (scratchpad) not retained |
| FORGE-QUAL/scope.json:3 | Identity unpinned (pin step not done) |
| YAHOO/WINDOW-RESULTS | R2–R4 and the weekly counter never verified; window 2 not approved |
