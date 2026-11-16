# RECHECK-11: the day-of set for the 2026-11-17 pilot (2026-11-15)

Offline and read-only. Nothing outside this review folder and my diary was written. I never ran the reader's live path (`--execute-read-only`), the egress `--run`, or anything against `web/.env.local`. Scratch: `$S/r11`, `$S/mirror11`.

Disclosures:
- My run of the operator rehearsal stat'ed `.env.local` once, through its T−1.4 block (metadata only, no read).
- **One write outside scratch:** that run executed probe v2's real children, which **overwrote** `predicted-runtime.json` in the operator session's scratchpad (`…/46a3f878…/scratchpad/probe-tmp/`). Probe v2 hard-codes that path (B3). The file holds no secret values.
- G3 runs inside the rehearsals may have left empty `mkdtemp` folders under `/tmp`, as the rehearsal header says.
- I found no new `__pycache__` beside `prepare_packet.py` or `nst_lineage.py`.

Read coverage:
- I read in full: the reader's Python, `export_context.cjs`, `production_context.cjs`, the reader RUNBOOK; the operator RUNBOOK, egress, snapshot, attestation and receipt tools; the operator `dress-rehearsal.sh`; probe v2; `check-attestation.mjs`, `deadline-check.mjs` and POST-CAPTURE.
- The plan `1f60bea3`: §1a, §3c and §4 only. ADMISSION-CONTROL: §4–5.
- The bridge `dress-rehearsal.sh` and `rehearsal-inputs.mjs`: **run, not read in full**. I read only the attestation fixture.

## Verdicts

| Area | Verdict | Blocking item |
|---|---|---|
| **A. Request reader** | **DO NOT APPROVE as built** | A1 (High): the pins do not bind the code that runs (`.pyc` files, and unlisted modules in the reader folder). The fix is small, or TJ accepts the residual as custody in the approval wording. Everything else passes. |
| **B. Operator day-of** | **APPROVE, with one condition** | B1: no rehearsal or test suite may run on a slot date, enforced by a date guard or a RUNBOOK rule. |
| **C. Bridge post-capture** | **DO NOT APPROVE** | C1 (High): step 2 refuses every genuine operator attestation, so the documented chain cannot complete after a good capture. |

## A. Request reader (`blsh-request-reader-20261111`)

**Bytes:**
- SUMS `1b4cf130`, RUNBOOK `269ed3d9`, `run_live_read.py` `8f61832c`, `read_only_session.py` `352214a2` and `capture_reader.py` `841f2bb6` all match.
- Scope `c731a79f` pins exactly these local files.
- `CORE.diff` and `SESSION.diff` are accurate: I diffed `upstream/` against the files, and `upstream/` matches the Codex source folder byte for byte.

### A1 (High, blocking as built): the pins do not bind the code that runs

`tree_sha()` (`run_live_read.py:72–82`) deliberately skips `__pycache__`. `-B` only stops Python **writing** bytecode; it still **loads** any timestamp-valid `.pyc` whose header matches the source's mtime and size.

What I showed, in scratch only (`repro/recheck11/reader-interpreter-probe.sh`):
- I copied the psycopg2 tree and planted a `.pyc` for `psycopg2/__init__` that adds a line. The reader's own `tree_sha()` on that copy still gives **`d4f93813…`, the scope pin**. Under `/usr/bin/env -i … python3 -I -B`, the planted code **ran** on import.
- The live psycopg2 tree has 11 `.pyc` files today, and they are what runs: `python3 -I -B -v -c 'import psycopg2'` shows `code object from …/psycopg2/__pycache__/__init__.cpython-313.pyc` (and `extensions`). None of them is pinned.
- The same mechanism applies to `capture_reader.py` and `read_only_session.py`. `check_pins` hashes their `.py`, but a `.pyc` planted in the reader folder's `__pycache__` would load in place of them (shown with a toy module). The folder has none today.
- **Shadowing.** `run_live_read.py:250` puts the reader folder first on `sys.path`, and `check_pins` hashes only the six named files. In a scratch copy of the folder, I planted an unlisted `psycopg2.py`. `--preflight` still printed `preflight_ok`, and importing `read_only_session` ran the plant instead of the driver, **even with** `-X pycache_prefix=/var/empty`. The real folder has no such file today.

