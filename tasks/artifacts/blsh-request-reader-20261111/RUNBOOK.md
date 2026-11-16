# BLSH request reader for 2026-11-11: runbook (POST-CAPTURE step 4)

This folder fills the bridge's biggest gap: a fresh `request.json` (CURRENT-REQUEST) and `context.json` (CONTEXTS) that cover source date 2026-11-11, for `assemble.mjs` and `prepare_packet.py`.

**Nothing here has touched the database.** The single live read needs TJ's own approval of the exact command below. Every check so far is offline.

## Fixed values

```bash
R=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-request-reader-20261111
WORK="/Users/tim/Library/Application Support/fhfh-blsh-postcapture-20261117"   # the bridge's $WORK (POST-CAPTURE "Fixed values")
SCOPE=d84a9547b4b28eaef5204a9fae2650cb9a32f0b8f431057e95c0b07d9fa6abc3        # sha256 of $R/LIVE-READ-SCOPE.json
```

## The single command (11-17, right after POST-CAPTURE step 3)

Run it once step 3 (convert) has printed `{"ok":true,"evidenceClass":"candidate_pending_independent_review","date":"2026-11-11"}`:

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B -X pycache_prefix=/var/empty "$R/run_live_read.py" --execute-read-only --candidate v5 --scope-sha "$SCOPE" --conversion "$WORK/conversion" --out "$WORK/request-read" --request-out "$WORK/request.json" --context-out "$WORK/context.json"
```

**When:**
- after the latest native retrieval in `$WORK/conversion`;
- no later than 12 h after the earliest native retrieval;
- inside 2026-11-17T14:05Z to 2026-11-19T00:00Z.

The reader enforces all three before it opens the env file. Run it straight after step 3, about 14:10Z.

**Effect on the deadline:** the request is captured after the native pages, so the native retrieval stays the earliest evidence. The step 7 deadline stays at about 11-18T14:05Z, so the read does not shorten it. `E` must be at or after `request.asOfUTC`; step 7 checks this.

**Fallback day (11-18, `v5-1118`):** the same command with `--candidate v5-1118` and `WORK=…/fhfh-blsh-postcapture-20261118`, only if TJ approves that slot. Its packet has a different name, so it takes a different packet lock. Its window closes at 2026-11-19T00:00Z (event age 7 days).

## Value-free preflight (T−1 and again just before the read)

```bash
/usr/bin/env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B -X pycache_prefix=/var/empty "$R/run_live_read.py" --preflight --scope-sha "$SCOPE"
```

- **Checks:**
  - every pin and the green test receipt;
  - the reader folder is the pinned path;
  - `capture_reader`/`read_only_session` execute from their hashed source bytes;
  - the import origins (see "Custody");
  - no `~/.postgresql` directory exists.
  It lists any packet locks and the start-up custody modules.
- **Does not touch:** the conversion, the env file, any lock or the network.
- **Expect:** `{"reader":"preflight_ok","packetLocks":[],"pycachePrefix":"/var/empty","startupNonStdlibModules":["__main__","_distutils_hack","zope"],...}` and exit 0.
- **Today (11-15 ~21:40Z):** exactly that. The exact command above, pointed at an e2e scratch conversion, refused `outside_read_window`, with no lock or output.
- **Why it matters:** the scope hash also pins `productionReference.ts`, `typescript.js`, node and the anaconda/psycopg2 tree. Any change to them before 11-17 means a re-pin and a new hash in TJ's approval. **Run the preflight just before the approval pop-up.**

Also confirm before 11-17:
- `cd "$R" && shasum -a 256 -c SHA256SUMS` gives every line `OK`;
- `ls "$R/locks"` shows no `*.lock` for the slot's packet.

## How the credential is supplied (never printed)

- **No paste, no argv, no shell variable.** The reader opens `web/.env.local` itself, using the operator launcher's pattern (`read_private_env_file`):
  - it opens with `O_NOFOLLOW` and `fstat`s the same descriptor;
  - the file must be regular, owned by uid 501, with no group or other bits;
  - it parses and never sources the file.
- **One key only:** `SUPABASE_DB_URL`, exactly once, with no whitespace or stray quote.
- **Binding:** `read_only_session.bind` checks the value against `supabase/.temp/project-ref` and `pooler-url`, both pinned. The password goes only into `psycopg2.connect(password=…)` for `postgres.<ref>` at the session pooler.
- **Order:** the file is read after every pin, conversion and window gate, and before the packet lock. So an env-file refusal does not consume the attempt.
- **No heavy lock:** `/private/tmp/fhfh-heavy.lock` is a `mkdir` convention for heavy *local* jobs (tsc heaps, `npm ci`). This read takes about 5 s and 2 MB. A stale or long-held lock must not block a time-critical single attempt, so the reader does not take or check it. (On 11-15 that path held a stray empty file from another job.)
- **Value-free output:** driver exceptions are reduced to `errorType` plus a pgcode, never text. The tests assert that a fake password never reaches any output file or stdout.
- **Environment:**
  - `env -i` leaves only `PATH`, plus `LC_CTYPE`, which Python sets itself.
  - Any other key is refused by name before anything else, including every `DYLD_*`, `PG*`, `SSL*`, `PYTHON*` and `HOME`.
  - The interpreter must be `/opt/anaconda3/bin/python3.13` (pinned), run with `-I -B -X pycache_prefix=/var/empty`; it is the only one with psycopg2. What that does and does not bind is in "Custody".

## Custody: what the pins bind, and what they do not (RECHECK-11 A1)

**Bound, checked after import and before the env file is opened:**
- **No bytecode.** Before any import, the entry refuses `bytecode_cache_not_disabled` unless `sys.pycache_prefix == "/var/empty"` and that directory is root-owned and empty. Every module, stdlib included, then compiles from its source; a `.pyc`, planted or not, is never read. That is why `tree_sha` can skip `__pycache__`.
- **No shadowing.** The reader folder is never on `sys.path` (`-I` drops the script dir, and the reader no longer inserts it). `capture_reader` and `read_only_session` are executed from the exact bytes just hashed against the scope; there is no finder and no `.pyc`. A copied folder refuses `reader_root_not_pinned`.
- **Origin check (`check_import_origins`).** Every module loaded after start-up must come from one of:
  - the stdlib (not `site-packages`);
  - the pinned psycopg2 tree, whose bundled libpq, libssl and libcrypto are inside the tree pin;
  - the two pinned reader files.

  `psycopg2` and `psycopg2._psycopg` must lie in the pinned tree. Otherwise it refuses `module_origin_not_pinned:<name>` or `psycopg2_origin_not_pinned_tree:<name>`.

**Not bound (custody; like RECHECK-9's `sitecustomize` limit):**
- `/opt/anaconda3` is owned by `tim`, not root. Unpinned:
  - the stdlib source and `lib-dynload`;
  - the libraries the interpreter links;
  - the libcrypto that `hashlib` uses to compute the pins.
- **`.pth` start-up hooks** run under `-I` before line 1 of the reader. The modules they load are recorded, not refused, as `startupNonStdlibModules`; on 11-15 these were `_distutils_hack` and `zope` (and `__main__` is the pinned script itself).
- **What a same-user attacker could do:** they could alter these. They gain no new capability, because they can already read `.env.local` or hand-write `request.json`.

**Database role:**
- `bind()` connects as `postgres.<ref>`, the owner role. Read-only is enforced by the client:
  - the SQL is allowlisted, with frozen parameters;
  - the transaction is `REPEATABLE READ READ ONLY`, with `transaction_read_only=on` verified before and after;
  - the session option is `default_transaction_read_only=on`;
  - it ends in `ROLLBACK`.
- **No read-only role in the repo:** a grep of `supabase/migrations`, `migrations`, `sql` and `web/supabase` finds no read-only login role (no `CREATE ROLE`/`CREATE USER`, no `pg_read_all_data`). The only roles are throwaway ones in `supabase/tests/*.sql`.
- Creating one is a production change for Chef/TJ, not this lane.

## Read budget (for TJ's approval wording)

| Bound | Limit (enforced) | Expected |
| --- | --- | --- |
| Connections | 1, no retry | 1 |
| SQL dispatches | ≤ 35 (6 control + 2 metadata + 1 key seal + ≤ 25 pages + rollback) | about 28 (18 pages) |
| WGO rows | ≤ 10,000; at 10,001 it refuses after the key seal, before any page | about 6,950 (see DATE-FROM.json) |
| Scope | season 20262027, WGO dates 2026-10-14 … 2026-11-11; NST same player/date/season; `games` only for WGO game ids | |
| Bytes | ≤ 8 MiB in total, ≤ 256 KiB per page, ≤ 128 KiB key seal (bounded both server and client side) | about 2.1 MB |
| Time | 5 s per statement, 1 s lock timeout, 10 s idle in transaction, ≤ 150 s overall, 4 s connect, 2 s close | about 5 s (the 11-01 run took 5.0 s) |
| Transaction | `REPEATABLE READ READ ONLY`, transaction-local settings, `ROLLBACK` at the end; the session option is `default_transaction_read_only=on` | |
| TLS | `verify-full`, trust bundle `50c3011a…` (pinned), host `aws-0-us-east-1.pooler.supabase.com:5432` | |
| Writes, provider calls, NST | 0 | 0 |

**Draft approval wording:** *"I approve ONE bounded read-only Supabase read, run by Chef with exactly the RUNBOOK command, scope `d84a9547…`.*
- *It is one connection to the session pooler, verify-full TLS, REPEATABLE READ READ ONLY.*
- *It connects as the owner role `postgres.<ref>`; read-only is enforced by the reader's code, not by a database role. I accept the interpreter custody residual stated in the RUNBOOK.*
- *Limits: ≤ 35 statements, ≤ 10,000 WGO rows for 2026-10-14 to 2026-11-11 (season 20262027), ≤ 8 MiB, 5 s per statement, ≤ 150 s.*
- *0 writes and 0 retries.*
- *The reader takes the credential from web/.env.local without printing it.*
- *Valid on 2026-11-17 after the native conversion.*

*This approval does not cover the 11-18 fallback."*

## Expected output

- **Exit code:** 0, with one stdout line:
  `{"state":"REQUEST_AND_CONTEXT_EXPORTED","queriesDispatched":~28,"rows":{"wgo":~6950,…},"sessionClosed":true,"export":{"ok":true,"nativeDateCoverage":{"date":"2026-11-11","games":6,"expectedWgoRows":216,"wgoRows":~216,"individualUnique":>0,"onIceUnique":>0,"scheduleGamesMissingFromCapture":[],"capturedGamesNotInSchedule":[],"wgoRowsComplete":true},…}}`.
- **Files:**
  - `$WORK/request.json`: the CURRENT-REQUEST bytes, verbatim. `eventThroughDate` is 2026-11-11, `asOfUTC` is the capture time, and `freshnessPolicy` is 7 d / 24 h.
  - `$WORK/context.json`: CONTEXTS, `fhfh.blsh.current-production-context.v1`, with the last 5 captured records per player.
  - `$WORK/request-read/`, which holds:
    - `CONNECTION-DISPATCH.json` and `RESULT.json`;
    - `EXPORT-SUMMARY.json`;
    - `capture/`: `PLAN.json`, a DISPATCH/RAW/RECEIPT per query, `KEY-SEAL.json`, `RAW-{wgo,individual,onIce,calendar}.json`, `CURRENT-REQUEST.json` and its own `RESULT.json`.
  - `$R/locks/<packet>.lock`: never removed.
- **Then:** carry on at POST-CAPTURE step 5. Steps 7–9 read `$WORK/request.json` and `$WORK/context.json` unchanged.

## Stop rules

Every stop is final: **no second live read, no hand edit.** Quarantine `$WORK/request-read` and report to Chef's parent.

| Result | Meaning | Then |
| --- | --- | --- |
| exit 2, `{"reader":"refuse","code":…}` | Refused **before** any connection; nothing read | Act on the code only:<br>• `env_file_*` or `SUPABASE_DB_URL_*`: fix the file's mode or shape, without printing it, then rerun.<br>• `read_before_native_capture`: wait for the conversion.<br>• `outside_read_window` or `read_too_late_after_native_capture`: the read slot has passed. Stop.<br>• any `*_pin_drift`, `tests_receipt_*` or `conversion_*`: stop and report.<br>• `packet_lock_exists_no_second_read`: the attempt was already made. Stop. |
| exit 1, `CONNECTION_OR_WRAPPER_STOPPED_NO_RETRY` | Connection or TLS failed; `errorType` and pgcode only | Stop |
| exit 1, `STOPPED_NO_RETRY` + `errorCode` | The core refused mid-read, for example:<br>• `cohort_bound_or_id` (more than 10,000 rows);<br>• `session_contract_*`;<br>• `*_bound`;<br>• `*_shape`;<br>• `session_or_snapshot_drift`.<br>No request is written. | Stop |
| exit 1, `DISPATCH_OUTCOME_UNKNOWN_NO_RETRY` | A statement timed out | Stop |
| exit 1, `SESSION_CLOSE_UNCONFIRMED` | The close was not confirmed; no request is published | Stop; report |
| exit 1, `CAPTURED_EXPORT_REFUSED` | The read succeeded, but the export refused, for example:<br>• `no_wgo_rows_on_native_date_games` (no 11-11 row in a scheduled game);<br>• `no_stored_nst_rows_on_native_date` (neither group);<br>• `selected_row_bound`;<br>• `request_*_keys`. | No second read. The export is a pure function of `capture/`. If Chef's parent approves, it can be rerun offline into **new** paths (below). |
| `export.nativeDateCoverage.wgoRowsComplete: false` | Fewer than 36 × 6 WGO rows for 11-11, or a scheduled game with no captured rows (`scheduleGamesMissingFromCapture`) | Not a stop. Assemble gives fewer entries; report the counts and ids. |

Offline re-export, which reads no database:
```bash
/usr/bin/env -i PATH=/usr/bin:/bin /usr/local/bin/node "$R/export_context.cjs" --capture "$WORK/request-read/capture" --conversion "$WORK/conversion" --request-out "$WORK/request-2.json" --context-out "$WORK/context-2.json" --summary-out "$WORK/request-read/EXPORT-SUMMARY-2.json"
```

## dateFrom: why 2026-10-14 (see DATE-FROM.json, written by `justify_date_from.py`)

- **The retained 11-01 capture:**
  - 8,135 WGO rows, 09-29..10-31, from 226 games;
  - never more than 36 rows per game, and 0 duplicate player-dates.
- **Projected new rows:** 11-01..11-11 is games 2026020227..298, so 72 games × 36 = 2,592 rows at most.
- **Codex's original `dateFrom` (2026-07-01) gives about 10,727 rows,** which is over the 10,000 cap. A cap hit is a no-retry stop, so the window has to narrow.
- **Choice:** 11-11 minus the p99 latest-five span (28 days) = **2026-10-14**:
  - it covers the latest-five window of 99.3 % of players active at the end of the retained data;
  - it projects 6,948 rows, leaving 3,052 rows (30 %) of headroom;
  - that is 18 pages and 28 dispatches.
- **Alternatives:**
  - 10-07: 8,855 rows, only 1,145 headroom;
  - 10-21: 5,292 rows, 97.5 % coverage.
- **What the narrowing costs:** windows are capped at what lies inside 10-14..11-11. A player whose 5th-last game is before 10-14 gets a shorter window. That matters little here: the gate never establishes a complete latest five, and only 11-11 rows carry native evidence.

## Adaptations from Codex `current-refresh-reader-20261101-01` (read only; verbatim copies in `upstream/`)

- **`capture_reader.py`:** only `DATE_MIN` and `DATE_MAX` change (`CORE.diff`; 9b5a9550 → 841f2bb6). The SQL text is byte-identical: the tests match each statement's sha256 to the retained live run's `query-NN-DISPATCH.json`.
- **`read_only_session.py`** (`SESSION.diff`):
  - it takes the credential value as a parameter instead of reading `.env.local` itself;
  - `application_name` is `…_20261111`.
- **`run_live_read.py`** is new, replacing `execute_read_only.py`. It adds:
  - the env allowlist;
  - pins for the interpreter, psycopg2 tree, node and web sources;
  - the conversion gate: the approval is re-derived from the explicit `--candidate`'s pinned pins/verifier/node/lineage hashes and packet name (RECHECK-11 A3), and the time gate;
  - the no-bytecode gate, source-byte module loading and the import-origin check (RECHECK-11 A1);
  - the per-packet lock;
  - the private env file read;
  - the preflight;
  - **dropped:** the heavy lock, which Codex's wrapper took;
  - the chained offline export.
- **`export_context.cjs`:**
  - **Not carried over:** the checks tied to the 11-01 capture (`contexts.length===740`, `SOURCE-DIFFERENCES`) and the October `DISCREPANCIES.json` binding. The binding throws if any WGO value was corrected since; that is unknowable offline, and a throw on the day would be a stop. The output says `discrepancyEvidence: "not_bound_in_this_export"`.
  - **Re-pinned:** `productionReference.ts`, 9a56af85 → ec3afb69. Commit db7a64c58 is +89/−0; `FHFH_WEIGHTS` and `outcomes()` are equal on all 8,135 retained rows (tested).
  - **New:**
    - the exact-key request contract;
    - the RAW-hash binding;
    - native-date coverage against the conversion's schedule. Shortfalls are reported; it stops only when no 11-11 row matches a scheduled game, or no 11-11 row has a stored NST row in either group;
    - the `prepare_packet.py` selected-row bound (≤ 5,000).
- **`production_context.cjs`:** verbatim (198fe2a7).

## Offline tests (`bash tests/run_all.sh <new scratch dir>`; 77 passed, 0 failed; see TESTS.log)

`run_all.sh` writes its log and receipt **only into the scratch dir**, so a rerun never changes this folder.

`bash tests/publish.sh <that scratch dir>` is the one step that copies a green receipt and log in, then regenerates `LIVE-READ-SCOPE.json` and `SHA256SUMS` together. It refuses a receipt whose pins differ from the files (RECHECK-11 A2).

- **Python, 50 (`tests/test_reader.py`):**
  - **Core against the fake DB:** the window, dates, counts and SQL identity.
  - **Bounds and refusals:**
    - the cap at 10,001 and exactly 10,000 rows = 35 dispatches;
    - the dispatch budget;
    - the page, key and total byte caps, client side and server side;
    - statement timeout and total deadline;
    - session contract: read-only, isolation, statement timeout, lock timeout, a missing metadata key;
    - snapshot drift;
    - query, row-group, WGO, process-row and calendar shapes;
    - extra, missing and reordered sealed keys, and a key-seal count lie;
    - a post-cutoff row;
    - the frozen scope;
    - close failure, and no overwrite.
  - **ReadOnlySession over a fake raw connection:** the allowlist and parameter scope, a full capture, `bind`, the verify-full/bundle/options of `connect`, and an unverified endpoint.
  - **Integrity (RECHECK-11 A1), 6 tests:**
    - a planted timestamp-valid `.pyc` runs under plain `-I -B` (control) but never through the reader's loader, nor with the `/var/empty` prefix;
    - the entry refuses without that prefix, or with any other prefix;
    - a copied folder with a planted `psycopg2.py` refuses, and the plant never runs;
    - the real entry, in a fresh isolated process, loads both reader files from their pinned paths and psycopg2 from the pinned tree, and leaves the folder off `sys.path`;
    - the origin check refuses a shadow `psycopg2`, a moved `capture_reader`, an unpinned `site-packages` module and a missing `_psycopg`, while recording start-up custody modules;
    - a preloaded module from elsewhere is refused.
  - **Wrapper gates:** candidate required/unknown, conversion approval re-derived per candidate (pins, verifier, lineage, a v5-1118 conversion under v5, wrong packet slot), env allowlist, flags, scope and pins, test receipt, conversion, time window, outputs, env-file privacy and shape, packet lock, value-free failure, preflight, libpq client dir, and argv.
- **Node, 9 (`tests/test_export.cjs`):**
  - productionReference equivalence;
  - the happy export;
  - simulated capture refused in live mode;
  - no overwrite;
  - conversion date mismatch; a scheduled game missing from the capture (reported); a captured game outside the schedule (reported); a disjoint schedule (stop);
  - no NST rows on 11-11;
  - capture tamper;
  - exact keys at every level;
  - the CLI.
- **End to end, 18 (`tests/e2e.sh`), on the bridge's real CLIs with `--candidate v5`:**
  - a fake-DB capture;
  - a 2026-11-11 candidate packet (real v5 bytes, the real 10-01 NST page, hand-written TLS/RUNTIME);
  - verify, then convert (candidate class);
  - **`run_live_read.run()` offline:** only `psycopg2.connect` → FakeRaw, the clocks and the fake env file are swapped; the real export runs;
  - a hand-built acquisition, then frames (288);
  - the deadline check (binding rule capture_age), and its refusal before `asOfUTC`;
  - **assemble: `proposedEntries` 576, native date 2026-11-11 only;**
  - `prepare_packet.py`: 468 proposed witnesses;
  - propose: `PROPOSAL_ONLY…`, `reviewSHA256` null;
  - **the real gate with a labelled synthetic review: 234 individual + 234 on-ice qualify on time; CLOSED admits 0; 0 on 11-19;**
  - guards: the real fixed paths, the bridge folder and this folder are unchanged.
- **Fake DB (`tests/fake_db.py`):**
  - retained RAW rows with only their dates re-stamped: 10-01 → 11-11, the others +10 days, plus a post-cutoff copy on 11-12;
  - 7,199 rows fall in the window.
- **Network:** none. Sockets are blocked in the Python tests.

## Limits and open questions (for Chef)

1. **dateFrom** narrowed to 2026-10-14 (above).
2. **The discrepancy binding is dropped**, so contexts carry no October discrepancy notes.
3. **The productionReference re-pin** (above).
4. **Credential pattern:** the reader reads `web/.env.local` itself, in the operator-launcher style. The 11-12 plan forbade an ".env loader" for the NST run; TJ approved the operator's launcher design. This reader needs the same approval.
5. **The heavy lock was dropped** (see "How the credential is supplied"). On 11-15 a stray empty file from another job sat at `/private/tmp/fhfh-heavy.lock`; with Codex's gate it would have blocked the read.
6. **The 12 h ceiling** after the native capture is this lane's choice. It leaves 12 h of the 24 h for steps 5–12.
7. **The bridge changed during this work:**
   - `--candidate` became required;
   - `post-capture/proposed/` appeared.
   The e2e follows the bridge as of 11-15 ~21:00Z. **POST-CAPTURE step 4 should point at this RUNBOOK; that is the bridge lane's file.**
8. **The real 11-11 stored rows are unknown until the read.** The export stops on 0 NST rows; a WGO shortfall is reported, not a stop.
9. **The interpreter is not SIP-protected,** so its hash is pinned. Under `env -i`, no `DYLD_*` key can reach it, and any present is refused. The remaining interpreter residual is stated in "Custody".
10. **The owner role** is used because the repo has no read-only login role (see "Custody").
11. **The candidate sets** (`CANDIDATES` in `run_live_read.py`) copy the bridge's `convert.mjs` as of 11-15. If the bridge re-pins a candidate, this file, the scope and TJ's approval hash change too.
