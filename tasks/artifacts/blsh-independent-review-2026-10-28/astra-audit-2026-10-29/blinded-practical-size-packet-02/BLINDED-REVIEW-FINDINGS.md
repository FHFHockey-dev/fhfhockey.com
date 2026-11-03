# Independent practical-size review — packet 02

The two fresh-context reviews support treating several-point retrospective differences as noticeable, and separating practical size from evidence reliability. They **do not establish the proposed joint 3 FP / 3 FP-per-60 cutoff as the boundary of meaningfulness**. All twelve deliberately selected boundary cases were judged moderate and meaningful by both reviewers, including all eight that fail one or both proposed magnitude conditions. No threshold was adopted or tuned, and no January computation was run.

## Procedure and staffing

Two independent workers received only `BLINDED/REVIEW-INSTRUCTIONS.md` and their respective `CASES-A.json` or `CASES-B.json`, with no prior conversation fork. Both disclosed no prior exposure to the cards' identities, combined scores, thresholds, selection keys, annotations or another reviewer's votes. Both returned 24 complete judgments with reasons. Neither saw the other's answers. After both final answers were received, the coordinator read the private selection key and contracts and compared the sealed votes. A subsequent preservation-only instruction authorized each reviewer to save its own unchanged answer; it did not request reconsideration.

Requested creation controls were explicitly `model=gpt-6.1-sol`, `reasoning_effort=high`, `fork_turns=none` for both `/root/blinded_reviewer_a` and `/root/blinded_reviewer_b`. Creation accepted those arguments but returned only agent names; agent inventory returned status, not model or effort. The reviewers could not independently confirm their actual runtime settings. The coordinator's actual model and effort were also not exposed. **Actual settings and the strictly higher coordinator-effort hierarchy remain unverified.** This is a documented staffing-verification limitation, not a claim of confirmed GPT-6.1 Sol high execution. The repository permits stating such a runtime constraint and using a feasible assignment. Exactly two reviewers were used, one judgment pass each plus output preservation, with no recursive delegation.

The coordinator had previously examined the rubric and earlier named cases and is **not** a blinded third voter. The requested packet reviews themselves used fresh contexts. Independence here means separate contexts and unshared answers; same requested model and common instructions do not imply statistically independent errors or independent human preferences.

## Verification and inputs

The packets contain identical cards in different orders: 22 distinct empirical players and two explicitly hypothetical, fixed-effect imputation vignettes. All 14 artifacts listed in the preparation `FINAL-RECEIPT.json` matched their byte lengths and SHA-256 values, including the instructions, both packets, private key, selection contract, stress amendment and January contract. Every review contains exactly the assigned 24 unique IDs. Native expected-minus-observed and per-60 arithmetic was checked on every card; maximum floating-point residual was `8.881784197001252e-16`.

| Input | SHA-256 |
| --- | --- |
| REVIEW-INSTRUCTIONS.md | `5cce00b1730e2f03a1e064d655016feabc843d7f50c6dd5fd9aae76702ae251c` |
| CASES-A.json | `cf25eb3045574d5ef3759c90deed4464dc7e1893c464bdec4383a220cd1ff428` |
| CASES-B.json | `c29c2241178444e1a988e1f3e8064583b2ca9a3873a6fd7fd524025d3973c4f6` |
| PRIVATE-KEY.json | `60b589e0933140ebe836baa71f6a98959d02d386dad4743bdadec58f1297da98` |
| PRIVATE-SELECTION-CONTRACT.json | `e052122ab491b9fb026b201ff7cb17eab9affe3d4d0b9ce447220191489e61a1` |
| JANUARY-REPLICATION-CONTRACT.json | `775672d7623f5cbfa51a57cceeca7f6d4f6086daec68c8084e909061106d58cc` |
| Original RUBRIC-PROPOSAL.json | `3ca86f6983159565a812ca4a07346ee08283b4de52d7da490b468b4dae7a6c4f` |

Packet root: `/Users/tim/Documents/Codex/2026-10-27/task-3/practical-size-review-20261029-01/packet-02/`. The proposal is in the sibling `materiality-rubric-20261029-01` task directory.

Raw sealed judgments and all reasons are preserved verbatim as JSON in this report's directory:

- `REVIEWER-A.json`: `52999aefbb3a86b230d2193e7710186a21deb2762898417646e1cd453dbd01f0`.
- `REVIEWER-B.json`: `b9859903ddaa8eb32cecdef6ca3ebfd7ffb51a4874146fc4463fed47db4cf086`.
- `RECONCILIATION.json` retains both judgments per card, native values, private sampling strata, all disagreements and descriptive counts. No consensus vote replaces either answer.

## Results

| Dimension | All cards | Empirical cards only |
| --- | ---: | ---: |
| Same practical-size category | 23/24 | 21/22 |
| Same meaningfulness judgment | 23/24 | 21/22 |
| Same native direction | 24/24 | 22/22 |
| Both say meaningful | 18/24 | 16/22 |
| Both say not meaningful | 5/24 | 5/22 |
| Meaningfulness disagreement | 1/24 | 1/22 |

Reviewer A: 17 moderate, one large, four small, two trivial; 19 yes and five no. Reviewer B: 18 moderate, four small, two trivial; 18 yes, five no, one uncertain. Both declined to invent a universal minimum noticeable difference; all optional numerical tolerances are null. These are purposive-card summaries, not population agreement estimates or calibrated error rates.

