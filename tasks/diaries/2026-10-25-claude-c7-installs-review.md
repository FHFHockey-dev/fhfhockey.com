# C7 diary — 2026-10-25 in-tree installs review (ticket 17)

- Scope: read-only independent review of today's installs: C1 (9dbc55afb evidenceBundle), C3a/C3b v2 (uncommitted), SS1 tickets 17/18 + low-year fix (pending RECEIPT-19). No edits, Git, live reads or server.
- Where: receipts handoffs/C7/RECEIPT-C1-INSTALL.md, RECEIPT-C3-INSTALL.md; evidence handoffs/C7/r17-evidence/{c1-install,c3-install}/.
- State: C1 accepted with limits (89/89; F1/F2 confirmed: validator trusts self-labels in `retained`, no importer yet). C3 accepted with limits (104/104; 400-case selector property 0 violations; L1 TSC_RESULT placeholder, L2 test file outside lease).
- Next: SS1 review when handoffs/SS1/RECEIPT-19.md appears (recent-form grain caps/isolation/logging, meta-caption removals, streak rules vs CLAUDE-065 + TJ pop-ups, year 0000–0999).
- Gotchas: the workspace cleanup moved earlier C7 receipts and the luna network-guard.cjs to /Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/; I use a scratch copy of the 8-line guard. The previous C7 diary also moved there.
- SS1-19 (item 2) done: RECEIPT-SS1-19.md accepted with limits. 15/15 hashes; auth/access files clean vs HEAD 80425a4a9; 192/192 (owner 175 + mine); streak oracle 20,000 cases 0 mismatches (run1 kept: my FP tolerance error); year 0000–0999 closed. Limits: prod root cause unconfirmed (logs after deploy), dormant hits/blocks, avg_season assumption; F1 stale tier alt text (pre-existing).
- Ticket 17 complete (C1, C3, SS1-19). Heavy lock was held by c3-cron-repro (C3d typecheck) during my light Vitest run; not touched.

## Ticket 18 — GS, HIR, WiGO, C3d, TG S06 (2026-10-25)
- Receipts: handoffs/C7/RECEIPT-{GS,HIR,WIGO,C3D,TG-S06}.md; evidence handoffs/C7/r18-evidence/{gs,hir,wigo,c3d,tg}/.
- GS accepted (48/48; 1,600-window property 0 violations). HIR accepted with limits (34/34; no parent render test; filter by player not reason). WiGO accepted with limits (32/32 paths, 168/168, e2e 7/7 per owner; W1 pp_toi vs pp_toi_per_game; receipt hash/test-count text). C3d accepted (302/302; diagnostic only). TG S06 accepted with limits (147/147; scoped tsc 0; results not run-bound, listing owner-scoping trusted).
- Gotchas: my TG glob missed .tsx (run1 kept). Heavy lock taken/released once for TG scoped tsc.

## Ticket 19 — PC trusted retained-evidence loader (2026-10-25)
- Receipt handoffs/C7/RECEIPT-PC-LOADER.md: accepted with limits. 4 files pinned; 36 PC lease pins 0 drift; 98/98 (owner 94 + K1–K4, run1 kept: my malformed dummy input); whole-project tsc exit 0 under heavy lock (17:05–17:06Z, released).
- Limits: raw validateEvidenceBundle still exported (gate first wiring); production root undecided. Obs: untrusted path throws on malformed input before reporting untrusted-evidence.

## Ticket 20 — commits 63654c308 (TG contract kit) and 48809914a (HIR policy)
- Receipt handoffs/C7/RECEIPT-R20.md. TG accept (154 TG tests; nit: vitest import in lib non-test module). HIR accept with limits: 5 new tests fail on old code (old 11 pass); H1 greedy spot-first assignment can understate "Only k can be activated".
- Gotcha (again): zsh for-loop doesn't word-split; old-code mirror needed sibling lib dirs (run1 kept).

## Ticket 21 — commits 5660dcdd0 (GS), ef524ca2a (SS1), 1b5c36024 (C3)
- Receipt handoffs/C7/RECEIPT-R21.md: all three accept. HEAD 62/62; each new test fails on its parent mirror while all older tests pass (C3 mirror uses lib symlink so relative vi.mock paths match).
- Whole-project tsc NOT run: heavy lock held by Claude Q2 v24 (v24-hud-playmode) from 18:30Z; not taken.

