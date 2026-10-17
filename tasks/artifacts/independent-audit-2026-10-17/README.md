# Independent optimization audit, 2026-10-17

This is a read-only audit of `octoberBranch` at `ceceb407a`. Nothing was committed, deployed or deleted outside this folder.

**Update, 21:25 UTC:** Patch 01 is applied to the working tree (4 files, uncommitted) at TJ's request.

- The `_app` chunk went from 176 to 92.3 kB gz, and shared JS from 263.2 to 179.4 kB gz.
- Every non-consumer route lost about 84 kB.
- The blog test, tsc (with an 8 GB heap), lint on the 4 files, and the compile build passed.
- Details are in PATCH-PROPOSAL-01.md under "Results".

**Update, about 21:45 UTC:** the focused Comments test was added (2/2 passing), and the browser checks ran on an isolated server at 127.0.0.1:3107, since stopped.

- Homepage console, blog comment refetch and the `/db` snackbar passed.
- **There is a regression.** A signed-in non-admin opening `/db/upsert-projections` loses the "Access Denied" toast on the redirect to `/auth`, because the provider unmounts with the page. HEAD keeps it for about 6 s.
- Fix options are in PATCH-PROPOSAL-01.md.

**Update, about 22:00 UTC:** fix option 1 is applied as Patch 01 v2 (`patch-01-v2-route-scoped-snackbar.diff`, uncommitted).

- notistack now loads lazily for `/db*` and `/auth` only, and the redirect toast persists as at HEAD.
- Shared JS went from 263.2 to 180.9 kB gz.
- Tests, lint, the probe and the compile build passed. Results are under "Fix option 1 applied" in PATCH-PROPOSAL-01.md.

| File | Contents |
| --- | --- |
| [REPORT.md](REPORT.md) | Ranked findings F1–F12, each with source lines, evidence, a bounded change, an acceptance test and a rollback; corrections; reconciliation with prior evidence; a "not worth changing" list; limits |
| [COVERAGE-MATRIX.md](COVERAGE-MATRIX.md) | What was exercised, inspected, sampled or left unreviewed |
| [BASELINE.md](BASELINE.md) | Repository state, toolchain and machine, plus measurements M1–M5 with reproducible commands |
| [BACKLOG.md](BACKLOG.md) | 13 ranked items with metrics, acceptance tests, approvals and owner overlap |
| [CLEANUP-MANIFEST.md](CLEANUP-MANIFEST.md), [cleanup-manifest.csv](cleanup-manifest.csv) | 23 candidates: safe, uncertain or protected, with measured bytes, references, recoverability and a reversible procedure |
| [PATCH-PROPOSAL-01.md](PATCH-PROPOSAL-01.md), [patch-01-v2-route-scoped-snackbar.diff](patch-01-v2-route-scoped-snackbar.diff) | First bounded patch, now applied as v2 (uncommitted), with every check and measurement. The original v1 diff is [patch-01-scope-global-providers.diff](patch-01-scope-global-providers.diff), superseded. |
| `data/` | Build summary, per-route First Load JS, `_app` attribution, function traces, DB read log, and scripts (`first_load.py`, `function_traces.py`, `app-deltas.sh`) |

## Top three

1. Removing Apollo and notistack/MUI from the global shell cuts 91 kB gz from every page. *Measured.* This is Patch 01.
2. Goalie trends and prediction accountability silently cap at 1,000 rows. *Verified in code.* Fix goalie trends before about 2026-12-01.
3. The per-minute Starter Board fan-out drives about 95% of roughly 6,170 audit rows a day into an unindexed table that is never pruned. *Measured.* The owners are the IFTTT and ops-cron-health sessions.

## External actions taken by this audit

- One local compile-only build (`.next-playwright`). It grew that ignored folder by about 1 GB.
- Six bounded read-only production database reads.
- No HTTP requests, no browser, no dev server, no Vercel action.