**Custody, separate from the pin hole:** `/opt/anaconda3` is owned by `tim`, not root. Unpinned:
- the stdlib;
- the `libcrypto` that `hashlib` uses to compute the pins;
- three `.pth` startup hooks that run under `-I` before line 1 of the reader (`_distutils_hack` is present at start-up).

psycopg2's bundled `libpq`, `libssl` and `libcrypto` sit inside the pinned tree, so they **are** covered.

**Why it matters here:** `bind()` connects as `postgres.<ref>`, the owner role. Read-only is enforced by the client (allowlisted SQL, a `READ ONLY` transaction, a verified `transaction_read_only=on`), not by database privilege. So the integrity of the client code is what keeps the read read-only. By the RECHECK-6 R0 standard (an integrity check that the checked code can defeat), the RUNBOOK's "the anaconda/psycopg2 tree … is pinned" overstates what is verified. A same-user attacker gains no new capability: they can already read `.env.local` and hand-write `request.json`. The finding is about what the pins claim.

**Fix, stated as the property to meet:** every module the reader imports comes from a pinned source file, and the reader checks this **after** import, before it opens the env file. Three parts:
- **No bytecode.** Add `-X pycache_prefix=/var/empty` to both documented commands, and refuse in the pre-import gate unless `sys.pycache_prefix == "/var/empty"`. `/var/empty` is root-owned and empty, so every module, stdlib included, compiles from source. With this flag the planted `.pyc` no longer ran (probe, last line).
- **No shadowing.** Load `capture_reader` and `read_only_session` by explicit path instead of inserting the folder into `sys.path`, or refuse if the folder holds anything outside a fixed list.
- **Origin check.** After the imports, require `psycopg2.__file__` and `psycopg2._psycopg.__file__` to lie inside the pinned tree, and the two reader modules' `__file__` to be the pinned paths.

State the remaining residual (stdlib source, `.pth`) as custody, like RECHECK-9's `sitecustomize` limit.

This changes `run_live_read.py`, so the test receipt and scope hash `c731a79f` change too, and TJ's approval must name the new hash. If TJ prefers, the alternative is to accept A1 as custody in the approval wording.

### A2 (Low): `SHA256SUMS` fails today on `TESTS.log`

`shasum -c SHA256SUMS` fails on `TESTS.log` (sum `9f95424c`, file `746aad72`), so the RUNBOOK's own pre-11-17 check ("every line OK") fails.
- **Cause:** `tests/run_all.sh` copies its log into the artifact folder (and rewrites `TESTS-RECEIPT.json`). `TESTS.log`'s mtime equals `final-verify/reader.log`'s, after the sums were written. The receipt's bytes are deterministic, so `e057b02d` and the scope still hold.
- **Fix:** regenerate the sums, and run the suite from a mirror (as I did) so a rerun cannot change the folder.

### A3 (Low): `load_conversion` takes the class as written

It checks `evidenceClass` and `approvedInputs` but does not re-derive approval from the pins hashes, as `assemble.mjs` does. Its role is timing only, and the read needs TJ's approval anyway.

### Checks that pass

- **Read-only, enforced in code:**
  - `ReadOnlySession.query` allows only the fixed `INIT_SQL`, `META_SQL`, `KEY_SQL` and `PAGE_SQL` strings plus `ROLLBACK`, and checks each one's parameters against the frozen season, dates, page size, sorted unique ids and no params for control statements;
  - the transaction is `BEGIN … REPEATABLE READ READ ONLY`, with transaction-local `SET LOCAL`s and `search_path=pg_catalog`;
  - `validate_meta` requires `transaction_read_only = on` (and the timeouts) inside the transaction before any data query, and again at the end (snapshot drift);
  - the transaction ends in `ROLLBACK`;
  - zero writes is a code property: no write statement is reachable.
