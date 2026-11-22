# Proposal: the smallest real RSO review for native FORGE skater forecasts (Detailed)

2026-11-21. This is a proposal for TJ, not an approval. Nothing was released, pushed, built or migrated, and no production reads were made.

**Bottom line:** no review can be filed today, and the entry as designed couldn't match a live row even once filed.

1. **No prospective evidence exists.** TJ's predeclared scope was never pinned, and no slate was ever captured, settled or checked (§2).
2. **The binding identifies the producer by its deploy commit SHA** (`payload.codeVersion`). Shipping the review is itself a new deploy with a new SHA, so the review can never match rows issued after it ships (§3).

The draft diff below is real, tested and inert: every value that has to come from evidence is a `PENDING-UNAPPROVED` placeholder that no live row can equal.

Line numbers cite the base files at `b37a0180d` (origin/master), not the draft.

> **Superseded in part (2026-11-21, after TJ's rulings):** the binding in §1, the draft code in §4 and DRAFT-REVIEW.patch use `conditional_playing`, the `forge-issued-participation-v1` lineage and a 40-hex deploy-SHA codeVersion. The current target binding is the overlay method `forge-rso-participation-overlay-v1:skater`, conditioning `rso_participation_overlay`, and the stable closure-hash codeVersion; see SCOPE-AMENDED.json. The patch is kept as a record and isn't regenerated: its base lacks the overlay, and the identity-fix lane will restructure the catalog.

---

## 1. The binding

Each field is what `web/lib/rosterScheduleData/planning.ts:241-250` mints for a Detailed skater row. `resolveRsoTargetUse` compares every field exactly, so a review's values have to equal the minted ones.

| Field | Value | Why |
|---|---|---|
| component | `forge-detailed-skater` | planning.ts:242 mints `forge-detailed-${source.kind}`. Skaters only; goalies keep `start_only_zero_relief` and stay out of scope. |
| modelMode | `baseline` | `payload.modelMode` = `resolveSkaterRolloutConfig().mode` (`skaterRollout.ts:14-18`, default `baseline`). The Nov 21 run smoke (`daily-offday-release-2026-11-21/release/smoke.json`) shows `mode: baseline`. Pin it from the qualified revision's payload, not from code. |
| codeVersion | **PENDING**: the qualified producer's exact 40-hex deploy SHA | `forecast.modelVersion` = `payload.codeVersion` (`consumerRevisionAdmission.ts:127`). **Inferred from code, not from a published revision:** the writer falls back from `FORGE_CODE_VERSION` to `VERCEL_GIT_COMMIT_SHA` (`run-forge-projections.ts:503`); pregame publication requires a 40-hex release pin (`pregameCapture/publication.ts:87`); the Nov 20 live attempts recorded 40-hex code versions; and the Nov 21 run's `producer_identity.code_versions` is `[null]`, so `FORGE_CODE_VERSION` is unset. **This field is the blocker (§3).** |
| configurationHash | **PENDING**: from the qualified revision's `inputProvenance.modelIdentity` | TJ D3: the sha256 of the run's `modelEnvironment` (`run-forge-projections.ts:452-455`). No local artifact records a live value. |
| artifactHash | **PENDING**: same source | D3: `sha256({codeVersion, configurationHash})`. planning.ts:60-69 nulls both hashes unless this holds, and a null hash denies. |
| targetKey | One review per scored skater target: draft `GOALS, ASSISTS, PP_POINTS, SHOTS_ON_GOAL, HITS, BLOCKED_SHOTS` | See "Points need one review per target" below. |
| horizonGames | `1` | planning.ts:246 hard-codes 1. TJ D2 is h1. |
| conditioning | `conditional_playing` | planning.ts:247 labels skater bindings this way. It's only a label: the served row is `unconditional`, and `forecastAllows` (`rosterScheduleOptimizer/planning.ts:114`) requires that for totals. |
| participationLineage | method `forge-issued-participation-v1:skater` (pending Chef's relay) | planning.ts:249 mints `forge-issued-participation-v1:skater@<revisionId>`. The review names the stable method, and every row's issuance is still checked (`rsoUsePolicy.ts:113-121`, Astra F3). See §6: this method can't yet tell the new participation policy apart. |
| inputCutoffFrom / inputCutoffUntil | from `reviewedAt` to at most `reviewedAt + 30 d` | D5: expiry at most 30 days, with a cutoff window covering only the qualified identity's issuance. The window starts at approval, so no row issued before the review counts. |
| expiresAt | at most `reviewedAt + 30 d` | D5. This is also the only rollback that needs no release (§5). |
| allowedUses | `totals: true, comparison: true, assignment: false, conditionalTieBreak: false` | TJ D2. Points readback needs `totals` (`rosterScheduleOptimizer/planning.ts:134`). Lineup totals need `totals` and `comparison` (`:273`, `:328`). Start/sit needs `assignment` (`:363`, `:422`), which stays denied, so the optimizer still won't pick lineups from FORGE. |
| prospectiveEvidenceRef | **PENDING**: `sha256(scope.json)` + `sha256(final look-2 checker report)` | D5. The resolver accepts **any** non-empty string here (`rsoUsePolicy.ts:87`), so this must never hold "TBD"-style text in a release. The draft's placeholder is safe only because its codeVersion can't match a row. |
| ownerApprovalRef | **PENDING**: TJ's recorded approval | D5. |

### Points need one review per target
- `gameForecastPoints` returns null when any weighted, applicable target lacks `totals` (`rosterScheduleOptimizer/planning.ts:128-139`). One review entry has exactly one `targetKey`.
- **Option A, D2 as written:** one `SHOTS_ON_GOAL` review. RSO would show SOG totals and comparison, but **no league points**, unless the league scores only SOG.
- **Option B, recommended if points are the goal:** one review per target the league weights. The shared identity is the same; only `targetKey` changes. This goes **beyond D2**, so TJ has to extend the claim, and each target needs its own passing evidence under the protocol.
- The draft lists six targets. TJ should set the list from the league's actual weights.
- FORGE skater stats are `GOALS, ASSISTS, PP_POINTS, SHOTS_ON_GOAL, HITS, BLOCKED_SHOTS, PENALTY_MINUTES, TIME_ON_ICE_PER_GAME` (`starterBoardScoring.ts:159-161`). A league that weights a stat FORGE doesn't forecast (for example plus/minus) gets null points whatever the reviews say. I didn't verify whether `statApplicability` filters such keys out.

### Side effect to expect
Because assignment stays denied, both diagnostics still count `use_not_approved` per target (`rosterScheduleData/planning.ts:252`, `rosterScheduleOptimizer/planning.ts:449`), and the "Detailed target uses require an applicable reviewed scope" limitation still shows. Points and totals would display anyway. Relabelling the diagnostics is follow-up UI work.

---

## 2. Evidence: none exists

From a read-only trace of `tasks/artifacts`:

- **The scope was never pinned.**
  - `rso-wave2-2026-10-25/FORGE-QUAL/scope.json` (protocolHash `49ae034a…`) still has `status: draft_identity_unpinned`, with null `method`, `codeVersion` and both hashes.
  - The Nov 1 copy (`rso-resume-2026-11-01/release-prep/qualification-readbacks/scope.json`) is byte-identical.
  - The Nov 1 identity lookup returned 0 rows (`…/qualification-capture/OWNER-DECISION.md:5-7`).
- **No slates exist:** 0 slates, 0 settled skater-games, and no look-1 or look-2 checker report. The checker (`FORGE-QUAL/tooling/check-readbacks.mjs`, installed Nov 9) has run only on synthetic fixtures (`rso-daily-beta-2026-11-08/2026-11-09/RESULT.json`).
- **Nothing was settled or scored:** no bias, slope or ΔMAE was ever computed (`qualification-capture/settlement-evidence.json`: `realInputsRead: false`).
- **No later TJ decision** changes D2, D4 or D5.

### What a valid `prospectiveEvidenceRef` needs
1. A scope pinned to one producer identity before its first slate.
2. 14 slates with ≥500 settled skater-games per target.
3. A readback in both consumers at T-60.
4. D+1 settlement from `forge_player_game_strength`.
5. The season-rate comparator.
6. Look 1 at slate 7 (stop for harm only) and look 2 at slate 14.
7. The final checker report's hash.

### Three protocol problems TJ must settle before slate 1
Changing the protocol means re-hashing the scope, so these come first.
1. **Targets:** D2 covers SOG only. Option B needs D2 extended to the scored targets, with the same thresholds applied per target.
2. **Participation basis:** under the new Detailed policy (lane local_96a86520), `stats` is the "if he plays" line times 1 or 0. D4's baseline (a) multiplies by "the issued participation probability", and the readback's "issued value" assumes the old admission path. Both definitions need restating for assumed participation. The evaluation then measures the participation policy as well as the rate model, which is what users will actually see.
3. **Identity stability:** D4's reset rule ends the scope on any producer change. Because codeVersion is the deploy SHA, *every* web production release, producer or not, changes it. Before the §3 fix, the 14-slate clock (about 2–3 weeks) can't run under recent release cadence, and a freeze wouldn't rescue the review anyway (§3).

### Cheapest way to produce the evidence
1. TJ amends and re-hashes `scope.json` (all three items above).
2. Land the §3 identity fix (required; it is a one-time closure change with its own registration).
3. Pin the scope from the first qualifying revision.
4. Run 14 slates. Each slate needs one bounded readback per consumer at T-60 (a production read, so it needs TJ's approval) plus one D+1 settlement read.
5. Run the existing checker at slates 7 and 14.

There is no local shortcut. Local fixtures are synthetic. A retrospective replay of past revisions isn't prospective (D5) and would touch the sealed Oct 23–30 block (D1).

---

## 3. Blocker: the binding can't outlive its own release

- `codeVersion` is the exact deploy SHA, and `artifactHash` hashes it (D3). `revisionModelIdentity` (planning.ts:60-69) re-derives `artifactHash` from `payload.codeVersion`, so both move on every deploy.
- The review has to name the identity of the deploy that produced the evidence. Shipping the review means editing `rsoUsePolicy.ts`, which is a new commit and a new production deploy, and every row issued after that carries the new SHA.
- So an exact-scope review covers only rows issued *before* its own release. Those are pregame rows that expire at puck drop, so in practice it covers nothing. **A deploy freeze doesn't solve this:** it lets evidence accumulate, but the release that ships the review still changes the SHA.
- `rsoUsePolicy.ts` is also **inside** the producer closure: `player-forecasts/planningContributions.ts` imports `currentRsoUsePolicy` and `restrictRsoForecast` (value import), and `rosterScheduleOptimizer/planningTypes.ts` imports its types (the verifier follows type imports too). Binding the closure hash alone therefore doesn't help, because adding a review changes the closure.

### Required fix (a design decision for TJ, in its own lane, outside this proposal)
- **(i) Take the review catalog data out of the producer closure.** A catalog module that `rsoUsePolicy.ts` imports would still be in the closure. The catalog has to be passed in by callers outside the closure, for example `rosterScheduleData/planning.ts` (already outside) handing the policy to `planningContributions.ts` instead of the `currentRsoUsePolicy()` default. This is a one-time closure change with its own registration. After it, review edits never touch the closure, which is the same rule `verifiedForgeReleases.ts` follows: "Admission code and its allowlist must stay outside the closure."
- **(ii) Make the bound identity stable across non-producer deploys.** For example, the producer stamps `codeVersion` as its verified producer closure hash rather than the deploy SHA. `artifactHash = sha256({codeVersion, configurationHash})` then stays stable too. This **amends D3's meaning of codeVersion**, so TJ has to approve it.
  - Pregame publication currently refuses a non-40-hex pin (`publication.ts:87`), so that check changes as well. I haven't verified whether the pregame payload carries the closure stamp today; runs carry `metrics.producer_identity`.

Pinning `FORGE_CODE_VERSION` to a stable label isn't a substitute. It's an unverified env label that readers use "only to deny" (`forgeProducerIdentity.ts:6-7`), and pregame publication requires a 40-hex pin.

---

## 4. The exact diff

- **Worktree:** `/private/tmp/forge-rso-review-scope-20261121` (detached, base `b37a0180d`).
- **Full patch:** [DRAFT-REVIEW.patch](DRAFT-REVIEW.patch) (5 files, +69/−8).
- **Scratch commit:** `a9dec915b43b7ccc3243839e8606930af6db6a2e` (local only). It holds `rsoUsePolicy.ts` and its tests.
- **Registration:** the verifiedForgeReleases edits are uncommitted in the worktree.

What the patch contains:
- **`web/lib/player-forecasts/rsoUsePolicy.ts`:** the shared `DETAILED_SKATER_SCOPE`, `RSO_REVIEWED_SKATER_TARGETS`, and one review per target. The revision becomes `rso-review-before-use-2026-11-21-draft`. Identity, dates and refs are `PENDING-UNAPPROVED:*`, so the entry is inert.
- **`rsoUsePolicy.test.ts`:** replaces "catalog stays empty" with two tests:
  - pending is all or nothing across identity, hashes, dates and both refs, so a half-filled entry fails;
  - while pending, the best-shaped real row is still denied;
  - once filled, an entry must carry a 40-hex codeVersion, 64-hex hashes, an expiry at most 30 days after review, `inputCutoffUntil ≤ expiresAt`, and only totals and comparison. With the §3 fix, the codeVersion rule changes to match.
  - The all-or-nothing edit came after the scratch commit, so it's uncommitted in the worktree. Tests are outside the closure, so the closure is still `a59138ce…`.
- **`__tests__/pages/api/v1/start-chart.test.ts`:** the two `reviews.toHaveLength(0)` tripwires become "every production review is pending". Update them again when a real entry lands.
- **`web/lib/projections/verifiedForgeReleases.ts` and its test:** register closure `a59138ce737822e3ae6c16a18e642edb401ad9e3e299b09b7ee87225e58cbc44` → commit `a9dec915b…`, with receipt [a9dec915b….json](a9dec915b43b7ccc3243839e8606930af6db6a2e.json) (sha256 `6540a35b9cc4bf9cfed134b0060a38e42564b9c37a90c8d0cd8adc7cc710ef14`): verified, 243 modules, 0 findings.
- **This closure is provisional.** Real identity values, dates or targets change `rsoUsePolicy.ts` bytes and therefore the closure. The registration has to be redone on the actual release commit. Registering doesn't change the closure: it's still `a59138ce…` after the edit.

**Checks, run in the worktree's `web/` without GIT_DIR:**

| Check | Result |
|---|---|
| Vitest: rsoUsePolicy, start-chart, verifiedForgeReleases, rosterScheduleData/planning, planningContributions | 434 passed, 1 skipped |
| Vitest: all 23 other test files that import the policy (RSO components, optimizer, acceptance, Yahoo confirmations, bridge) | 1002 passed |
| Vitest after registration: verifiedForgeReleases | 28 passed |
| Vitest: externalInputProof, forgeServingHealth, forge-build-admission | passed |
| `npm run typecheck` | exit 0 |
| `forge-producer-closure.ts --print` | base `0446100e…` (= released); draft `a59138ce…` |

---

## 5. Rollback and release footprint

| Option | Closure | Registration | Build |
|---|---|---|---|
| Let it expire (`expiresAt` / `inputCutoffUntil`, at most 30 days) | unchanged | none | **none** |
| Revoke: add the id to `revokedReviewIds` | new | new closure, registration and receipt | 1 production release |
| Revert `rsoUsePolicy.ts` byte for byte | back to `0446100e…` (already registered), **only if no other closure change shipped in between**; otherwise a new closure | none in the clean case | 1 production release |

- **Prefer revert over revoke for an emergency.** Revert lands on an already-verified closure. Revoke keeps the audit trail but costs a fresh verification.
- **Release footprint:** one master merge. Per the recorded footprint that's 1 fhfhockey build plus 3 canceled companion entries; re-inventory before pushing. The release needs the registration in place, or the production build fails admission (`scripts/forge-build-admission.ts`).
- **Revision bump side effects (traced):**
  - A browser still running the old bundle sends its compiled revision as `expectedPolicyRevision`, and the current read refuses the mismatch ("Current read does not match this planning generation", `currentPlanningRead.ts:99`) until the page reloads.
  - `restrictRsoForecast` treats a saved manifest with the old revision as incompatible (base `rsoUsePolicy.ts:127-129`), so Daily-bridge rows in workspaces saved before the release lose bridge authorization until a fresh read.
  - Bump the revision only in the real release, and say so in the release notes.

---

## 6. Dependency on the participation lane (local_96a86520)

> **Superseded 2026-11-21 (Chef):** 2f3c20880 was an early, dangling version. The parked final candidate 47a1a2628 already mints `forge-rso-participation-overlay-v1:skater@<revisionId>` with conditioning `rso_participation_overlay` (planning.ts:229-231). The review binds that method; see SCOPE-AMENDED.json. The resolver `@issuance` gap moved to the identity-fix lane. TJ chose Option B, approved the identity fix (own lane), and amended D4.

- The lane's candidate (`2f3c20880`) keeps planning.ts minting `forge-issued-participation-v1:skater@<rev>` whether or not `RSO_ASSUMED_PARTICIPATION_POLICY` applied. So a review for that method would also admit rows served under the old participation path, and the evidence would describe only one of them.
- **Ask:** the lane mints the lineage with its policy method, for example `rso-assumed-participation-v1:skater@<revisionId>`, and the review binds that method. Chef relays the final id. I haven't edited the lane's files.
- **Resolver gap to close at the same time:** `rsoUsePolicy.ts:82-83` requires an `@revision` only for the `forge-issued-participation-v1:` prefix. A new method name would pass with no issuance unless that rule is generalized to every issued method.

## Decisions for TJ (via Chef)

| # | Decision | Recommended |
|---|---|---|
| 1 | Option A (SOG, as D2 states) or Option B (each scored target; extends D2) | B, if points are the goal |
| 2 | The §3 identity fix: the catalog passed in from outside the producer closure, plus a stable codeVersion (amends D3). Required: no freeze makes a review match rows issued after its own release | approve, in its own lane |
| 3 | Amend D4 for assumed participation and per-target thresholds, then re-hash the scope before slate 1 | amend |
| 4 | Production readback and settlement reads for 14 slates (bounded, sequential) | approve once 1–3 are settled |
