# RSO/FORGE checkpoint for the independent Astra audit, 2026-10-26

Author: Claude orchestrator, session `0b03c1ab`, at TJ's direct instruction. **Implementation is paused.** This prompt authorizes no takeover edits, production actions, pushes or deploys.

Companion files in this folder:
- `FLOW.md`: the end-to-end implementation map.
- `EVIDENCE-INDEX.md`: plans, decisions, receipts and gaps.
- `PROVENANCE-SCOPE.md`: pending guard scope; not implemented.
- `CODE-PINS.md`: HEAD hashes of 196 flow files.
- `BOUNDED-READ-RECEIPT-2026-10-26.md`: the production read.

## 1. Where things are
- **Checkout:** `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch` (the sole editing checkout per AGENTS.md).
- **HEAD:** `cd73cbd69…`.

| Ref | SHA | Meaning |
|---|---|---|
| origin/master | `538100d41ee87e721d2764b694f7bac8c2f2bb34` | **Production** (PR #385, deployed 2026-10-26 02:16Z, dpl_BswfQNB4… READY) |
| origin/octoberBranch | `28335fd466ef…` | Ours-merge sync of 538100d41 (tree unchanged) |
| local octoberBranch | `cd73cbd69…` | **5 local commits, not pushed or released** (below) |
| refs/rc/2026-10-25-web, -2, -3, 2026-10-26-web-4 | 8384a8563 / 7cae570d5 / 259f304dc / de49bd503 | Release candidates for #382/#383/#384/#385 |

**Local-only commits since production** (all orchestrator-verified; C7 status shown):

| Commit | What | C7 |
|---|---|---|
| 5356dc616 | RSO no longer blocks loads on `navigator.onLine`; never sticks on "Checking access" | R38 accept |
| 9eb4f0d36 | PROV-GUARD: FORGE skater consumers refuse output without exclusion proof | R39 accept with limits (G1–G3) |
| 97315cff3 | Draft Rankings discovery stops reading the 9 pundit tables (F3) | R39 accept |
| 3795abb43 | Yahoo diet behind `RSO_YAHOO_DIET` (off); D4 migration file **not applied** | R39 accept for flag-off only (Y1) |
| cd73cbd69 | PROV-GUARD step 2: exact verified-release fallback (538100d41 only) | **not yet reviewed** |

**Uncommitted state:**
- **No product code is dirty from RSO/FORGE lanes.** Only `web/next-env.d.ts` (generated; never committed) is modified by us.
  - Outside our lanes, `web/public/teamLogos/OTT.png` was modified at 10:57 and an untracked `web/public/teamLogos/OTT-2.png` appeared. These are not Claude lane edits (likely TJ's manual logo work). They are left untouched and must not be committed or reverted by the audit.
- About 796 task-artifact and diary paths are untracked or modified: lane receipts, diaries, this folder, and the audit copy.
- One untracked verifier receipt, `projection-table-audit-2026-10-26/release-verification/bd337d97aefd…json`, is the step-2 lane's verification run against pre-removal release bd337d97a. It's expected to fail, and that release is **not** on the allowlist.
- Nothing is staged. No processes of ours are running: the :3000 dev server is TJ's, and the Blender app belongs to the Quest lanes.
- No heavy lock is held, and no isolated server is running.

**File ownership:**
- Leases: `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-LEASES.json`. Active lanes RSO-YAHOO-DIET-P2, PROV-GUARD and DISCOVERY-NOPUNDIT are all **paused**, with nothing dirty.
- Codex holds only BLSH (CODEX-20261025-086).

## 2. Deployed vs local vs verified live
| Capability | Local code | Production (538100d41) | Verified live |
|---|---|---|---|
| Planner (legal lineups, timeline, reconciliation, healthy reserves, per-account workspace, Start Chart 401/403 hide) | yes | yes | page and data endpoints return 200; RSO workspace load observed 10-26 |
| No pundit tables in the FORGE writer | yes | yes (7007a0527) | 2 runs since the deploy on 538100d41 (bounded read) |
| Proof guard on consumers | yes (9eb4f0d36 + cd73cbd69) | **no** | capture is off in production (no snapshots), so the guard is held |
| Offline-flag fix | yes | **no**: production still stalls when Chrome misreports offline | stall observed 10-26 |
| Yahoo diet | yes, flag off | no | — (the D7 compare window is not run) |
| Native forecasts | infrastructure only | `native_not_activated` (legacy bridge serves) | yes (source kind seen in smoke) |
| Yahoo real-account | — | — | R1 only (Y1 copy, complete discovery, unknown timing). R2–R4 and the weekly counter are **unverified**. The ~131-read overrun was recorded |

## 3. Completed (10-25 → 10-26)
- **Wave 1:**
  - bridge unknown-vs-zero, plus goalie shares bound to team and season, with no renormalization past an unknown teammate;
  - full-suite test flake fixed;
  - offline manual acceptance suite (29), with D1/D2 and R1/R2 reconciliation fixes and the "never silent" invariant.
- **Wave 2:**
  - offline Yahoo acceptance (34) and the Y1 fix;
  - per-account local workspaces, ownerless legacy migration, and context-switch isolation;
  - clock-pinned tests;
  - Start Chart Yahoo panel hides on 401/403 (non-JSON too);
  - FORGE provenance hashes and review-evidence fields;
  - fantasy prior removed from FORGE (TJ policy);
  - draft discovery no longer reads pundit tables;
  - consumer proof guard plus the verified-SHA fallback.
- **Releases:** #382, #383, #384 and #385, each smoke-tested with no extra builds.

## 4. Work in progress, blockers and pending decisions
- **Paused before the audit:**
  - guard expansion to teams, goalies and game predictions (PROVENANCE-SCOPE.md);
  - the Y1 upkeep-lease busy loop fix (C7 R39), needed before `RSO_YAHOO_DIET` goes on;
  - C7 review of cd73cbd69.
- **Blockers:**
  1. Production capture is off. Either the verified-SHA fallback ships, or capture is enabled (TJ: no capture activation now).
  2. The cross-version resume attribution for the fallback is only partly closed (`invocations === "1"`).
  3. The native forecast target (skater SOG, h1) can't qualify until runs carry proof and identity. `scope.json` is still `draft_identity_unpinned`.
  4. The Yahoo real-account checks R2–R4 need another approved window (REAL-ACCOUNT-PLAN-2.md, about 64 reads per snapshot, one tab).
- **Pending decisions for TJ (beyond Astra's scope):**
  - guard scope (teams, goalies, predictions);
  - capture activation;
  - the D4 migration apply;
  - turning `RSO_YAHOO_DIET` on after the D7 window;
  - window-2 approval;
  - whether to release the five local commits.

## 5. Failed approaches and lessons
- **Real-account window 1:** two RSO tabs auto-loaded, giving about 131 Yahoo reads against an approved 100. The cause was the extension's tab group plus each tab's auto-snapshot on open. Lesson: one tab only; budget about 64 reads per snapshot.
- **Diagnosis:** "release 4 broke RSO" was the first hypothesis. Disproved: it was Chrome misreporting `navigator.onLine`, and the stall predates release 4.
- **Rejected guard key:** a guard keyed to `forge_runs.metrics.input_provenance` was rejected because it's never claimed and would refuse clean runs. The proof lives on captured snapshots and revisions.
- **Discarded design:** "538100d41 onward" blanket trust. TJ required exact, individually verified SHAs.
- **Reverted edit:** an interim orchestrator edit that cleared the Start Chart lineup on any failure was reverted, because it contradicted a deliberate unit test. TJ then chose hide-on-401/403-only.

## 6. Unresolved hypotheses
- Did any pre-removal blended skater or team values get served or persisted downstream (game-prediction features, served-forecast ledger history)? This is unknown: there have been no production reads beyond the two queries.
- Is goalie output clean? By producer path, likely yes (the goalie bootstrap was always called with `false`), but goalie team context derives from skater lines. Unproven.
- Will the Yahoo diet's process-local caches meaningfully cut reads on Vercel's cold instances? To be measured in the D7 window.

## 7. My current direction and proposed path to a fully working RSO
Astra owns reconciliation against the vision; this is my view for challenge. The central milestone is usable projections for roster players and eligible pickups, a legal drop → add comparison showing actual startable benefit, and continuity through refresh and reopen.
1. **Make projections trustworthy and present.** Ship the proof guard with an attribution-safe fallback (or capture), so RSO and Start Chart serve only proven, pundit-free FORGE values. Keep the interim bridge labelled until native SOG qualifies (FORGE-QUAL protocol: 14 slates, ≥500 skater-games, two looks).
2. **Close live acceptance:**
   - release the offline-flag fix;
   - run Yahoo window 2 (R2–R4, the weekly counter, goalie marks, refresh continuity) with one tab and the diet on behind its flag, after the Y1 lease fix;
   - turn the diet on only after D7 agreement.
3. **Prove the core comparison end to end on a real league:**
   - at least one legal drop → add with nonzero startable gain against the no-move baseline;
   - the dropped player's lost contribution shown;
   - refresh → Undo → reopen preserved.

   This is the beta acceptance gate (daily manual plus Yahoo, per CLAUDE-20261025-093).
4. **Then the remaining product plan:** weekly-league rules, Fantrax parity, free discovery, durable Testing Grounds, and native activation beyond SOG. None of these should be dropped.

## 8. Tests and commands run (exact results)
- **Focused suites, latest:**
  - guard 1830/1830 (cd73cbd69);
  - three-lane run 3377/3377 in UTC and America/New_York (9eb4f0d36, 97315cff3, 3795abb43);
  - RSO 1207/1207 in both time zones (5356dc616);
  - whole-project `tsc --noEmit` exit 0 under the heavy lock;
  - eslint 0 errors on changed files.
- **Full gate (clean `git archive` export):** last run on 7066306b3 before release 4. tsc 0, eslint 0 errors (69 pre-existing warnings), CSS-module pure pass. Vitest ~13.5k passing; the export-only failures (no `.git` or repo root) all pass in the canonical checkout.
- **Not yet gated:** the 5 local commits, as a full-gate run.
- **E2E (worker-run, isolated :3160, network-blocked):** rso-continuity 10/10 plus an offline case, and roster-schedule-optimizer + start-chart 55/55 in two time zones.
- **Not run:** a full-suite gate on cd73cbd69, and any browser run against production beyond the 10-26 window.
- **Fixture limits:** all acceptance suites use synthetic fixtures and mocks. Real Yahoo payload shapes are confirmed only for R1 fields.
- **Production actions this period:**
  - releases #382–#385 with smokes;
  - three flag reads (STARTER_BOARD_SERVING_ENABLED=false, START_CHART_GAME_REVISIONS unset, canary 1 game);
  - one Start Chart GET (legacy source);
  - two bounded SQL reads;
  - the R1 Yahoo window (~131 reads).

## 9. Safe resume instructions
1. `git -C /Users/tim/Code/fhfhockey.com status --short`: product code should be clean apart from `web/next-env.d.ts`. Confirm HEAD is `cd73cbd69` or later and that origin/octoberBranch is `28335fd46`.
2. Read `CLAUDE-LEASES.json` and the mailbox tail (CLAUDE-TO-CODEX up to entry 101 and later) before any write. Re-pin leases.
3. Pending Claude-side items, each only after TJ resumes:
   - C7 review of cd73cbd69;
   - Y1 lease fix;
   - guard scope per Astra/TJ;
   - a full gate on HEAD;
   - push and release decisions by pop-up.
4. Never push without TJ's direct approval (memory `push-octoberbranch-together`). Never apply the D4 migration or enable capture without explicit approval.