- **Bounds, enforced in code:**
  - 1 connection;
  - ≤ 35 dispatches (`MAX_QUERIES`; 10,000 rows uses exactly 35, tested);
  - `LIMIT 10001`, then refuse above 10,000 before any page;
  - byte caps both server-side (`bounded_json_query`) and client-side: 128 KiB key seal, 256 KiB per page, 8 MiB total;
  - time: 5 s per statement, `statement_timeout`/`lock_timeout`/`idle_in_transaction` timeouts, 150 s total, 4 s connect, 2 s close;
  - no retries; a per-packet `O_EXCL` lock, never removed. `packet` is the conversion's basename (`convert.mjs:320`), so the lock stays in `locks/`.
- **Credentials never printed:**
  - `.env.local` is opened `O_NOFOLLOW|O_NONBLOCK` and `fstat`'d (regular, own uid, `0600`), parsed, never sourced, and only after every pin, conversion and window gate;
  - the password goes only into `psycopg2.connect(password=…)`; it is never in argv;
  - driver exceptions are reduced to `errorType` plus `pgcode`; `main()` prints type names only;
  - node runs the export with `PATH` only;
  - the tests assert that a fake password never appears.
- **TLS verify-full, pinned:**
  - `sslmode=verify-full`, with `sslrootcert` = a bundle hash-checked (`50c3011a`) before the connection;
  - host pinned to the session pooler, port 5432, dbname `postgres`, and `ssl_in_use`/host/port re-checked after the connection;
  - `PG*`/`SSL*` env keys are refused, and `~/.postgresql` must not exist (absent today);
  - the project ref and pooler URL are pinned.
- **The `dateFrom` narrowing is justified:**
  - `DATE-FROM.json` derives it from the retained 11-01 capture: the full season projects to 10,727 rows, which is over the cap, and a cap hit is a no-retry stop;
  - 10-14 is 11-11 minus the p99 latest-five span (28 d), covering 99.3 % of players, with 6,948 projected rows and 30 % headroom;
  - if the projection is wrong, the code refuses after the key seal, before any page, so a wrong guess fails closed;
  - truncated windows show downstream as `short_window` (assemble) and `fewer_than_five_captured_records` (gate), so the cost is visible, not silent.
- **Output matches assemble:**
  - `export_context.cjs` enforces the exact request keys from `build_request`, binds the RAW hashes and row counts, and runs the pinned `qualifyCurrentInputs`;
  - `assemble.mjs` reads exactly `profiles[].sourceIds`, `wgo.rows{id,date,player_id,game_id}` and the group rows `{player_id,date_scraped,id}`;
  - the e2e runs the real bridge CLIs: assemble 576 entries, `prepare_packet` 468 witnesses, and the real gate qualifies 234 + 234 on time and 0 on 11-19.
- **The export's two departures from upstream:**
  - the October `DISCREPANCIES.json` binding is dropped. I checked that the output says so (`discrepancyEvidence: "not_bound_in_this_export"`) and that contexts get `discrepancies: []`; that is a disclosed loss of notes, not a gate input;
  - `productionReference.ts` is re-pinned `9a56af85 → ec3afb69`. I confirmed commit `db7a64c58` is +89/−0 on that file, and the node test asserting equal `outcomes`/`FHFH_WEIGHTS` on all 8,135 retained rows passed in my run.
- **Timing:** the read runs after the latest native retrieval, within 12 h of the earliest and inside 11-17T14:05Z–11-19T00:00Z. So the native capture stays the binding earliest evidence, consistent with C's deadline rule.
- **My runs:**
  - the full suite in a scratch mirror gave **71 passed, 0 failed** (Python 44, node 9/9, e2e 18/18), with its three guards unchanged;
  - `--preflight` on the real files gave `preflight_ok`, `packetLocks: []`, exit 0.

## B. Operator day-of (`blsh-pilot-operator-2026-11-15`)

