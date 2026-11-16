## 2026-11-10 completed release and public smoke

The specific missing-points fix is deployed and public serving is verified. Exact release `47df3e6bf0ecb0fab01cc864fedf4e5ea6fab748`, tree `5fbc65abb806fe0fb7f604e53083de9447902761`, based on #427 `26374f21d`. Four pinned files only. One Git-triggered web build `dpl_D1wAMrmthjMLqY98JFZbDbi9mi31` became READY at 15:27:10 UTC and is aliased to fhfhockey.com. All three companion entries canceled. No duplicate build.

At 15:32:44 UTC the prepared public GET returned HTTP 200 (1,934,759 bytes). Exact saved-input arithmetic: baseline legal and comparison-eligible, finite projected points; 3/3 bounded Best Fit candidates have finite net points. File-only coverage comparison confirms all seven originally missing player-games recovered. Four different remaining raw missing rows are November 9 past-game entries. Served response has eight run proofs, six from the repaired #423 closure; do not claim all seven old run IDs were selected. Eleven historical holds remain preserved by the validated registration logic. Native forecast use is not activated; this is the existing approved bridge/legacy serving path, not native quality approval.

An earlier smoke attempt failed before HTTP because the inert environment omitted runtime proxies and direct DNS returned ENOTFOUND. Vercel had no matching route log. Parent authorized one same-route transport retry through existing proxy, which succeeded. Total attempts two; one origin HTTP response. No further application request, Yahoo/auth/provider call, production data write/repair, flags or unrelated deploy. Original private input is unchanged. Authenticated Yahoo and selected-move/private workflow acceptance are still open.

Current candidate, collision evidence, push/build receipts, sanitized smoke, coverage reconciliation and preservation receipt are in `resume-2026-11-10/`. The published SHA was fetched and safely merged into local octoberBranch as `d31dcb33f72d4c9d69b507874c388f0cd549fe2f`, preserving both histories, all 37 unrelated dirty-file hashes and all working-file bytes. Index matches HEAD; octoberBranch was not pushed. Separate saved-input schema and Browserless files remain excluded. RSO Git/build custody is released; Browserless may independently prepare its separate release after checking current gates.

Historical preparation record follows unchanged.

---

# RSO missing-points release checkpoint

As of 2026-11-09 21:36 UTC: **fixed and vetted locally; not pushed or deployed**. One-time continuation is scheduled in the existing RSO thread for **22:15 UTC**. Reuse it; do not start a competing release. Its execution remains conditional on the actual stopped rebuild and Claude's news release being READY.

## Authorization and current hold

TJ: “The RSO is not showing projected points for players in the Best Fit Available section again - I forget what the error was last time but it was an easy fix, and it's happening again” and “when fixed and vetted it should be pushed to prod”. This authorizes this specific missing-points fix, not unrelated production repairs.

TJ subsequently relayed Claude's order: the goalie rebuild is active, stops cleanly between windows by 22:05 UTC, then Claude releases the news-card fix in one web build, approximately 22:05–22:12. RSO starts **only after that release is READY**, approximately 22:15. Matching owner evidence: `CLAUDE-CHEF-RSO-BUILD-WINDOW-20261109-21` in the incoming mailbox, commit `661e4e3805c24cbca2d744bd02380a80c7fc9770`. A stale “stopped” diary and elapsed time are insufficient. Do not run new diagnostic database reads during the active rebuild.

## Verified cause and minimal fix

The supplied 20:39 input lacked forecasts for two active roster players across seven games. Actual stored run attribution reproduced all 18 withheld runs. Seven current-week runs, issued November 9 for November 9–15, have valid per-invocation stamps for producer closure `9b1821fff8b64983f5e28c572a054cdc7d49f2a320b8e2e18dec514e4ad4c219`, from release #423 (`a5816ce6d1eeeba4b7213d1f66c96025f0b5818e`). That verified closure was absent from admission.

Register that closure and the current #425/#426 producer closure `ce9cdbc7dc5c9afb0c09580b090ba7fcbfb984f126442361e2a6e06411a99420`, tied to exact commit `d66408de3a0d1ccea1daaadfce8a3a9ae20cb680`. Both exact-commit audits pass: 199 modules, zero findings, 21 reviewed dynamic sites. Admission stays outside the producer closure. This does not grant native forecast quality/use approval or substitute zero for unknown data.

After the local change, the actual classifier admits all seven current-week runs. Eleven historical November 2–4 runs remain withheld. See `classification-before.json`, `classification-after.json`, and the two exact commit receipts. This proves admission correction; actual served coverage and Best Fit calculations still need the post-release smoke.

## Exact local candidate