### Disagreements retained

1. **`bea8f8f72b6a`: large versus moderate; both meaningful.** The support deficit is 3.133 FP, 4.472 FP/60 over 42.03 minutes, with zero observed shots. A emphasized the large proportional loss: 1.05 produced against approximately 4.18 support-expected points. B emphasized the accumulated effect of approximately one goal's scoring value. This is a relative-versus-absolute size distinction, not a direction or arithmetic disagreement. Preserve both; the packet provides no decision utility that resolves the adjective.
2. **`38090fea2ca2`: meaningful versus uncertain; both small.** The support deficit is 1.340 FP, 3.986 FP/60 over 20.17 minutes and two appearances; baseline deficit is 1.747 FP. A considered the shortfall noticeable relative to a low supplied expectation. B considered a total below one assist's scoring value borderline without a practical decision context. Both flagged the thin personal reference. This exposes an unresolved product preference about proportional versus accumulated importance in brief exposure; it does not justify inventing a new cutoff or averaging votes.

No other categorical disagreement occurred. Variations in reason codes and emphasis remain in the raw records.

## What the proposed cutoff does and does not gain

For comparison only, recomputing the **magnitude conditions alone** (`abs(support total gap) >= 3` and `abs(support rate gap) >= 3`) passes six of the 22 empirical cards. Both reviewers call all six meaningful. But both also call ten other empirical cards meaningful even though they fail at least one magnitude condition. These counts do not reapply the full numeric/freshness/concordance/eligibility rule and are not list-membership accuracy statistics.

The pre-specified boundary subset is more directly informative: all twelve cards meet the selection contract's fresh, numeric, aggregate-concordant and native-sign-concordant requirements. Four meet both magnitude conditions; four meet neither; four meet only one. **Both reviewers call all twelve moderate and meaningful.** The boundary does not separate their judgments on these cards.

For example, `064125d83c4c` has a 2.924 FP deficit and 2.951 FP/60, failing both conditions; `ec9ad3f642b0` has 3.017 FP and 3.054 FP/60, passing both. Both reviewers rate both moderate and meaningful. At a wider distance, the observed-zero-shot card `7e9b3e3d96df` has 2.184 FP and 2.045 FP/60 and is meaningful to both. The cohort-only card `09d750faf133` accumulates a 2.930 FP excess over 81.83 minutes despite a 2.148 FP/60 excess rate and is also meaningful to both.

This gives qualitative support to interpreting approximately assist-to-goal-scale accumulated differences as noticeable, and to showing rates and totals together. It supplies no substantive evidence that exactly 3 is necessary in either dimension, no preference for the conjunction over other policies, and no replacement threshold. A deliberately conservative display filter could still use 3/3 as an explicit product choice, but must not be described as a validated meaningful/non-meaningful boundary or a confidence threshold. Do not lower it to match these votes or optimize the selected count.

## Zero shots, missingness and reference scope

All three observed-zero-shot empirical cards were judged numerically rather than excluded: two were meaningful, while the 0.966 FP deficit over 23.08 minutes was small and not meaningful. Both reviewers distinguished cohort comparisons from established personal ability, and separated thin/old references and conditional removal sensitivity from supplied effect size.

The two hypothetical imputation cards received the same moderate/meaningful/directional judgments as their matched empirical cards from each reviewer, while their reasons added process uncertainty. That is the intended interpretation check. The empirical imputation strata were empty, and the amendment explicitly substituted hypothetical stress cases before votes. Thus this review provides **no empirical evidence of imputation accuracy or behavior on truly missing native values**: all 24 cards have numeric native effects. It also does not validate confidence probabilities, revision timing, forecast value, or trade profitability.

## Disposition and shortest next step

Record the disposition as: **blinded judgment exercise complete; exact 3/3 boundary not established; no accepted threshold or preview/scorer change**. Keep native totals, rates, exposure, reference type/age, missingness and conditional sensitivity visible separately. This advances the retrospective tool without representing a cutoff as discovered truth.

The smallest remaining practical-size test is a decision-context review by TJ or intended users using the preserved near-boundary and low-exposure disagreements: determine whether a conservative list filter is useful and what omitted-but-noticeable differences are acceptable. A human product preference can justify an explicit provisional policy; another same-model vote or a fresh empirical origin alone cannot supply that preference. No additional model-vote round is needed here.

If the already frozen January development replication proceeds, first record an explicit retain-as-policy-hypothesis, revise or reject disposition. Preserve the old contract; freeze a new version before computing January if the candidate changes. January can examine descriptive transport and chronology under the declared recipe. It cannot retroactively make this purposive review a validation set or establish the usefulness of exactly 3/3. This review did not inspect January results or execute that computation.

## Scope limits

This pass verified packet hashes, equality apart from ordering, complete review coverage, native arithmetic and agreement/threshold comparisons. It did not rerun sampling, refit or rerun the scorer, rebuild raw-history provenance, rerun application tests or browser checks, or verify actual agent settings beyond accepted creation controls. Existing owner packets, contracts and disagreement register were preserved. New review records and a task diary are the only local writes. No database, provider/network, production, Git, deployment, deletion or reserved-2025–26 action occurred.