## Ticket 22 — pre-push review of 7 commits (1d91cbdd8 … 86583ba6b)
- Receipt handoffs/C7/RECEIPT-R22.md. All accept; lint rule accept with limits (dynamic import/require not caught; flat-config option override risk). Parent mirrors (symlinked web + reverted dirs, aliases → mirror): every new test fails on its parent.
- Gotchas: ESLint 9 removed `-f compact`; bad --rule override also silently zeroed probes (runs kept). tsc left to orchestrator per ticket.

## Ticket 23 — PC WIRING-1 pre-apply review
- Receipt handoffs/C7/RECEIPT-R23.md: accept with limits. Snapshot /private/tmp/c7-r23/web (git archive 86583ba6b); dry-run + apply clean, hashes match; 101/101 (PC 98 + K1–K3); eslint clean.
- L1 fix-before-apply: gSSP props (incl. free-text reasons) reach every visitor; K1 shows receipt ids in reasons. L2 guard misses dynamic import()/require() of evidenceLoader. L3 client bundle unverified (no build). L4 page test outside lease.

## Ticket 24 — 5 local commits since push (418224990, dffd3b2d0, 9501fda81, 0f457e0da, cc4886a81)
- Receipt handoffs/C7/RECEIPT-R24.md. All accept; SS1 targets accept with limits (S1 three-role legend overflow not tested; S2 <50% only enforced at source). HIR H4: nextWindow keyed on lockedDates, mislabels when no games remain in locked window.
- Mirrors on a clean git-archive HEAD snapshot /private/tmp/c7-r24 (working tree has SS1 WIP). First run: missing node_modules beside configs (my error).

## Ticket 25 — bd71843dc (PC wiring applied) and 97ab3f03c (WiGO A-03 coverage)
- Receipt handoffs/C7/RECEIPT-R25.md: both accept. R23 L1/L2/L4 fixed (props states + kebab codes only; guard regex covers import()/require()); L3 build check still open. WiGO 90% edges exact (M 10..820, 899/1000, 900/1000, M=0); missing rows never zero.
- My leak probe's "receipt" term matched the enum code receipt-not-retained (reviewer wording error); real markers absent.

## Ticket 26 — 5ba2117d5 (SS1-23 closes R24 S1/S2)
- Receipt handoffs/C7/RECEIPT-R26.md: accept. HEAD 193/193; parent mirror 191/193 (2 new tests fail). Ownership<50 filtered in all three pick paths; legend layout-width assertion + three-tilt fixture; viewed widest-legend PNG. e2e not run by me.

## Ticket 27 — 80fa80b5c (SS1-24 chunked recent reads)
- Receipt handoffs/C7/RECEIPT-R27.md: accept. HEAD 203/203 (199 + my 4); parent 10 fail. 186-pool control: 1,190/1,190 unique rows, chunks disjoint ≤20, concurrency ≤2; failed chunk = its 20 ids only; exact-multiple chunk = 1 statement. Worst case 11 statements (pool 186), 6 for 84.

## Ticket 28 — 7d2df2ba9, 76748c62f, ca7818dd2, f633654d5
- Receipt handoffs/C7/RECEIPT-R28.md: C3-5, WiGO-6, TG-4 accept; PC-4 accept with limits (P1 issueCodes still in page props; P2 "Fabricated preview" copy hard-coded for any incomplete). C3-5 mutation-checked (remove in-loop push → new test fails). TG manifest control: tampered/extra/other-run → invalid_projection.

## Ticket 29 — RSO wave-1 (e5975452c, 649421f09, 0f8a09fff)
- Receipt handoffs/C7/RECEIPT-R29.md: bridge accept with limits; flake fix and acceptance suite accept. Bridge 58/58 vs parent 42/58.
- B1 medium: start-share renormalisation over known goalies makes the incumbent 1.0 when a teammate is unknown (now more frequent with team binding). B2: no-team-id goalies uncounted. B3: Oct 11–24 runs had null PP goal/assist heads with PP TOI possibly >6 s (120 s default) → forecasts lost if read; current writer always numeric (subagent research, spot-checked).

