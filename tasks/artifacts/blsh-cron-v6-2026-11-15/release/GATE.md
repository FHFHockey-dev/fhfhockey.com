# Release gate for the inert BLSH v6 candidate (clean export of origin/master + v6)

**Inputs:**
- `origin/master` (`86c249382` when written);
- the v6 commit `6d4aba061`, 23 files;
- the release files below;
- **Superseded:** Chef's decision (2026-11-15): the RC (c2b3bd24c) ships v5 (348a122d6) on top of origin/master, so v6 imports the observer from the v5 adapter unchanged, as reviewed. The verbatim copy is not used; its bytes are kept in release/fix-tls-observer/ for reference only. The RC passed the full gate in a clean export (Chef).

## Blocker found while preparing this gate, and its fix (applied in the working tree; Chef commits it, and the recheck covers it)

`web/lib/blsh/nativeCaptureV6/adapter.ts` imports `withTlsObservation`/`TlsObservation` from `web/scripts/blsh/nativeProcessCaptureAdapter.ts`. **origin/master's copy of that file predates v5** (`0162fb52`, not the pinned v5 `aa6237bd`) and exports neither. So **origin/master + `6d4aba061` alone does not compile**.

Rehearsed in a full scratch export of origin/master (`web`, `supabase`, `tasks/TASKS`, `functions`, `cms`, root `vercel.json`) plus the 23 v6 files plus the release files:
- `npm run typecheck` gave **exit 2** with exactly two `TS2305` errors in `adapter.ts` line 8;
- `core.test.ts` failed 11/11;
- `routeRehearsal.test.ts` failed.

All six of master's `web/scripts/blsh/nativeProcessCapture*` files differ from v5.

| Option | What | Trade-off |
| --- | --- | --- |
| **B (recommended; prepared)** | `fix-tls-observer/`: a new `web/lib/blsh/nativeCaptureV6/tlsObservation.ts` holding v5 adapter lines 14–73 **verbatim**; `adapter.ts` imports from it (a one-line change, plus its header comment); a new `tlsObservation.test.ts` pins the block's sha256 `c01da6d8…`. Where the v5 adapter is present at `aa6237bd`, the test also compares the bytes directly. | Self-contained. Touches no pilot file. The observer stays byte-identical to the reviewed one, which is proved by hash; it is copied rather than imported. A changed reviewed import needs Chef's recheck. |
| A | Also ship v5's six `web/scripts/blsh` files (adapter, runner, bootstrap and their tests) to master | Pulls the laptop pilot's runner, bootstrap and tests onto master. The successor lane recorded 19 `bootstrap_wrong_checkout` failures in a fresh export, so this would break the gate. Not recommended. |

**Option B, rehearsed:**
- **On master + v6 + B:** every v6 test passes (counts in §1). `tlsObservation.test.ts` gives 1 passed and 1 skipped, the skip being the direct comparison, because master's adapter is not `aa6237bd`. The typecheck result is recorded in `REPORT.md`.
- **On `6d4aba061` + B:** `tlsObservation.test.ts` passes 2/2, the direct byte comparison included; `core` 11/11; rehearsal 3/3.

**Rules:** run every command with `GIT_DIR` **unset**, in the export (`$X`) unless the command says otherwise. Each line lists its expected result. Any other result is a stop.

## 0. Place the release files in the export (they replace origin/master's copies)