- Base: `788668cb57454e55316fc25db06562f567997ee4` (#426), confirmed on GitHub at 21:32 UTC.
- Candidate: `44582b13a213dfd4c75238d8413cf4031ca98b6f`; tree: `d9a2bd4fe3c0190e07c5cdcc49f8259725048800`.
- Four files only: `web/lib/projections/verifiedForgeReleases.ts`, its adjacent test, and the `a5816ce6…json` / `d66408de…json` receipts in this directory.
- `CANDIDATE.json` records all exact file hashes and temporary object/export paths. No new editing branch/worktree or shared index/ref change. Source archive `release-files.tar` SHA-256: `da853681d55cafaec191bb9cde338288f2e3ac2af220592c8c45254b7506795a`. It contains those four files only. `registration.patch` contains the two tracked-file changes.
- Exact exported candidate: **202 tests passed**, `npx tsc --noEmit` passed, scoped ESLint passed. Receipts: `candidate-tests.json`, `candidate-typecheck.json`, `candidate-lint.json`. The earlier expected-list regression failed before repair.
- Exact exported candidate closure remains `ce9cdbc7…99420`; 199 modules, zero findings. Receipt: `candidate-closure.json`.

**Do not push the old-base candidate after Claude's next release.** Rebuild the same four-file diff on the actual newly released master. Announced news commits `a70dece64` and `7d05e867b` touch zero producer modules (`NEWS-RELEASE-OVERLAP.json`), but check the actual released tree. Requalify a changed producer before registering it; never infer qualification from a SHA or previous audit alone. Preserve concurrent files and any divergence. The sole editing checkout remains `/Users/tim/Code/fhfhockey.com` on `octoberBranch`.

The separate local saved-input repair in `workspaceSchema.ts`, its test, and `planningTypes.ts` **must not be bundled**. Nor may the other lanes, private input, diaries, metadata query results, or this working checkpoint be included. Coordinate any Git index/ref writes and release reconciliation; do not reset or broadly stage the dirty checkout.

## Release and smoke sequence

1. Read latest owner mailbox and actual deployment metadata. Verify goalie work stopped and Claude's news release is READY. Record its exact deployed SHA and GitHub master SHA; reconcile if they differ. No overlapping build.
2. Reconstruct the four-file candidate on that released base in isolated object/index storage, preserving all working files. Verify file hashes/diff, unchanged producer closure, and proportionate affected checks. Reuse unchanged evidence; no routine full suite or production build.
3. Confirm the final candidate SHA, project, environment, and master target. Recheck deployment status for that SHA before publishing. `BUILD-INVENTORY.json` records all four projects: `fhfhockey` root `web`, `functions-fhfhockey` root `functions`, `cms-fhfhockey` root `cms`, and `fhfhockey.com` root repository. All production branches are `master`, all preview tracking is Disabled. Expected: four entries, **one web build**, three ignored/canceled companions. The legacy root's candidate config is `ignoreCommand: exit 0`; its dashboard shows Automatic. No configuration changes needed.
4. Publish only the approved exact candidate through the repository's existing release controls. Observe completion and record every project's actual build/skip status. Do not duplicate a build, force-overwrite another release, or retry an uncertain operation without checking outcome.
5. Once the RSO deployment is READY, run the prepared `smoke-public-serving.cjs` against an exact source export of that release. It is syntax-checked, **not executed yet**. Inspect it first. It owns one actual GET to `/api/v1/roster-schedule-optimizer/data` with only the retained public season/date/timezone scope and a nonce, no cookies or credentials; the inspected route/readers are read-only and use a bounded 20-second read. The script then uses the actual runtime admission callback for a baseline and at most three candidate searches / twelve evaluations. No second HTTP request, Yahoo, reload, write, or selected move. Stop on error.
6. Inspect the smoke's response proof, missing active-player coverage, baseline comparison and finite Best Fit point counts. The seven newly admitted runs need not all appear if no served row references one. Record exact results, not assumed success. Synchronize accepted Git history without overwriting other owners, then update the diary/mailbox and report actual deployment versus remaining private-acceptance gates.

The smoke uses the original local file `/Users/tim/Downloads/rso-planning-evidence (4).json`, SHA-256 `124984ee2f1f59916c6233566cd896826a91359980bc657531c55f04702db1de`. It verifies this hash and leaves the file unchanged. Never copy the private body into Git. There is no proof of byte identity with the Library attachment. The script writes only the **public** HTTP response and sanitized counts to its output directory. Invoke using installed `ts-node/register/transpile-only` and `tsconfig-paths/register`, with `TS_NODE_PROJECT` pointing at the exact released export's `web/tsconfig.json` and compiler options `{"module":"CommonJS","moduleResolution":"Node"}`. Use an inert environment; never source `.env`. The local verification network guard blocks this deliberate live GET, so do not inherit it into the approved smoke. The smoke wrapper itself pins the one allowed route and request count.

Arguments: `--execute-public-read <exact released repository export> <original input path> <new output directory>`. Use a new directory only for the first execution; an existing smoke receipt blocks repetition. Record the actual request first. Total approved production smoke budget remains at most five sequential read-only application requests; this plan uses one. Any additional route needs a concrete reason and a stated stop condition. Do not invoke refresh/recompute/cron/ingestion endpoints.

This check is **current public serving with saved-input arithmetic**, not authenticated Yahoo acceptance. Live Yahoo can refresh/persist credentials and remains unauthorized. Manual/Yahoo private acceptance still requires TJ's actual workflow result, selected-move continuity, refresh choices and real slot rules. Saved input had no selected moves; do not claim that gate closed.

## Checkpoint accounting

Canonical HEAD at checkpoint: `661e4e3805c24cbca2d744bd02380a80c7fc9770`, branch `octoberBranch`. Shared index empty. No owned process remains. One bounded read-only database metadata query; zero application smoke requests, data writes, Yahoo calls, pushes, remote builds or deployments. Remote settings were inspected read-only. No approval denial or uncertain mutation is pending. Exact state is in `CHECKPOINT.json`; automation execution itself is not yet verified.