## Ticket 30 — e8e8c293c (RSO-RECON D1/D2 fixes)
- Receipt handoffs/C7/RECEIPT-R30.md: accept with limits. Commit 181/181; parent 173/178 (5 new fail). No false positives (X1); misses: R1 action-vs-effective order (next-day add dropping IR holder), R2 waiver without clearance time. D2 null renders "—".

## Ticket 31 — 842ea60f6 (bridge: never scale past an unknown teammate)
- Receipt handoffs/C7/RECEIPT-R31.md: accept (closes R29 B1/B2). Bridge 65/65 vs parent 60/65; Q1 0.7/null, Q2 teamless keeps teammate 0.7 + counted, Q3 complete renormalises 0.5/0.5, Q4 all finite in [0,1]. T1 residual: teamless goalie with no rows can't open his team.

## Ticket 32 — 3f127f485 (refresh never silent on timeline-illegal plans)
- Receipt handoffs/C7/RECEIPT-R32.md: accept (closes R30 R1/R2). 35/35 vs parent 32/35. Converse control on the 1,122-case matrix: 572 legal → 0 false positives; 550 illegal → all flagged. UI blocks adds without verified timing, so no nag.

## Ticket 33 — 4f9fb95c3 / d9614eeaf / 46bc91caf
- Receipt handoffs/C7/RECEIPT-R33.md: all accept. Commit 608/608; Y1 parent 110/112; provenance parent 376/382 (+planning.test load fail); consumer-only parent 113/114. Yahoo controls 40/40 (other-day / week / traded-goalie marks withheld; reject codes pinned). Freshness mutation: suite catches only when both redundant guards removed.
- Snapshots /private/tmp/c7-r33 (at, p1, p2, p3). Evidence r33-evidence/.

## Ticket 34 — e8d223cc2 (per-account local workspace, D1)
- Receipt handoffs/C7/RECEIPT-R34.md: accept with limits. Commit 239/239; parent 111/239 (key-driven + D1/new workspace tests). Controls 4/4. E2E listed only (10), not run.
- P1 low-medium: legacy manual entries (incl. "Continue manually" Yahoo forks) + :undo stay in anonymous slot after migration. P2–P5 info.

## Ticket 35 — 7007a0527 (FORGE no fantasy tables) / e168c841c (RSO clock pins)
- Receipt handoffs/C7/RECEIPT-R35.md: both accepted. 290/290 vs parent 270/290; controls 9/9 (run1 float expectations, reviewer error); closure probe clean (67 files); RSO 209/209 in America/New_York.
- D-1 decision for TJ: first release where live revisions carry the exclusion claim → consumer admission (Start Chart behind serving/canary flags) opens. F3: player-forecasts/baselinePolicy still uses fantasy config (not FORGE).

## Ticket 36 — 233f59b52 (ownerless anonymous slot; legacy dropped)
- Receipt handoffs/C7/RECEIPT-R36.md: accept; closes R34 P1/P2, P3 fail-closed. 240/240 vs parent workspace 24/27. Controls 5/5. Spec edits key-only (normalised diff empty). U1 first-upgrade anon race (benign).

## Ticket 37 — 8b1b17828 (Start Chart denied refresh clears lineup)
- Receipt handoffs/C7/RECEIPT-R37.md: accept with limits. 10/10; parent 7/10; mutA 7/10; mutB 9/10. F1: denied set after response.json(), so non-JSON 401/403 keeps the lineup (controls fail). Late-abort control was my harness error (button disabled while busy); assessed by code.

## Ticket 38 — 5356dc616 (navigator.onLine; never stick on Checking access)
- Receipt handoffs/C7/RECEIPT-R38.md: accept. 212/212; parent 207/212. Provider first-load count = 1 in all modes (incl. StrictMode, onLine false) — doubled reads not from this path (D1). S1 low: networkSuspended-from-mount leaves checkingAccess true (status-rail notice, roster-less held backup).
- Probe counts read via deliberate failing assertions (console output is not captured by the json reporter).

