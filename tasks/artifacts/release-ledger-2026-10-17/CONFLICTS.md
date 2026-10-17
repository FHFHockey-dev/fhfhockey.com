# Unresolved conflicts, 2026-10-17

Each item states the two contradicting facts, the evidence for each, and what would resolve it. Nothing here was changed.

1. **The handoff says three local commits are unpushed. GitHub has them.**
   - `git ls-remote` at 19:58:21Z: `refs/heads/octoberBranch = ceceb407a`. The repo's `pushed_at` is 19:51:51Z. The first `ls-remote` in this session still showed `448231eca`.
   - The push came from outside this session.
   - The standing rule is "never push alone; re-check the 4 projects' preview settings with TJ, then confirm no builds started". This session confirmed 0 Vercel deployments and 0 GitHub statuses, deployments or check-runs at 19:58Z.
   - I did not re-read the preview settings: the project GET returns env metadata.
   - *Resolve:* TJ confirms who pushed and whether the preview re-check happened.
2. **The local tracking ref is stale.**
   - `refs/remotes/origin/octoberBranch` = `448231eca`, while the real remote is `ceceb407a`.
   - Any session that reasons from the tracking ref will think three commits are unpushed.
   - *Resolve:* a plain `git fetch origin` (no prune). See approval P0.
3. **The FORGE ledger contradicts itself on the catalog head.**
   - §8 says the migration is "not applied to the hosted database".
   - §11 and commit `a23728de2` say it was applied on 2026-10-17 as ledger version `20261017183611`.
   - I take the later §11 as current. The hosted DB now has a table and RPC that production `master` has no file for.
   - Separately, hosted `20261016152305` (RPC revocation) and register row 17's three versions have no local migration file at all.
   - *Resolve:* the U3 decision in `NEXT-RELEASE-PLAN.md`, plus the read-only hosted migration list already requested in register row 17.
4. **Uncommitted edits to released production paths in the shared checkout.**
   - At 19:59:45Z the working tree had modified:
     - `web/lib/NHL/corsProxy.ts` (+ test)
     - `web/utils/adminOnlyMiddleware.ts` (+ test)
     - `web/__tests__/pages/api/cors.test.ts`
   - All of these shipped in `457435eb`. Also modified was the release-excluded IFTTT receiver `web/lib/sources/lineSourceIftttReceiver.ts` (+ test).
   - A new `tasks/artifacts/security-candidates-2026-10-17/` suggests a security session owns them. I cannot confirm exact file ownership.
   - *Resolve:* each owner names its files (AGENTS.md exact-file ownership) before anything is committed.
5. **Accepted fixes buried under unreviewed deltas.** The register calls these commits "integrated", which is true by ancestry. But the accepted bytes are no longer what octoberBranch holds:
   - `0e8040da9` (Start Chart category choice): all 3 paths were later changed by `7f094c8e6`.
   - `90ae40f01` (parser fixes): `tweetInterpretation.ts` was later changed by `7f094c8e6`.
   - `6767073ea` (skater-queries): later changed by `6e14053ff`.
   - `5c28f7e8b` (RSO idle requests): both paths were later changed by `7f094c8e6`.
   - `26468a9fc`: `cron-report.ts` gained a 2-line alias later. R1 uses the accepted bytes instead.
   - *Resolve:* review only the delta since each accepted blob (the hashes are in `path-ledger.json` → `accepted_base_overwritten`).
6. **`1ddef915d` ("10/11") is half-accepted.**
   - The Master Page says the 7 RSO hashes match review v3, but "the entire 39-file commit is not accepted".
   - Its social share, commerce, SEO, migration and AGENTS.md paths have no exact receipt in the repo.
   - *Resolve:* separate reviews (U4–U7).
7. **Acceptance is claimed without a byte pin.**
   - The Master Page says the commerce "pure two-file candidate passed 44 tests … and passed independent calendar-anchor/cutoff review".
   - No receipt in the repo pins `web/lib/in-season/commerce.ts` or its test.
   - The private root, where it may live, was not readable here.
   - *Resolve:* TJ points to the receipt, or the pair is reviewed again.
8. **A tracked test needs an ignored fixture.**
   - `web/lib/sources/tweetClaimOccurrenceIdentity.test.ts` reads `tasks/ifttt-integration-2026-10-16/handoff/extracted-reviewed/…`.
   - That folder is gitignored (`tasks/ifttt-integration-2026-10-16/.gitignore:2`), so the test passes here and fails on a clean clone, in CI, or in an exported candidate.
   - *Resolve:* the IFTTT owner tracks a minimal fixture or changes the test. This blocks any U2 candidate that includes it.
9. **The migration-baseline test differs by branch.**
   - On master, `supportedBaselineMigration.test.ts` fails. It is one of the 17 baseline failures.
   - On octoberBranch it passes with 83 authority records, but only because the two pending `20261011*` migration files are present.
   - *Resolve:* the U3 decision.
10. **Two remote branches are behind their local copies.**
    - `chef/fantrax-setup-and-skt` is 7 commits ahead locally; `chef/start-chart-data-health` is 4 ahead.
    - Both are preserved locally and archived.
    - *Resolve:* TJ decides whether they matter remotely. No action is proposed.
11. **Some evidence could not be read.**
    - `~/Documents/FHFH-private/` was denied by the session's permission classifier.
    - Receipts for the Oct 16 daily materialization, consumer readback, coverage keys and the 2026-10-20 run directory are not re-verified here.
    - The ledger's evidence codes use in-repo receipts only.
12. **Public exposure cannot be undone without a history rewrite.**
    - `7f094c8e6` put reviewer transcripts, absolute local paths, research and about 78 MB of npm cache on the public octoberBranch.
    - A privacy scan reported no live secrets.
    - Untracking (cleanup C2) only stops future growth.
    - *Resolve:* TJ decides whether a rewrite is ever wanted. It is not proposed, and is out of scope.
13. **Dated counts versus observed counts.**

    | Item | Handoff | Observed |
    |---|---|---|
    | Prunable `/private/tmp` worktrees | ~79 | 76 |
    | `.codex` worktrees | ~26 | 23 + 1 under `~/Documents/Codex` |
    | Worktree registrations since 10-12 | — | 2 dropped (`start-chart-data-health`, `yahoo-scoring-fix`); both branches remain |

    No unique work was lost: every registered HEAD is reachable from a ref.
14. **Two Vercel project questions are still open.**
    - CMS and functions run Node 20.x while web runs 22.x.
    - The empty-root `fhfhockey.com` project's purpose is still undecided (register row 91).
    - See `COST-FOLLOW-THROUGH.md`.