**Bytes:** RUNBOOK `6a03c58d`, plan `1f60bea3`, `egress-connect-check` `c61c7fe7`, `preapproval-runtime-snapshot` `642adbaf`, `operator-attestation` `becd44e0`, `write-authorization-receipt` `5e206059`, `dress-rehearsal` `b01ea793` and launcher `31c370c3` (unchanged) all match.

### B1 (Medium; the condition on APPROVE): rehearsals and suites must never run on a slot date

On 2026-11-17, from about 14:02Z (when T−0 G3 creates `attestation/`) to 14:05:00Z, two tools would run the real launcher on the real clock, and it would get past its window gate.

**`dress-rehearsal.sh`, step L.1.** It runs the RUNBOOK start line verbatim. Only the log path and the receipt path are moved to scratch, and the rehearsal's own receipt is format-valid (`approvalReference` `REHEARSAL.not-an-approval`). By code, the launcher would:
1. pass gates 0–4;
2. take the **real** lock (`LOCK_PATH` is a constant);
3. read the **real** `.env.local`;
4. run G3, then exec the real bootstrap `--run` with the scratch receipt.

`readAuthorization` checks only format and constants, so the **real capture would run under a rehearsal receipt**, and the operator's real start would then refuse `launcher_lock_exists`.

**`test-nst-pilot-launcher.py`.** Its real-`main()` case and its `script()` cases use the real `LOCK_PATH` and `ENV_FILE`, with a `{}` receipt. In the window, the first of them would certainly **take the real lock and read the real `.env.local`**, which consumes the pilot: the operator's start then refuses `launcher_lock_exists`. Each case has `timeout=30`, and the launcher sleeps until 14:05:05Z, so the child is usually killed mid-sleep, with no exec. An exec (which the bootstrap would refuse on the `{}` receipt) happens only if the case starts late enough to finish G3 inside 30 s.

**Condition:** add a date guard to both scripts that refuses on 2026-11-17 and 2026-11-18 (UTC), or a RUNBOOK rule ("no rehearsal or suite runs on a slot date"), before A2. Neither script is the launcher, so `31c370c3` is unaffected. The 1118 variants have the same exposure on 11-18; that belongs to the fallback reviewer.

### B-note: T−1.1 is a second production DB touch

The admission recheck (RUNBOOK T−1.1, ADMISSION-CONTROL §4) runs one SQL batch on production through the Supabase MCP `execute_sql`, so the reader is not the only lane that touches the production DB. I read the SQL: `begin transaction read only`, 3 s/1 s timeouts, SELECTs on `pg_proc` (name, `md5(prosrc)`, arguments, ACL, config) for three functions, plus one boolean from `nst_job_control`, then `commit`. It is read-only and catalog-only, and needs its own approval (A0). My B approval covers the RUNBOOK's handling of it, not the run itself.

### B2 (Low): `check` does not order the G3 runs against the exec

`operator-attestation.py check` does not require T−0 to end before the exec `atUTC`, or T+0 to start after `capture.endedAtUTC`. The bridge's check orders only T−0 against T+0. Custody only.

### B3 (Low): doc drift

- **Plan §1a, gate 7** says the launcher "writes G3's stdout line verbatim to the log", and **§3c** calls `g3Line` "its verbatim G3 line". The launcher actually logs a wrapper, `{"launcher":"g3","exitCode":…,"stdout":"<G3 line>"}` (`nst-pilot-launcher.py:131`). This ambiguity is the root of C1.
- **§3c** also still says nothing in the bridge reads the attestation.
- **§1a** still cites tests `2c01f08a` and probe v2 `bf39d6ae`; they are now `d90999ec` and `dabbbd5b`.
- **Probe v2** hard-codes `SCRATCH` as another session's scratchpad, so every run (rehearsals included) writes `predicted-runtime.json` there.
- The snapshot tool says it "loads no npm package code", but its documented `execArgv` preloads ts-node/typescript. That is by design, at T−1 and credential-free.