## Ticket 39 — 9eb4f0d36 PROV-GUARD / 97315cff3 discovery / 3795abb43 Yahoo diet
- Receipt handoffs/C7/RECEIPT-R39.md. Commit 709/710 (1 pre-existing skip); parents fail the new tests (353/390, 7/9, 243/245 + 2 load fails). Flag-off Yahoo suites pass (writerPermissions needed supabase/ in snapshot — reviewer env error, run1 kept).
- PROV-GUARD accept with limits: G1 medium — /projections/teams, /projections/goalies, /forge/goalies, game-predictions forge_team_projections still unguarded (team rows include blended skater lines). G2 low unlabelled older-run substitution.
- Discovery accept. Yahoo diet accept for flag-off; Y1 medium (flag-on) non-holder lease busy loop (delay 0) — verified in code. Research subagent used for 3795abb43 (read-only); spot-checked.

## R40 — cd73cbd69 (verified-release SHA fallback)
- Receipt handoffs/C7/RECEIPT-R40.md: accept with limits. Fallback correct/fail-closed; receipt sha256 4382282d… matches; closure hash reproduced from an independent 538100d41 archive (192 modules, 0 findings).
- V1: verifiedForgeReleases.test.ts reads the untracked bd337d97a receipt → fails on clean checkout. V2: git_sha is env-stamped (GIT_SHA honoured; local runner doesn't pin it) — slice should bind to a non-claimable identity. V3: basis/releaseSha not surfaced.
- Safety check blocked an `rm -rf` in my setup script; used a fresh dir (/private/tmp/c7-r40b) instead. /private/tmp/c7-r40 left partial (not created? check) — no removal attempted again.
- Correction: /private/tmp/c7-r40 was never created (the blocked command did not run); nothing to clean up.

## R41 — 978134e22 (F2) / 00d375839 (F6) / 5a19f1def (F1)
- Receipt handoffs/C7/RECEIPT-R41.md: accept with limits. 587/587 at commit; parents fail new tests (197/202, 224/225, 78/97). Controls 15/15.
- F1 closure 0e987626… reproduces at commit (193 modules, 0 findings); 538100d41 → 4bf0fce7… with new walker; receipt hashes match; R40 V1 closed. Admission modules outside closure.
- Open V2: unbuilt code stamps runtime env → env label + full GIT_SHA admits (control). L2: initial refresh(true) bypasses lease. L3: build hash needs devDeps (fails closed silently).

## R42 — 595ab13d9 (V2 build-only stamp, V3 runProof, F4 teams/goalies/predictions)
- Receipt handoffs/C7/RECEIPT-R42.md: accept with limits. 368/369 (+1 pre-existing skip), workflow 22/22 (needed supabase/ — run1 env error kept). Parent 275/368, workflow 19/22. Controls 8/8.
- Closure 4c06fd9e reproduces from 595ab13d9 (193, 0 findings); receipt hashes match. A1: 6613c9ef allowlisted from an uncommitted tree — not reproducible, de-list. A2: proof-read failure → contradicted treated as unproven (fail-open, flag off). A3 global-name preload, A4 pre-V2 stamp shape accepted.
- No local next build run (AGENTS: only when necessary); DefinePlugin scope verified by code.

## R43 — 074694095 (reserve pass) / 6fb1812c1 (R42 fixes)
- Receipt handoffs/C7/RECEIPT-R43.md: accept with limits. HEAD 242/243 (1 = my archive lacks .git for a git-grep test; manual git grep confirms). Parents fail new tests (80/94, 133/143). Flag-off: parent bridge tests on new code 71/71.
- X1: closure at HEAD c1f0129a… (194, 0 findings) unlisted → needs a commit-backed receipt before release. M1: migration lacks revoke → anon/auth keep default INSERT/UPDATE/DELETE/TRUNCATE.
- R42 A1/A2/A4/A7 closed.

## R44 (pre-release) — b9206fe31 resumed-run admission; RC efb36e908; ad079935e
- Receipt handoffs/C7/RECEIPT-R44.md: b9206fe31 ACCEPT (374/374; parent 66/68; controls 18/18). Closure c1f0129a reproduces at b9206fe31 and RC (194, 0 findings); receipt 0dc67639 matches → R43 X1 closed. R43 M1 closed (a02159b64).
- RC web tree == b9206fe31 web tree (runtime as reviewed), but RC lacks release-verification receipts (P1: verifiedForgeReleases 4/8 on RC) and the 2 migration files + authority JSON (P2: supportedBaselineMigration expects 101, RC has 99). Recommend re-cut; not runtime/safety.
- N1: classification verifiedProducer still single-invocation only (capture off → no exposure).

## R45 — e2038b17a (N2/N4, run proofs side channel) / 6c36c8e8c (FR9/FR10 packet)
- Receipt handoffs/C7/RECEIPT-R45.md: accept with limits. 223/223; parent 196/210; flag-off parent bridge tests 74/77 (only runProofs: [] deep-equals). Defects D1/D2 reproduced by removing .fails (11/13: SV% known; projectedValue -4).
- Closure dd6ec27d (194, 0 findings) reproduces, NOT allowlisted (G1 release gate). I1: RSO client modules (currentPlanningRead, bridgeForecastWire…) inside producer closure → churn.
- Reviewer error: script path bug after closure scans; resumed with r45-run2.sh (no rm).

## R46 — 08e583311 week-ahead / 5aa3f8711 label+FR18 / 4ed3a6220 FR9-D1/D2 / 5aa9ba5e0 Yahoo waivers
- Receipt handoffs/C7/RECEIPT-R46.md: accept with limits. HEAD 709/709; parents fail new tests (143/157, 218/220, 200/209, 103/123). FR18 e2e listed (5) not run.
- G1: closure 87edd78f (194, 0 findings) at 08e583311 and HEAD — not allowlisted (must list before release). C1: category summary Metric (:1120) now always "—" with stale copy (audit missed). U1: manual opponent remaining {} now → all categories unknown until zeros entered; Yahoo unaffected (remaining null).
- W1: unset env stores cursor 2 vs 1 after a failed next-day (behaviour equivalent). W2: stand-ins prefer furthest-dated run.

## R47 (pre-release) — 605ecbb85 + RC refs/rc/2026-10-26-web-7 (da53bf311)
- Receipt handoffs/C7/RECEIPT-R47.md: ACCEPT, nothing must change. 605ecbb85 closes R46 C1/U1 (parent 221/225). RC = exactly the 42 files of the 9 commits, blob-identical to 605ecbb85; no import of the 47 drift files; RC closure 87edd78f (194, 0 findings) listed with receipt 7b501589 (G1 closed); R44 P1/P2 closed; RC suites 940/940.
- Not run: tsc/lint on RC, FR18 Playwright, build.

## R48 (pre-release) — 02153acba preflight anchor / 2d1798003 runner Copy all
- Receipt handoffs/C7/RECEIPT-R48.md: accept with limits. 107/107; preflight parent 2/10 (stale-as-of-today cases pass on both); runner parent 6/8.
- P1 release gate: closure 5644e3fd (194, 0 findings) not allowlisted. A1: UTC anchor one day stricter for ≥2-days-ahead dates in ET-evening manual runs (cron 10:xx UTC unaffected).

## R49 (urgent pre-release) — 107673704 D6 ungated / eff1b377a no-FORGE-line 0
- Receipt handoffs/C7/RECEIPT-R49.md: accept with limits. 429/429; D6 parent 158/164; no-line parent 88/100; parent bridge tests on new code 80/89 (all intended).
- P1 release gate: closure bf23edfe (194, 0 findings) not allowlisted (5644e3fd now listed → R48 P1 closed). L1: maximal week/>7 days withholds all 0s → P1 blanking returns. L2: stale/traded now 0. L3: ~5.7 MB snapshot vs sessionStorage journal. L4: team_line label flag-on only.

## R50 (pre-release) — 5e8043d6d RSO UI batch 1
- Receipt handoffs/C7/RECEIPT-R50.md: accept with limits, nothing must change. 315/315; parent with commit tests 290/315 (all intended); C7 controls C1–C5 5/5; mutation (drop fallback key check) killed only by C5.
- Closure bf23edfe unchanged and now allowlisted → R49 P1 closed. L1: frozen/throttled tab still blanks (both timers due together, C1). L2: lapse swap unlabelled, plan may change. T1: no author test for cross-account stand-in.
