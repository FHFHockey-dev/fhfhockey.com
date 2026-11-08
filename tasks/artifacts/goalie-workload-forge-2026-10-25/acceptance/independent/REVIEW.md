# Independent review — frozen goalie workload patch

**Recommendation: accept for bounded local integration. No actionable introduced defects found within the requested scope.** This is not deployment approval, source-data certification, predictive calibration or model activation approval. Chef owns the final acceptance decision.

## Custody and pins

Reviewed on `octoberBranch`, HEAD `1ee5127dc22c34ef9658f96ed4d72823b1d5ea29`. All six source SHA-256 values matched `CHECKPOINT.json` before review and after review. The checkpoint's older HEAD identifies its original freeze; the six content pins remain identical at the current committed HEAD. Exact pins and results are in `source-hashes-before.json` and `source-hashes-after.json`.

The three `before-*` files match `BASELINE.json`, and `task-only.patch` matches its checkpoint hash. Reviewed the actual chart delta against that preserved dirty-work baseline, plus current helper/seam and all three test files. Did not apply the task patch to HEAD or attribute baseline retry/mobile work to this patch.

Writable ownership: this `acceptance/independent/` directory and `tasks/diaries/2026-10-25-codex-goalie-workload-independent-review.md` only. No source, Git/index, branch, server, port, shared mailbox, register or other lane modifications. No agents spawned. Assignment specifies gpt-6-astra / medium; the parent/runtime hierarchy cannot independently be verified here, as recorded in `../RESUME.json` under mise-en-place's runtime limitation allowance.

## Review conclusions

- **Descriptive chart:** distinct `(team, game)` opportunities determine Team GP and L10/L20/L30 boundaries. Summed appearances remain a separate pie denominator. Relief therefore raises appearance count without raising team games. Team partitioning preserves a traded goalie's historical club attribution. The current-season regular-season request remains the caller's season boundary; the chart does not pretend to establish official starters or calibrated probabilities.
- **Missing and zero:** complete rate sums fail closed for missing, nonfinite or negative inputs. No shots/minutes produces unavailable rates, while measured zero saves/goals with positive exposure stays zero. Saves above shots is withheld. Tooltips handle the new nullable rates directly. This does not change FORGE conditional stopping rates.
- **Pagination and recovery:** the new duplicate identity check runs over the entire assembled page set before state publication. Duplicate pages with unchanged totals/lengths throw into the existing all-window withholding path. Retry limits, eight-request batches, span-only local slicing, manual retry and mobile team fallback are preserved from baseline; existing tests exercise these paths.
- **Dormant seam:** directly calls canonical rolling appearance/start receipt builders, preserves their scope, cutoff, window, methods, hashes and rejection reasons, and masks observed count/share when those reasons exist. Historical starts use eligible team opportunities, which is deliberately distinct from the chart's share of appearances. Historical zero/one endpoints remain descriptive; future probabilities stay null, confirmation unconfirmed, calibration unavailable and activation dormant.
- **Identity and leakage:** followed only the imported canonical rolling, dated-eligibility and starter kernels needed to evaluate this adapter. They retain player/NHL-player/team identity and effective interval checks, season/window bounds, complete opportunity-frame requirements, duplicate-game rejection, evidence identity/hash conflicts, original source-clock cutoff checks and explicit official-start labels. The adapter does not rewrite input clocks, fabricate eligibility, reinterpret unknown labels as negatives or combine a traded player's other-club rows into the current-club frame.
- **Activation boundary:** a bounded symbol/import search under `web/` found the new seam only in its definition and test. There is no production consumer introduced by this patch. The seam neither computes conditional performance rates nor calls a forecast selector.

## Verification and commands

Independent read-only checks completed: `git rev-parse HEAD`, `git branch --show-current`, targeted `git diff --name-only -- <six paths>` (empty), Python SHA-256 checks of all six sources before/after, preserved baseline copies and task-only patch. Inspected the named source/test files, chart patch, relevant canonical kernel ranges, recorded command-result JSON and actual log tails. Initial `git status --short` exposed numerous unrelated untracked artifacts; none were modified.

Reused existing successful execution evidence (not rerun):

| Evidence | Result |
| --- | --- |
| `../../focused-results.json`, `../../focused-1.log` | 37 tests passed across three focused files |
| `../../controls-results.json`, `../../controls-1.log` | 299 tests passed; one existing opt-in skip |
| `../../static-results.json`, `../../static-1.log` | Scoped TypeScript check exit 0 |
| `../../static-results.json`, `../../static-2.log` | Scoped ESLint exit 0; two existing img warnings |

Those JSON records contain exact commands, working directory and exit codes. The recorded test harness uses the original network-deny preload, inert service variables, isolated configuration and an exclusive heavy-check lock. No new adversarial test was necessary: the new behavior has direct focused coverage and inspection found no concrete unresolved case warranting another execution. Consequently no heavy lock was acquired and no test suite, server or build was launched by this reviewer.

## Limits and remaining gates

No browser/Chart.js runtime or pixel-level mobile QA was performed; chart rendering is mocked in the reused component tests. No provider/DB reads, network requests, fitting, production executions, pushes, merges or deployments occurred. Provider completeness and official starter authenticity remain upstream evidence obligations, not claims established by fixture tests.

The pre-existing top-five rendering limit can omit additional goalies from the drawn circle while labels use all appearances; it is unchanged by this patch and is not an introduced finding. The chart still depends on its documented complete single-season input contract. Canonical limitations copied into the diagnostic include model-oriented wording; the explicit descriptive-only status and null forecast fields govern this dormant output.

No blocker to bounded local acceptance identified. Predictive source/calibration/activation gates remain outside this review and unapproved. Diary is working handoff context, not release or acceptance evidence.