### Checks that pass

- **Egress, connect-only:**
  - `tls.connect` with `rejectUnauthorized`, using Node's bundled store (refuses if the default store ≠ bundled, or on any override key or `execArgv`), one attempt per host, 5 s;
  - `destroy()` on `secureConnect`; no write call, no ALPN, so no HTTP bytes;
  - my run of the loopback tests gave **13/13**, including "application bytes received = 0" and "only a TLS ClientHello was sent".
  - Informational: Node's happy-eyeballs may try more than one address per host, still with no HTTP.
- **Runtime snapshot:** credential-free (the two secrets are not in its env), with names and versions only; it exits 0 only if there are no overrides and the origin is pinned.
- **Attestation (`becd44e0`):**
  - `write` uses `O_EXCL` and never overwrites;
  - `check` takes the candidate from its argument, recomputes both G3 verdicts from the verbatim stdout, unwraps the launcher's G3 line correctly (`go.get("stdout")`), and binds `argv0 = /usr/local/bin/node`, `cwd` = canonical `web/`, exec time in `<date>T14:05:00–14:05:50Z`, the 8-key allowlist, interpreter, DYLD and shell count;
  - the CLI cannot relax these; only the `expect` seam can.
- **Receipt writer:** it mirrors `readAuthorization` in bootstrap `dbf69c47` field for field. I compared it with the bootstrap source (14 keys, the scope constants read from the source, ID regex, time not in the future, `O_EXCL|O_NOFOLLOW`, `0600`, ≤ 16 KiB). It is stricter on dates, which fails closed.
- **Probe v2 `dabbbd5b`** (changed and not in Chef's list, so I read it in full because it parses the real `.env.local` at T−1):
  - the two secrets never reach a child (`child_env` holds the URL and lifecycle only; the snapshot gets booleans);
  - the output is enums only, and it refuses to print if any secret of 8 or more characters appears in the report.
  - Low: no isolated-mode self-gate (the documented command has `-I`), a hard-coded scratch path from another session, and no file-hygiene check (T−1.4's `stat` covers that).
- **My runs:**
  - `dress-rehearsal.sh … 1117`: **25 PASS, 2 SKIP, 0 FAIL**, with no real path created;
  - launcher suite: **49/49**, no fake secret seen;
  - egress loopback: **13/13**.

## C. Bridge post-capture (`blsh-evidence-bridge-2026-11-15/post-capture`)

**Bytes:** SUMS `696df82c` checks **39/39 OK**. POST-CAPTURE `4f61df4c`, `check-attestation` `2434276a`, `deadline-check` `6ebc63f7` and `dress-rehearsal` `c0c752b3` all match.

**Core changes since RECHECK-10:** `convert.mjs` and `assemble.mjs` now require an explicit `--candidate`. `approvedFor("v5")` is the unchanged `APPROVED`, so `--candidate v5` accepts only the v5 pins. `frames.mjs` `8b57ffbf` and the tool `aa8a9cb7` are unchanged. The new `v5-1118` entry, the vendored `approved/v5-1118/` and `proposed/` are left to the fallback reviewer.

### C1 (High, blocking): step 2 refuses every genuine attestation

- **The producer.** The launcher logs `{"launcher":"g3","exitCode":0,"stdout":"<G3 JSON line>"}` (`nst-pilot-launcher.py:131`), and `operator-attestation.py` stores that line verbatim as `launcher.g3Line`.
- **The consumer.** `check-attestation.mjs:66–68` parses `g3Line` and reads `dependencyTree`, `treeSHA256`, `loaded` and `differences` at the **top level of the wrapper**. They are not there, so it refuses `launcher_g3_line_not_match`.
- **Shown** (`repro/recheck11/attestation-shape.sh`): I ran the operator's own tool, through its dress rehearsal (real launcher code and log format, real G3), and fed the resulting `OPERATOR-ATTESTATION.json` to the bridge check. Result: `{"ok":false,"refusal":"launcher_g3_line_not_match"}`. A scratch copy whose only change unwraps the line (parse `stdout`, require `launcher:"g3"` and `exitCode:0`) returns `ok:true` on the same file. So that is the only shape mismatch.
- **Why the rehearsal misses it.** `rehearsal-inputs.mjs:38` builds `g3Line: G3_STDOUT`, the raw G3 line, which is not the launcher's format. B2 therefore passes 28/28.
- **Consequence.** Step 2's refusal quarantines the packet ("no conversion at all"), and every stop is final. A good capture would be blocked at step 2 until a reviewed fix lands, and the fix would have to land inside the 24 h deadline (about 11-18T14:05Z).
- **Fix:**
  - unwrap the launcher line in `check-attestation.mjs`;
  - build the rehearsal's attestation with `operator-attestation.py write` from launcher-shaped files, or at least the exact wrapper, so B2 tests the real contract;
  - re-sum the bridge.

### C2 (Medium): step 2 does not bind the exec line to the real capture

The bridge check does not check `argv0`, `cwd` or the exec time. My scratch-patched check accepted an attestation whose exec line has a **stub** `argv0` and a **fake** `cwd`. The operator RUNBOOK §4 says Chef runs `operator-attestation.py check` before `convert.mjs`, and that check does bind all three. But POST-CAPTURE never runs it, so the two runbooks disagree.

**Fix:** add `operator-attestation.py check --candidate v5-1117 <ATT>` as step 2b (both must accept), or carry the same bindings into `check-attestation.mjs`.

### C3 (Low): step 4 and "CLI gaps" #1 are stale

They still say nothing produces the request and contexts. They should point at the reader RUNBOOK command: run right after step 3, about 14:10Z, with its 12 h ceiling and its own approval. The reader RUNBOOK's limit #7 already asks for this.

### Checks that pass

- **`deadline-check.mjs` matches the gate's real rules.** I read them in `currentProcessEvidence.server.ts` `e69db2c0`, lines 129 and 201–214:
  - `asOf ≥ request.asOfUTC`;
  - chronology: frame date ≤ `completedBy` date, and `completedBy` ≤ native and ≤ frame;
  - native, frame and captures ≤ `asOf`;
  - `asOf − earliest(native, frame, calendar, wgo, group feed) ≤ 24 h`, inclusive;
  - `today − record date ≤ 7 d`, inclusive. The check's `date + 8 d − 1 ms` is the same rule.
  - It is stricter than the gate in one way, so it fails closed: it uses one global earliest over both groups and all frames.
  - For the 11-17 slot the 24 h rule binds, about 11-18T14:05Z, because the reader's capture comes after the natives.
  - The boundaries are rehearsed against the real gate: on time and at exactly the deadline it passes; 1 ms late the first group drops out; 1 h late, both are 0.
- **The rest of the chain fails closed:**
  - verify, then attestation, convert (approved inputs only), acquisition (fixed path, 0 retries), frames (reviewed tool only), deadline, assemble, prepare and propose (`reviewSHA256: null`, never installable);
  - every non-zero exit is a stop, and synthetic markers never reach a reviewer.
- **My runs:**
  - `dress-rehearsal.sh … v5`: **28/28**, with both guards unchanged;
  - the 21-test bridge suite in a fresh scratch mirror: **21/21**, with v5 pins, the usual scratch-only `WEB` edit, and a temporary `.git` pointer for test 14, removed afterwards. Canonical sums are still 39/39.

## Repository state

- HEAD is `2c1cd633d`. The v5 successor is committed in `348a122d6`, an ancestor of HEAD, and `web/scripts/blsh` is clean.
- The three lane folders are untracked and unchanged by me.
- No `fhfh-blsh-*` directory exists under Application Support, and there is no `attestation/` folder.

## Reproducers

- `repro/recheck11/reader-interpreter-probe.sh`: the A1 pin hole, the `.pth` hook and the `/var/empty` fix.
- `repro/recheck11/attestation-shape.sh`: C1, including the one-line scratch fix.
