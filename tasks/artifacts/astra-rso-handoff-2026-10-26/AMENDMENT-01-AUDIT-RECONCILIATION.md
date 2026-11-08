# Amendment 01: reconciliation with the Astra audit (2026-10-26)

The original handoff files in this folder are unchanged. The audit is preserved at `tasks/artifacts/astra-audit-2026-10-26/`: copies of RSO-Post-Astra-Audit-REPORT.md and TRACEABILITY.md, plus the audit's evidence files. The originals stay at /Users/tim/Downloads and /Users/tim/Documents/Codex/2026-10-26/task-3/audit/.

## Version check
- **Audited HEAD:** `cd73cbd695347a04c0d217ca7535a87ca609f4fb`. Current HEAD is the same; there are no commits since.
- **Uncommitted changes since the audit:** all outside RSO/FORGE.
  - Social Share / Tuesday Trends files (`web/lib/socialShare/*`, `components/SocialShare/*`, `e2e/social-share.spec.ts`; another lane's work).
  - Codex Player Cards: `cardEvidenceVerdict.ts` and its test (CODEX-20261026-002/003).
  - The OTT team logo.

  Don't touch any of them. RSO/FORGE source matches the audited cut.
- **Pin correction accepted:** CODE-PINS.md has 195 rows (not 196) and reflects the 3795abb43 cut. The two later changes are cd73cbd69's, as the audit states.

## Findings classification
| Finding | Class | Evidence / note |
|---|---|---|
| F1: exact-SHA fallback can't admit its own next deployment | **Confirmed** | `verifiedForgeReleases.ts:20` (one SHA); `run-lifecycle-queries.ts:250` stamps the executing SHA; `externalInputProof.ts:64`. Adding HEAD to source creates a new SHA (self-reference). |
| F2: SOG totals/comparison can't reach a plan comparison without assignment permission | **Confirmed** | `rosterScheduleOptimizer/planning.ts:274` (`playValue`) and around :926 (`assignmentValue` gates `inputEligible`); the audit's reproduction.test.ts. |
| F3: native review binding changes on every revision | **Confirmed** | `rosterScheduleData/planning.ts:227` (`participationLineage: ${revisionId}:participation`); `rsoUsePolicy.ts:74` requires exact equality. |
| F4: team, goalie and prediction readers lack the fence | **Confirmed** (source level; contamination unknown) | `apiHelpers.ts:37` (old helper still exported); `projections/teams.ts`, `projections/goalies.ts`, `forge/goalies.ts`, `game-predictions/featureBuilder.ts:2912` and persisted reuse. `forge/goalies.ts:441` turns null into 0. |
| F5: local fixes ahead of production acceptance | **Confirmed** | 5356dc616 is local only; only Yahoo R1 ran. |
| F6: Yahoo lease busy loop (flag on) | **Confirmed** | `RosterScheduleOptimizer.tsx:582–584`: the non-holder `scheduleNext()` with a past `nextAutoAt` gives a 0 ms delay. Cache keys omit account identity (`rosterPlanning.ts:317`). |
| Retain list (§2) | **Agreed** | No rebuild of the optimizer, workspace, timeline, marginal comparison, proof semantics or bridge fixes. |
| Traceability FR1–FR18 | **Accepted as the acceptance ledger** | Every retained gate stays open until demonstrated or amended by TJ. |

No finding is disputed. One clarification on F4/goalies: I previously wrote that the goalie stage "never read pundit tables" (PROVENANCE-SCOPE.md). The audit is right that this omits opponent team shots derived from skater lines (`goalie-stage.ts:189`). The goalie classification now follows the actual dependency path.

## What changes in my approach
1. **Release admission (F1).** Stop trying to enumerate SHAs. Bind admission to a **verified producer-closure identity** computed from the exact artifact:
   - At build time, a script computes the sha256 of the FORGE producer import closure, using the same function as `scripts/verify-forge-release-sha.ts`, and emits it into a generated module.
   - The writer stamps it, with the git SHA, on each run.
   - Consumers admit an uncaptured run only if its stamped closure hash is in an allowlist of individually verified closure hashes, each with a stored receipt. The run must also be succeeded and single-invocation.
   - A later commit that doesn't change the closure produces the identical hash (genuinely the same producer). Any closure change produces a new, unverified hash, and is denied until verified.
   - Neither side is ever relabelled. The legacy exact-SHA entry (538100d41) stays only for runs that predate stamping.
   - Contradictory or failed proof still denies regardless.
2. **The manual end-to-end flow on the approved interim bridge (link 1–8 acceptance)** proceeds now, independent of native qualification and production gates.
3. **Native contracts (F2/F3)** are fixed as local contract work, keeping assignment and tie-break denied for SOG.
4. **F4** follows F1 in the same lane (one owner for the shared proof helper), classifying each surface by its real producer dependency.
5. **The F6 lease fix** comes before any diet-on window.

## Revised execution order (no scope reduction)
| # | Slice | Lane | Gate after |
|---|---|---|---|
| 1 | F1 producer-closure identity: build stamp, writer stamp, consumer admission, verifier, tests (next-release admitted, unlisted closure denied, contradictory capture denied despite allowlist, mixed resume denied, query failure denied) | prov-guard | C7 review |
| 2 | Manual end-to-end acceptance packet (FR4/FR5/FR8/FR12) plus the F6 lease fix | rso-flake | C7 review |
| 3 | F2: separate legal selection from approved totals/comparison | rso-manual | C7 review |
| 4 | F3: stable method binding plus per-issuance lineage | rso-manual (after 3; same files) | C7 review |
| 5 | F4: team, goalie and prediction admission, including persisted reuse and the goalies null→0 fix | prov-guard (after 1) | C7 review |
| 6 | Integrated gate on HEAD, then a release-candidate proposal to TJ (needs push/deploy approval) | orchestrator | TJ pop-up |
| 7 | Real-account windows (Yahoo window 2 for R2–R4 with the diet after F6 and D7) and prospective SOG qualification | orchestrator | separate TJ approvals |

Retained later gates, unchanged: full scoring/category coverage, weekly locks, multi-acquisition sequences, goalie constraints, entitlements, desktop/mobile, Fantrax parity, free discovery (separate track).

## Boundaries
- No deletions, destructive git, production or provider reads beyond existing approvals, migrations, capture or serving activation, production settings, pushes or deploys.
- Tuesday Trends and Codex Player Cards/Thursday Spotlight files are out of every RSO lease.