| From `tasks/artifacts/blsh-cron-v6-2026-11-15/release/` | To `$X/` |
| --- | --- |
| `tasks/TASKS/repository-audit-remediation/migration-authority.json` | same path (adds orders 153, 154: pending) |
| `web/lib/supabase/supportedBaselineMigration.test.ts` | same path (154 rows, 8 pending) |
| `tasks/TASKS/super-goal/super-goal-final-summary.md` | same path. **Required:** the baseline test checks this file's authority sentence, which now says 154 records. Chef's list did not name it. |
| `supabase/tests/blsh_native_capture_v6_rollback.sql` | same path |
| `supabase/tests/blsh_request_context_v1_rollback.sql` | same path |
| `fix-tls-observer/web/lib/blsh/nativeCaptureV6/tlsObservation.ts` (new), `tlsObservation.test.ts` (new), `adapter.ts` (replaces `6d4aba061`'s copy) | `web/lib/blsh/nativeCaptureV6/`. **Required:** without these, master + v6 does not compile. They match the working-tree files byte for byte. |

**Check the bytes:**

```bash
cd "$X" && shasum -a 256 supabase/migrations/20261116000000_blsh_native_capture_v6.sql supabase/migrations/20261116000100_blsh_request_context_v1.sql
# expect 4e896a891d02543a5a500597c7ce97d745e6a724d1c5100de1a7a2e8c9250c70 and 920e3430a89d1c91ac5899f52a2a606563d6e6f700f77e1750dbf5511089642b
git -C /Users/tim/Code/fhfhockey.com show --stat --format= 6d4aba061 | tail -1
# expect: 23 files changed, 2826 insertions(+); the only file outside the v6 paths is web/vercel.json (+3)
# (do NOT diff 6d4aba061 against origin/master: 6d4aba061 sits on octoberBranch and that diff would show all of its divergence)
```

## 1. Vitest, one file per run (in `$X/web`)

| Command | Expected |
| --- | --- |
| `npm test -- lib/supabase/supportedBaselineMigration.test.ts` | 21 passed. Rehearsed in a scratch export: 21/21. As a control, origin/master's unpatched test fails with v6 present (20/21). |
| `npm test -- lib/blsh/nativeCaptureV6/tlsObservation.test.ts` | 1 passed, 1 skipped on master (direct v5 comparison skipped; the hash pin runs) |
| `npm test -- lib/blsh/nativeCaptureV6/sourceDate.test.ts` | 5 passed |
| `npm test -- lib/blsh/nativeCaptureV6/runtimeReceipt.test.ts` | 3 passed |
| `npm test -- lib/blsh/nativeCaptureV6/writer.test.ts` | 3 passed |
| `npm test -- lib/blsh/nativeCaptureV6/sink.test.ts` | 3 passed |
| `npm test -- lib/blsh/nativeCaptureV6/core.test.ts` | 11 passed |
| `npm test -- lib/blsh/nativeCaptureV6/handler.test.ts` | 9 passed (pins the exact `vercel.json` `functions` object) |
| `npm test -- lib/blsh/nativeCaptureV6/requestContext.test.ts` | 3 tests. **In a clean export:** `tasks/artifacts/blsh-request-reader-20261111/` is untracked, so it is absent. The COLUMNS check then **skips** and the `checkRequestShape` assertion logs a warning. Expect "2 passed, 1 skipped". In the canonical checkout: 3 passed. |
| `npm test -- lib/blsh/nativeCaptureV6/routeRehearsal.test.ts` | 3 passed (7 scenarios, 0 real network) |
| `npm test -- __tests__/pages/api/v1/db/operational-route-auth.test.ts` | 72 passed |
| `npm test -- __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` | 55 passed (reads `vercel.json`) |
| `npm test -- scripts/vercel-ignore.test.ts` | 12 passed (reads `vercel.json`) |
| `npm test -- lib/nst/nstBypassGuard.test.ts` | 4 passed |
| `npm test -- lib/nst/callerLifecycle.test.ts` | 12 passed |

## 2. Static checks (in `$X/web`)

| Command | Expected |
| --- | --- |
| `npm run typecheck; echo "exit=$?"` | `exit=0`. **Read the exit code**: a plain `npx tsc` can OOM and still look clean when grepped. |
| `npx eslint lib/blsh/nativeCaptureV6 pages/api/v1/db/blsh-native-capture.ts; echo "exit=$?"` | `exit=0`, no output |

**Note:** `nstBypassGuard.test.ts` needs `functions/`, and `vercel-ignore.test.ts` needs root `vercel.json` and `cms/`. A partial export fails them for that reason alone; the full export passes, 4/4 and 12/12.

## 3. SQL proofs (disposable local PostgreSQL 15; needs Homebrew `postgresql@15` and psycopg2; never a hosted database)

`supabase/tests/blsh_capture_v6.py` imports the request reader's `capture_reader.py` from the untracked artifact folder. So run the SQL proofs from the **canonical checkout**. Its migration files are byte-identical to the export's (step 0 hashes), and the proofs read only those files and the release folder.

| Command (repository root of the canonical checkout) | Expected |
| --- | --- |
| `LC_ALL=C /opt/anaconda3/bin/python3 -I -B supabase/tests/blsh_capture_v6.py` | `57/57 passed`, `RESULT OK` |
| `LC_ALL=C /opt/anaconda3/bin/python3 -I -B tasks/artifacts/blsh-cron-v6-2026-11-15/release/proof/rollback_roundtrip.py "$PWD" "$PWD/tasks/artifacts/blsh-cron-v6-2026-11-15/release"` | `15/15 passed`: apply, rollback, rollback (a no-op), re-apply to an identical catalog; refuses while the bucket holds objects |
| `LC_ALL=C /opt/anaconda3/bin/python3 -I -B tasks/artifacts/blsh-cron-v6-2026-11-15/release/proof/rehearse_apply.py "$PWD" "$PWD/tasks/artifacts/blsh-cron-v6-2026-11-15/release"` | `17/17 passed`: the exact `sql/` files through `psql` as a non-superuser owner; documented lines matched; atomic on a ledger failure |

`-B` matters: it keeps bytecode out of `supabase/tests/` and the reader's folder.

## 4. Not part of this gate

**No `next build`** (cost rules), and **no** deploy, push, migration apply, schedule, kill-switch change or production request. Each is a separate TJ approval.

**The inert deploy, when approved, ships:**
- the route, which answers a 200 skip or a refusal while the migration is absent: a kill-switch read failure gives a 503;
- the separate `vercel.json` function entry.

**The first deployment probe** (`PROBE-LIST.md`, item M1 included) comes before any schedule.
