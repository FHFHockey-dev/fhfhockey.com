# Diary: BLSH request reader for 2026-11-11 (Claude, 2026-11-15)

## Scope
Offline-rehearsed reader that produces a fresh CURRENT-REQUEST + CONTEXTS covering 2026-11-11 for the
evidence bridge's assemble.mjs (POST-CAPTURE step 4). No live DB read: the one live read needs TJ's approval on 11-17.
Parent: Chef (local_56526db8). Source (read only): Codex current-refresh-reader-20261101-01.

## Where
- Folder: tasks/artifacts/blsh-request-reader-20261111/ (branch octoberBranch, nothing committed).
- Upstream copies (verbatim, for diffing): upstream/.

## Log
- 2026-11-15: oriented. Retained capture: 8,135 WGO rows 09-29..10-31, 226 games, <=36 rows/game.
  11-01..11-11 = games 227..298 (72 games) => ~2,592 more rows => ~10,727 total > 10,000 cap. dateFrom must narrow.
- p99 latest-five span for players active 10-30/31 = 28 days => dateFrom 2026-10-14 (11-11 minus 28 d).
- productionReference.ts drifted from Codex pin (9a56af85 -> ec3afb69, commit db7a64c58 = +89 lines, additive).
- Consumers (assemble, intake, prepare) read only profiles[].{playerId,name,sourceIds,shots}.
- Count-only grep + stat on web/.env.local (no value printed): 1 SUPABASE_DB_URL line, mode 600 uid 501.

## Next
Core copy -> session/launcher -> export -> tests -> RUNBOOK -> SHA256SUMS -> report.

## Checkpoint (2026-11-15 ~21:30Z): deliverables complete, offline only
- Core 841f2bb6 (dates only vs 9b5a9550); session 352214a2; wrapper run_live_read.py 4e04a2ae; export 4aceb573;
  production_context 198fe2a7 (verbatim); scope LIVE-READ-SCOPE.json 47ba2ca2; receipt 3db284fd; SHA256SUMS d4c0dbf0 (27 files).
- Tests: bash tests/run_all.sh <scratch> -> 71 passed / 0 failed (python 44, node 9, e2e 18).
  E2E on bridge real CLIs (--candidate v5): assemble proposedEntries 576 for 11-11; prepare 468 witnesses; real gate 234+234.
- Real preflight: pins + receipt pass; stops heavy_lock_held (stale empty /private/tmp/fhfh-heavy.lock, created 13:18, not ours).

## Gotchas
- Bridge lane edits live: --candidate became required mid-work; post-capture/proposed/ appeared during an e2e run
  (bridge guard flaked once; rerun clean).
- productionReference.ts drift: re-pinned with an equivalence test (outcomes/weights equal on 8,135 rows).
- -I drops the script dir from sys.path: wrapper inserts ROOT only after hash-checking the modules.
- Any edit to a LOCAL_PINNED file needs: run_all.sh -> make_scope.py -> update SCOPE in RUNBOOK -> SHA256SUMS.

## Next / pending
- TJ approval of the single read (RUNBOOK wording) on 11-17; credential-pattern approval; heavy-lock owner.
- Bridge lane: point POST-CAPTURE step 4 at RUNBOOK.md.

## Checkpoint (2026-11-15 ~21:45Z): review fixes (supersedes the hashes above)
- Dropped the /private/tmp/fhfh-heavy.lock gate (mkdir convention for heavy local jobs; a stray empty file from another
  job sat there 11-15 and would have blocked the read). Export: schedule shortfalls now reported; stops only if no 11-11
  row is in a scheduled game or neither NST group has a row.
- Hashes: run_live_read.py 8f61832c; export_context.cjs 7b8f2df5; capture_reader.py 841f2bb6; read_only_session.py 352214a2;
  scope c731a79f; receipt e057b02d; RUNBOOK 269ed3d9; SHA256SUMS 1b4cf130 (27 files).
- Tests 71/0 (python 44, node 9, e2e 18). Real preflight: preflight_ok. Exact RUNBOOK command vs scratch conversion:
  outside_read_window, no lock/output. No writes found in prep/intake/lineage/Codex folders.
- web/ shows rebuild-score edits that were not present at session start; not this lane's (web/ only read).

## Checkpoint: RECHECK-11 §A fixes (ticket from Chef; supersedes hashes above)
- A1: entry refuses unless sys.pycache_prefix == /var/empty (root-owned, empty); capture_reader/read_only_session executed
  from hashed source bytes (no sys.path insert, no .pyc); reader root must be the pinned path; check_import_origins after
  import, before env file (stdlib / pinned psycopg2 tree / two pinned files; startup .pth modules recorded as custody).
- A2: run_all.sh writes TESTS.log/receipt to scratch only; tests/publish.sh copies a green receipt, re-derives scope + SUMS.
- A3: --candidate required; conversion approval re-derived from pinned CANDIDATES (pins/verifier/node/lineage, packet).
- DB role: no read-only login role in supabase/migrations, migrations, sql, web/supabase (test-only roles only).
- Hashes: run_live_read.py c23eb286; scope d84a9547; receipt c6a8c5fc; RUNBOOK 8e27a427; SHA256SUMS 90190ca1 (28 files).
- Tests 77/0 (python 50, node 9, e2e 18). Real preflight preflight_ok (custody: __main__, _distutils_hack, zope).
- Probe: copy preflight -> bytecode_cache_not_disabled (probe flags) / reader_root_not_pinned (documented flags).
