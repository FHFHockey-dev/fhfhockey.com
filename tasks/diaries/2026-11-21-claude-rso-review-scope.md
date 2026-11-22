# 2026-11-21 claude: RSO review scope proposal (side session of Chef local_9996b7b8)

## Scope
Prepare, for TJ's approval, the smallest real RsoTargetUseReview for Detailed RSO native FORGE skater points/totals. Proposal only.

## Where
- Worktree /private/tmp/forge-rso-review-scope-20261121 (detached, base b37a0180d = origin/master).
  - Scratch commit a9dec915b43b7ccc3243839e8606930af6db6a2e (rsoUsePolicy.ts + tests, local only).
  - verifiedForgeReleases registration uncommitted in the worktree; web/node_modules is an untracked symlink (never commit).
- Deliverables: tasks/artifacts/rso-review-scope-2026-11-21/ (PROPOSAL.md, DRAFT-REVIEW.patch, receipt a9dec915b….json).

## State (done)
- Draft = inert per-target reviews (PENDING-UNAPPROVED identity/refs), totals+comparison only.
- Provisional closure a59138ce… (base 0446100e…); receipt verified, 243 modules, 0 findings.
- Checks: vitest 434+1002+28 passed; typecheck exit 0.

## Findings
- No evidence exists: FORGE-QUAL scope never pinned, 0 slates, no checker report.
- Blocker: binding codeVersion = deploy SHA, and rsoUsePolicy.ts is inside the producer closure, so a review can't match rows issued after its own release. Fix (TJ decision): catalog out of the closure, bind on the closure hash.
- Points need one review per weighted target; D2 is SOG only.
- Participation lane still mints forge-issued-participation-v1:skater; it should mint its own method; generalize the @revision rule.

## Next
- Report to Chef (done at handoff). Await TJ decisions 1-4 in PROPOSAL.md.

## Blockers / approvals
- TJ: target set, identity fix, D4 amendment, prod readback/settlement reads.

## Checkpoint 2 (Chef relayed TJ decisions: Option B, identity fix in own lane, D4 amended; overlay method from 47a1a2628)
- Wrote SCOPE-AMENDED.json (forge-qual-scope-v2, draft protocolHash 7d9e2368… (not final until TJ rules on part B), verified with checker canonicalHash) and SCOPE-AMENDMENT.md (19 changes, slate-14 estimate Sat 2026-12-12 if the fix ships ~11-28 and full slates are published).
- Gotcha: the overlay replays news at read time, so the evaluated value is pinned to the T-60 readback; the reset rule includes a served-value surface hash (overlay modules live outside the producer closure).
- Open: the v2 checker update (local), full-slate Detailed publication, prod read approval.
- Readback is per start-time group (games acknowledge at their own T-60); part B = 8 proposals needing TJ.

## Checkpoint 3 (TJ ruled B1-B8 as proposed, TJ pop-up 2026-11-21)
- SCOPE-AMENDED.json final protocol: protocolHash dc9c87b78e56d67965353f8f11a55a8a60e659a1f8eff489dca29bbff4cf1a68 (checker canonicalHash verified); status amended_awaiting_identity; file sha256 2bfc5bb6….
- SCOPE-AMENDMENT.md records each ruling plus the v2 checker change list (not built).
- Gotchas: the v1 checker computes no metrics; readScope treats only null as unpinned, so PENDING strings would pass; bootstrap replicates/seed/scheme are not predeclared (open gap).
- Generator script lives in the scratchpad (make_scope.py); regenerate only with an intentional protocol change.
- Task complete; keep this diary until the identity fix pins the scope (the next agent resumes from here).

## Checkpoint 4 (bootstrap predeclared, TJ pop-up 2026-11-21, values pending TJ sign-off)
- protocol.bootstrap added: 10,000 replicates, base seed 7f8b18a3b1d413c5 derived from pre-bootstrap hash dc9c87b7…, per-(target, look) streams, xoshiro256** seeded by splitmix64, rejection indices, two-way game x player pigeonhole bootstrap, type-7 percentile 95%.
- New protocolHash 2acaff686c4953f60d17a17cfe0c59af76beb043e82a9a384b3a2824fb871469 (verified in node); file sha256 499a36b5…; status amended_awaiting_identity; bootstrapSignOff kept outside the protocol.

## Checkpoint 5
- TJ signed off the bootstrap unchanged (pop-up 2026-11-21); bootstrapSignOff recorded outside the protocol; protocolHash stays 2acaff68.... Lane paused until the identity fix ships; diary kept for resumption.

## Checkpoint 6
- Identity fix 6ca16d025 accepted by TJ: identity block (outside the protocol) now binds modelIdentity v2 codeVersion = 64-hex closure (producerCodeVersion on rows); payload.codeVersion = release pin, recorded only. protocolHash unchanged 2acaff68...; file sha256 1667940c.... The protocol text (decisions line, resetRule) says "codeVersion"; identity.codeVersionMeaning defines it, so no re-hash. Lane paused until the identity fix ships.
