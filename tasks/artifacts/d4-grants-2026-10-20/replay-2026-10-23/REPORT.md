# D4 local replay: the 99-entry chain, ending 89 then 90 (2026-10-23)

Claude, in a validation lane for the Codex sprint (request relayed by TJ). **Local only.** I made no hosted
Supabase call (no reads, no writes) and ran no git mutation. I edited no application file, migration or
`migration-authority.json`. Every file listed here is untracked, and Codex commits them.

## Result

**Passed.** The chain replays cleanly on a disposable PostgreSQL 17.11 cluster in four orders, and each
order behaves as expected. The independent review's open runtime gate is closed by the *reviewed*
harness bytes: run v10 is green, and the negative run v11 fails as intended and exits 1.

| Run | Order applied | TAP suites, ok / not ok | Fixture | Runbook SQL, run locally | Final ACL snapshot | Expectation |
|---|---|---|---|---|---|---|
| [positive](run-positive/receipt.json) | 1–88, **89, 90**, 91–99, then 89–90 re-applied | grants 1870/0 · defaults 34/0 · rso 10/0 · claude 205/0 · replay-checks 287/0 | exit 0 | P2 0 missing · Q1 0 · Q2 1 row, no PUBLIC · Q3 0 mismatches | `28cf4a7d…`; re-apply identical | **met** |
| [negative](run-negative/receipt.json) | 1–88, 91–99 (no 89/90) | 1732/138 · 0/34 · 10/0 · 84/121 · 144/143 | exit 0 | P2 0 · Q1 33 · Q2 0 rows · Q3 **138** | `e42f64a8…` | **met**: D4 assertions fail |
| [reversed](run-reversed/receipt.json) | 1–88, **90, 89**, 91–99 | all green, same counts as positive | exit 0 | same as positive | identical to positive | **met** |
| [after-head](run-after-head/receipt.json) | 1–88, 91–99, **89, 90** (hosted order) | all green, same counts as positive | exit 0 | same as positive | identical to positive | **met** |
| [v10](../run-v10/receipt.json), reviewed `harness.py` | 1–88, 89, 90, 91–99, re-apply | 1870/0 · 34/0 · 10/0 · 205/0 | exit 0 | — | identical to positive | passed, exit 0 |
| [v11](../run-v11/receipt.json), reviewed `harness.py`, `D4_NEGATIVE=1` | 1–88, 91–99 | 1732/138 · 0/34 · 10/0 · 84/121 | exit 0 | — | identical to negative | exit 1 (per the review) |
| reviewed `harness.py` on a reversed pair, `--check` | — | refused: `provide exactly D4 defaults then reviewed grants` | — | — | no run directory created | exit 1 (per `test_harness.py`) |

For every run: the applied order equals the plan, the cluster stopped, the data and socket directories
were removed, and `/private/tmp/fhfh-heavy.lock` was released. The server logs have no ERROR or FATAL
lines. **No blocker:** the `initdb` shmget denial from Codex's v9 run did not reproduce in this session.

## 1. Inputs and the chain check

- Checkout: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD `2a5092d37`. The working tree
  is dirty, with Codex-owned changes, and was left untouched.
- Registry `tasks/TASKS/repository-audit-remediation/migration-authority.json`, sha256 `5fd21910…c35a`.
  This equals `registry_sha256` in
  [`MIGRATION-INVENTORY.json`](../../release-integration-2026-10-23/MIGRATION-INVENTORY.json), which
  reports 99 registered, 99 active, no unregistered, no missing and no hash mismatches.
  - 99 rows with contiguous orders 1–99. Every sha256 matches the file.
  - The working-tree `supabase/migrations/*.sql` listing equals the registry order, which is also
    filename order.
  - States: 66 applied, 28 unknown, 5 pending. The pending orders are 71, 77, 88, 89 and 90.
- **The harness's chain check already handles 99 entries.** `harness.py … --check` reports
  `chainFiles 99`, D4 at orders 89–90, a suffix of 91–99 and 108 hashed inputs; `test_harness.py` passes
  6/6. No harness edit was needed. The "91–97" in the repair report and README is now only stale wording.
- **Sandbox billing `20261021210000_in_season_sandbox_billing.sql` is on HEAD but deleted in the working
  tree, so it is outside the chain replayed here.**
  - Evidence: `git ls-tree HEAD` shows blob `58c92d3c`, added in `fd58ba245` ("10-22 sync").
    `git status` shows ` D`.
  - It is in neither the HEAD registry nor the working-tree registry.
  - So at HEAD the folder holds 100 files against 99 registry rows. The first assertion in
    `supportedBaselineMigration.test.ts` (directory listing equals the registry) holds only with the
    uncommitted deletion. That deletion is Codex's to commit.

## 2. Environment and deviations

- **PostgreSQL:** `postgres (PostgreSQL) 17.11 (Homebrew)`, from `/opt/homebrew/opt/postgresql@17/bin`.
  Hosted is Postgres 15, per [LEDGER.md §11](../../forge-continuation-2026-10-17/LEDGER.md).
- **Cluster setup:** `initdb -U postgres -A trust --no-locale -E UTF8`, owned by `tim`.
  - Socket only (`listen_addresses=''`), on a random port from 55000 to 63999. Each receipt records its
    port.
  - My driver puts the data directory under the session scratchpad
    (`/private/tmp/claude-501/…/scratchpad/fhfh-d4-<mode>-*`). The socket goes in a private
    `/private/tmp/fhfh-d4s-*`, because the scratchpad path is 112 bytes, longer than the macOS socket
    path limit.
  - The reviewed harness (v10 and v11) uses its own `/private/tmp/fhfh-d4-*`.
- **Receipted deviations,** the same as the reviewed harness:
  - The six unavailable extensions are stripped from the baseline and replaced by the `bootstrap.sql`
    stand-ins (Supabase roles, auth, storage, cron, net and vault).
  - The PG17 view-md5 guard in `20260731040341` is skipped.
  - Synthetic cron rows are seeded before `20260909161959`.
  - pgTAP is replaced by `pgtap-shim.sql`.

## 3. Commands, exactly as run (from the repository root unless noted)

```sh
python3 -I tasks/artifacts/d4-grants-2026-10-20/test_harness.py                       # 6 OK
python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v10 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql --check
python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v10 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql             # exit 0
D4_NEGATIVE=1 python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v11 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql   # exit 1
python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v12 20261020224600_data_api_reviewed_object_grants.sql 20261020224500_data_api_explicit_default_privileges.sql --check     # refused, exit 1
python3 -I tasks/artifacts/d4-grants-2026-10-20/replay-2026-10-23/make_hosted_sql.py
S=<scratch directory outside the repo>
for m in positive negative reversed after-head; do
  python3 -I tasks/artifacts/d4-grants-2026-10-20/replay-2026-10-23/replay.py "$m" "$S" --check
  python3 -I tasks/artifacts/d4-grants-2026-10-20/replay-2026-10-23/replay.py "$m" "$S"   # each exit 0 (expectation met)
done
# From tasks/artifacts/d4-grants-2026-10-20: each pair below compared byte-identical.
cmp replay-2026-10-23/run-positive/acl-final.csv replay-2026-10-23/run-reversed/acl-final.csv
cmp replay-2026-10-23/run-positive/acl-final.csv replay-2026-10-23/run-after-head/acl-final.csv
cmp replay-2026-10-23/run-positive/acl-final.csv replay-2026-10-23/run-positive/acl-after-reapply.csv
cmp replay-2026-10-23/run-positive/acl-final.csv run-v10/acl-after.csv
cmp replay-2026-10-23/run-negative/acl-final.csv run-v11/acl-after.csv
```

`replay.py` exits 0 when a mode meets its expectation; for `negative`, that means the D4 assertions
failed. Its first-pass receipts were discarded and re-run once the runbook SQL checks were added, so
every receipt here binds the final script hashes.

## 4. What each check proves

- **Effective privileges of anon, authenticated and service_role on the reviewed objects.**
  - `data_api_grants.sql` passes 1870/1870: 76 tables × 3 roles × 7 operations, RLS on all 76, 46 RPCs
    × 3 roles, no PUBLIC EXECUTE on any of them, the sequence, the private schema, and the
    DEFINER/INVOKER boundaries.
  - `data_api_grants_claude.sql` passes 205/205. It runs real statements under `SET ROLE`: native-head
    CAS, provider-linkage owner RLS, the RSO schedule, TRUNCATE denial and future objects.
  - The local run of the runbook's postcheck Q3 finds 0 mismatches against the same matrix. Without D4
    it finds exactly 138, the same as the matrix's 138 not-ok.
- **Default privileges for objects created after 89.**
  - `data_api_grants_defaults.sql` passes 34/34.
  - `replay-checks.sql` sections 1–2 add the following. `pg_default_acl` has no postgres-in-public
    entry for any Data API role. The global function default for postgres is owner-only. A serial
    table, an identity table, a sequence, a view, a materialized view and functions in public and in
    a new schema, all created after 99, get nothing. They raise 42501 under anon, authenticated and
    service_role. An explicit GRANT restores only the operation granted.
  - Without 89/90, 128 of those checks fail: the postgres defaults still grant ALL to all three roles.
- **In-season narrowing.**
  - `in_season_grants`: service_role SELECT only. `in_season_workspaces`: service_role SELECT, INSERT
    and UPDATE only. Neither table has a browser or PUBLIC grant.
  - `replay-checks.sql` section 3 confirms it with SET ROLE. Service-role INSERT, UPDATE and DELETE on
    grants raise 42501, as do DELETE on workspaces and TRUNCATE. Insert and update on workspaces
    succeed.
  - Without 90, 15 of those checks fail: service_role keeps DELETE plus the TRUNCATE, REFERENCES and
    TRIGGER defaults.
  - The browser-isolation suite (`data_api_grants_rso_isolation.sql`) passes 10/10 with or without D4.
    Migration 76 already revoked browser access.
  - The current in-season callers use only select, insert and update (`web/lib/in-season/server.ts:33`,
    `web/pages/api/v1/roster-schedule-optimizer/workspace.ts:53,113,140,150,155`,
    `diagnostic-context.ts:64`). That fits the narrowed grants.
- **Objects created around D4 (orders 88, 92, 95, 97 and 98).** `replay-checks.sql` section 4 passes in
  every mode, including negative.
  - Each of those migrations revokes and re-grants explicitly.
  - Their local ACLs match the hosted readbacks recorded in the registry, e.g. the order-97 ledger table
    has service_role SELECT, INSERT and UPDATE, and the order-98 sequence has USAGE only.
- **The ACL delta is independent of order.**
  - In every D4 mode, D4 removes the same 174 entries: 140 service_role relation privileges and 1
    service_role function privilege across 31 objects, plus 33 postgres-in-public default entries (11
    each for anon, authenticated and service_role).
  - It adds exactly one entry: postgres's owner-only global function default.
  - The negative final snapshot differs from the positive one by exactly those 175 rows. This matches
    the historical v7 receipt (174 removed, 1 added).
- **Out-of-order application (90 before 89)** gives byte-identical ACLs to 89 then 90. Migration 90
  creates no objects, and 89 only shapes objects created later.
  - The "89 then 90" rule is a ledger-ordering contract. The reviewed harness enforces it by refusing a
    reversed pair.
  - The only real exposure from reversing them on hosted is an object created by postgres in public
    between the two applies, which would still get the old defaults.

## 5. Ordering and version compatibility with the hosted head

**Facts.**
- The 89/90 file versions are `20261020224500` and `20261020224600`.
- The hosted ledger head is `20261022181002`: registry order 99, whose stateEvidence reads "Production
  ledger version 20261022181002 … applied 2026-10-22".
- Orders 91–99 are each recorded as Production ledger versions applied on 10-21 or 10-22. Orders 88–90
  have no hosted receipt.
- So the 89/90 versions sort before nine hosted versions.

**Option A: `apply_migration` (the repository's established method). It records new versions, so no
rename is needed before the apply.**
- Evidence that the tool cannot keep a file's version:
  - [`super-goal-context-diary.md` entry 0870](../../../TASKS/super-goal/super-goal-context-diary.md):
    the connector recorded `20260731220635` for local `20260730200000`.
  - [`security-rpc-rollout-runbook.md:468`](../../../TASKS/repository-audit-remediation/security-rpc-rollout-runbook.md):
    "`apply_migration` cannot select the original version".
  - `task1-single-statement-verification.json:528`.
- The house method ([CHEF-REGISTER-2026-10-19.md:38](../../../sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md),
  LEDGER.md §11): read-only preflight, body without `BEGIN;`/`COMMIT;`, `SET LOCAL`, postcheck, then
  "rename the local file to the ledger version". Registry orders 85, 87, 92 and 95 record such renames.
- If 89 and then 90 are applied this way, the hosted ledger gets two new versions above
  `20261022181002`. The repository then needs these changes:
  1. Rename both files to the recorded versions. The bytes, and so the sha256 values, stay unchanged.
  2. **Reorder the registry.**
     - `supportedBaselineMigration.test.ts:61-73` requires the directory listing, the registry order and
       sorted filenames to agree, with order = index + 1.
     - So the two D4 rows move to orders 98–99, current orders 91–99 become 89–97, and 88 stays.
     - On both D4 rows: change the path, set `deploymentState` to `applied`, and add the ledger versions
       and postcheck results to `stateEvidence`.
  3. **Update the test counts.** `supportedBaselineMigration.test.ts:78` goes from 66 to 68 applied, and
     `:88` from 5 to 3 pending. Unknown stays at 28 (`:83`), and rows and names stay at 99 (`:68-69`).
     The test names no D4 file.
  4. **Update the harness positions.** `harness.py:48-51` pins D4 at `chain[88:90]`, and
     `test_harness.py:31-32,42` expects orders [89, 90] with a suffix of 91…. Both must move to 98–99
     with no suffix. `replay.py` pins 89–90 in the same way.
     - The resulting replay order (91–99 before D4) is exactly the **after-head** run above, which is
       proven identical.
  5. Comments that cite the old filenames become stale but harmless. They are in applied migrations 97
     and 98, whose bytes are hash-pinned and must not change, in `data_api_grants_claude.sql:4`, and in
     the README.
  6. Re-run the `MIGRATION-INVENTORY.json` check. 89 and 90 leave its unapplied list, and their paths
     change.
- If 88 is applied in the same window, the same rename and reorder applies to it.

**Option B: keep the original versions (not recommended).**
- `supabase db push` refuses as-is.
  - The CLI's `FindPendingMigrations` (`supabase/cli` `apps/cli-go/pkg/migration/apply.go`, develop at
    `2bdf6c57`, 2026-10-23) puts every unapplied local version older than the remote head into
    `unapplied`. It then returns `ErrMissingRemote`: "Found local migration files to be inserted before
    the last migration on remote database."
  - `--include-all` overrides this, but it applies "all migrations not found on remote history table"
    (CLI reference for `db push`). Here that is at least the other pending files, orders 71, 77 and 88,
    plus any of the 28 unknown-state files whose versions are missing from hosted history.
  - It also stops with `ErrMissingLocal` if hosted history holds versions that are not local.
  - Whether either case applies cannot be known without a read-only `migration list`, which I did not
    run.
- Applying through psql or the SQL editor with a manual `supabase_migrations.schema_migrations` insert
  at the original versions would leave the registry order unchanged. Only states and evidence would
  change, plus the same 66→68 and 5→3 test counts. But that is a different transport, one the
  repository has not reviewed.

**Recommendation:** Option A. Apply 89, then 90, as two separate `apply_migration` calls, then do the
rename and registry reorder above in one commit.

## 6. Hosted-apply runbook for TJ (89 then 90). **Not executed. Each apply needs TJ's separate approval.**

Target: hosted project `fyhftlxokyjtpndbkfse`, from the repository's own records
(CHEF-REGISTER-2026-10-19.md:38, LEDGER.md §11). Apply before **2026-10-30**. Every query below is
read-only except the two applies. Stop at the first unexpected result.

1. **Ledger preflight.** Run these two queries:
   ```sql
   select version, name from supabase_migrations.schema_migrations order by version desc limit 12;
   select version, name from supabase_migrations.schema_migrations
   where name like 'data_api%' or version in ('20261020224500', '20261020224600');
   ```
   Expect the head to be `20261022181002 forge_served_forecast_ledger_market_source`, and the second
   query to return 0 rows.
2. **Catalog preflight:** [`hosted-preflight.sql`](hosted-preflight.sql), queries P1–P5.
   - **P1:** record `current_user` and the server version (expect 15.x).
   - **P2 must return 0 rows.** Many reviewed objects come from migrations whose hosted state is
     `unknown` (Draft Pro 59–62, in-season 76, line snapshots 78…). A missing object makes 90 abort.
     This is the main hosted-only risk; locally P2 returned 0 rows.
   - **P3:** record every default-privilege row. Expect the baseline's postgres-in-public rows for
     anon, authenticated and service_role. Platform rows for other owners, such as `supabase_admin`,
     are outside D4. Note them; they are not modelled locally.
   - **P4:** save the full output as the rollback reference for the 123 reviewed objects.
   - **P5:** ideally 0 rows. Long open transactions would make the 5-second `lock_timeout` fail
     cleanly, and the apply could then be retried.
3. **Apply 89** with `apply_migration`.
   - Name: `data_api_explicit_default_privileges`.
   - Body: the file without its `begin;` and `commit;` lines, keeping the two `set local` lines.
4. **Postcheck 89.** From [`hosted-postcheck.sql`](hosted-postcheck.sql):
   - Q1 must return 0 rows.
   - Q2 must return exactly 1 row with `public_execute = false`. It returned `{postgres=X/postgres}|f`
     locally.
   - Read back the new ledger version:
     ```sql
     select version, name from supabase_migrations.schema_migrations where name like 'data_api%';
     ```
5. **Apply 90** with `apply_migration`.
   - Name: `data_api_reviewed_object_grants`.
   - Body: the file without `begin;` and `commit;`.
6. **Postcheck 90.** Q3 must return 0 rows; it found 0 locally with D4 and 138 without it. Re-run Q1
   and Q2, and read back the second ledger version. P4 can be re-run to record the after state.
7. **Stop and rollback.** A failed apply changes nothing, because the tool runs each apply in its own
   transaction. If Q1, Q2 or Q3 is wrong after an apply:
   - Undo 89 by re-running the baseline's `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
     GRANT …` lines (`20260716112908_production_schema_baseline.sql:44814-44825`) and
     `alter default privileges for role postgres grant execute on functions to public;`.
   - Undo 90 by re-granting from the P4 output, or with the superseded GRANT statements named in 90's
     header.
8. **Repository follow-up for Codex:** the rename, the registry reorder, the 66→68 and 5→3 test counts
   and the harness positions from section 5, recorded with the two ledger versions from steps 4 and 6.
   Then, optionally, a bounded read-only application smoke test within AGENTS.md's budget.

## 7. Not covered by this proof

- **PostgreSQL version:** the replay ran on 17.11, while hosted runs 15. The SQL used is the same in
  both, but PG15 behaviour was not run.
- **API layer:** no PostgREST or JWT HTTP requests were made.
- **Platform-owned objects:** platform default ACLs and platform schemas are not modelled here.
- **The 28 unknown-state migrations:** whether their objects exist on hosted is gated by P2, not
  proven here.
- **Callers:** the caller audit is dated 10-20. Only the in-season callers were rechecked today.
- **Other exposure:** the ~470 other public relations keep their grants (follow-up 3 in the README).

## 8. Artifacts and hashes (all untracked)

| File | sha256 |
|---|---|
| `tasks/artifacts/d4-grants-2026-10-20/harness.py` (reviewed; unchanged) | `7bd2f9803c5feb42c79cb93d671ee87bd6e2c76c3b138172618e508e03e96626` |
| `tasks/artifacts/d4-grants-2026-10-20/test_harness.py` (unchanged) | `e73b8c77bf6acdac9d5a0a23ccc5d45f1b266ffb72e8e4cf05041df416dddc0d` |
| `tasks/artifacts/d4-grants-2026-10-20/bootstrap.sql` (unchanged) | `b285be0db79118488424bc5562dea591b29a6f1ca9506c72fdbfc4dc075956c5` |
| `tasks/artifacts/d4-grants-2026-10-20/pgtap-shim.sql` (unchanged) | `e4548d703c3a7140c6384e105d1b34dd72ad037e697ae8494718968dbd4e65c0` |
| `replay-2026-10-23/replay.py` (new driver) | `fcd77a7b19274253eb1afe5d0151f04d760dd04922b81a4fa9ae5b2b6547ac66` |
| `replay-2026-10-23/replay-checks.sql` (new, 287 checks) | `4126b8411149746b3c360cb94d9d73273496f35485b11f0075c75f349836d5a4` |
| `replay-2026-10-23/make_hosted_sql.py` | `f86e6820f83efd170bbb7e0878a143fdb6f3467022a63bdde94898e2dae334b9` |
| `replay-2026-10-23/hosted-preflight.sql` | `904e66cb77ec50afd45f155d966013a56f77e6d1580218512c383c665228dabb` |
| `replay-2026-10-23/hosted-postcheck.sql` | `43efc293894c8c94cd1815e7790420cc4806dbe7dbadc1f0e26ce4877d7f067b` |
| `supabase/tests/data_api_grants.sql` | `d20ca21d8c4b5a0ce1b56d7cb102a1daf36e8c601f94a210c77dd6b93341424f` |
| `supabase/tests/data_api_grants_claude.sql` | `2f2ce336db5b86a11585d740c78cfd8225c5b1a0b529f70ef1656f5fb0468d20` |
| `supabase/tests/data_api_grants_defaults.sql` | `7d0826371ed177e1ed38471c5dccb5d0e856b2ca842392c8e55789f48dc75371` |
| `supabase/tests/data_api_grants_rso_isolation.sql` | `42793b3bd3c6d08376ea5c9f20ef3ab88d3d31a779d8306a358a50391b0ff97a` |
| `supabase/tests/in_season_access_workspace.sql` | `0c0f209134a6cd604fc3320069703c5f76122b60ad14094b2d902c5fcbe035a2` |
| `migration-authority.json` | `5fd219106624bc33906dd5d6c1308db632b08b8a839e90eacaef4fcac9f6c35a` |
| final ACL, positive = reversed = after-head = v10 | `28cf4a7d3982f495ba3936aebf80f9f0348c0388f20562983388da241ff325f9` |
| final ACL, negative = v11 | `e42f64a891a7810069c2bea6fec05a439ffd48fbce47dfc2ef1f083ffbc84035` |

Run folders: `replay-2026-10-23/run-{positive,negative,reversed,after-head}/`, each holding
`receipt.json`, `log.txt`, `server.log`, the ACL CSVs, `*.tap` and `hosted-sql-local.json`. Also
`../run-v10/` and `../run-v11/`. Every receipt's `sourceSha256` binds all 113 inputs. The 108 inputs
shared with v10 hash identically.

### sha256 of every migration file applied (registry order; all match `migration-authority.json`)

| Order | File | State | sha256 |
|---|---|---|---|
| 1 | `20260716112908_production_schema_baseline.sql` | applied | `27067d2221516be147d5cf71492b1fee3f0fd377d0ccd14e49557931ad1b791d` |
| 2 | `20260716112909_add_line_combinations_source_provenance.sql` | applied | `1b94c3058c59846708a9bdf0a27d321cf96b612c158201e09ca29a55add44c83` |
| 3 | `20260716112910_harden_line_combination_trigger_auth.sql` | applied | `fbf3c5602fa0fe03c5e9ade7eb65ac304c74e739b47ff66ecbebe5447dc589e2` |
| 4 | `20260720105524_add_projection_materialization_transactions.sql` | applied | `04806d4ba5c2d2a832081c41ae599bd0e8617cf22167a4719e4be7878267ffe2` |
| 5 | `20260721013821_enforce_shift_relationship_positions.sql` | applied | `697724b13d6a1f9a34842019840b0247ba984d8f59de504813f9f431c99289c6` |
| 6 | `20260722010355_add_transactional_gamecenter_normalization.sql` | applied | `9200297213357e9edadbd93e19575f3fb41047b4e2812d6ccb359717fe2aa403` |
| 7 | `20260723040553_restrict_legacy_yahoo_player_writers.sql` | applied | `7ed9b0f7ad082170f152c5083ac892d6b10c37f52075ec2f5728bd6a03382c7e` |
| 8 | `20260723113533_make_yahoo_player_writer_atomic.sql` | applied | `0498db1f57e0c0edc6dee436f22d0fbe15e5110c11af63c027a40e34fb4febc9` |
| 9 | `20260723121407_replace_forge_projection_results_atomic.sql` | applied | `e92d355e7223b9f3bbb688ab9cbb28b9966d82c9cefddae1dea9e1faeb6b6848` |
| 10 | `20260725200808_fix_yahoo_player_writer_captured_at.sql` | applied | `51b619a07d2f8462bf9a72f49fced67cbcdab85f702492240702368cf6b012b3` |
| 11 | `20260725220704_reconcile_yahoo_player_key_snapshots.sql` | applied | `92ab89a1487c08c205d699f1118dbaede99803b1dbd89091a3e420cbb91d07fa` |
| 12 | `20260725223034_add_sustainability_version_provenance.sql` | applied | `1d9e19360ad2e0434b1ad206a115d7354a53b3e4749a3397b9517c4b26697204` |
| 13 | `20260725235646_add_normalized_yahoo_ownership_reader.sql` | applied | `9105a54f59084bce36bfcc3f0467a4f4d650f57ea0144d5006061bc55809c5ca` |
| 14 | `20260726000603_harden_yahoo_read_surfaces.sql` | applied | `71089db2bf20dc63115510ac4ed281efd6c1bd78300088fb6b5094ffb61860d3` |
| 15 | `20260728225806_add_sko_prediction_run_control.sql` | applied | `2d5420311dcd448f3eaa72534b9fa99e33229a73ca28c367e1439082646a2635` |
| 16 | `20260728235000_make_game_prediction_promotion_atomic.sql` | applied | `81ca86a180f4eb4acfc4ab173bedc7efae6a17ec437cafda9e72ca970208c95d` |
| 17 | `20260729205048_preserve_sko_model_history.sql` | applied | `740be6d9ae4a324f20677c8e70e19b0e8a7f6dd1ffa5b12abba27367760735d6` |
| 18 | `20260730091500_consolidate_scheduler_ownership.sql` | applied | `b8ecf8e3f62bd4d93e7d59cd0dc8844947d5fb2c2e1f830fe8a6300142ba08e0` |
| 19 | `20260730190000_tombstone_legacy_public_rpcs.sql` | applied | `77abca9d5a9e847299da93bd59bed979b6c9c654116dd476b85fe300fc832391` |
| 20 | `20260730193000_repair_compile_invalid_legacy_routines.sql` | applied | `14c518f3b1a40bc3032541f185e0e0f2ce1e8074c3073158fe2ef6d91e941d70` |
| 21 | `20260730195000_replace_yahoo_game_weeks_snapshot.sql` | applied | `9a2445100b49aed2ee24e775c5e76d728ada2938035a5beda6112857dbfbbf1e` |
| 22 | `20260730200000_repair_utah_wgo_team_identity.sql` | applied | `3f49bed58ec464028180335ccf8d02a2fdcbd09dd18be2493283ba5e3f806af2` |
| 23 | `20260730233451_reconstruct_hosted_analytics_schema.sql` | applied | `ef0da7a1c5f9e407a58e9515ab21e6c9fa80587b3dbb63d3c913c34f197a5c66` |
| 24 | `20260731015416_repair_wgo_player_season_identity.sql` | applied | `d472a84231ae8a02771cb102b73c0d83d6ad21e2c077f05cc0ae4a034ac85738` |
| 25 | `20260731022805_revoke_legacy_yahoo_read_cache.sql` | applied | `6dffefbc2a5be13d1ef083e99d4c9048268d0e95b3c0aa8ecb8d77264d74a734` |
| 26 | `20260731035012_restrict_admin_metadata_views.sql` | applied | `31c8743b8ef7aa3703d4dae8026294e25fa7cec460d068c2a8328dde3c1efb55` |
| 27 | `20260731040341_privatize_unified_materialized_views.sql` | applied | `ce84f2e2e157fa3ee4399f0f2eb495224569e7f598d6a666eb23f4586a292bd9` |
| 28 | `20260801195126_drop_legacy_public_rpcs_after_zero_use.sql` | applied | `9c3c06f206ee6c444edd43db7a80ad9638a52c9a18585020384aebe147252c81` |
| 29 | `20260802163747_add_player_forecast_foundation.sql` | applied | `d56beda964e2806cc5d547775ebf893dd54852676b74fd7721d78f036e97ec29` |
| 30 | `20260804160500_reduce_player_forecast_queue_polling.sql` | applied | `6fe6175c59a8f12e1509febd1ce738926bdbaea73012392f2d0c98ba2ab01399` |
| 31 | `20260805001038_add_player_forecast_rest_of_season_outputs.sql` | applied | `145e02664f78f3d18af8200582ca7d1de8d077c70716838220e8c7d4253b596a` |
| 32 | `20260805002036_add_player_forecast_runtime_feature_rpc.sql` | applied | `59bbbf48b9b39e5c5f0b0ce941cc98abf022a269f323661de045a268f35400da` |
| 33 | `20260805003121_add_player_forecast_runtime_context_rates.sql` | applied | `a50db67edaaa678042839c230c3e6154ec3c397b7bff363dc273690676523263` |
| 34 | `20260813001304_player_forecast_season_v3.sql` | applied | `e229cd1eaa142ff9fbe983d774550c0f8df80e3d27a3ac29ffbc98c1aa12fdc5` |
| 35 | `20260813015112_yahoo_live_draft_companion.sql` | applied | `272781f5425d4da5e465ba4cc7a64c177a3e4374a7c9329cce445b4989d2df3d` |
| 36 | `20260813144701_player_forecast_season_identity_resolution.sql` | applied | `8b035e199ba937fa33e6b149e25d68cd133d2bc7a38ff4f745d6471b10d3f032` |
| 37 | `20260813235143_player_forecast_season_wgo_label_contract.sql` | applied | `1242ff3a0627c074a07b5af52bad6976e13592f963fdfec8bde5bf35d9a5bbc3` |
| 38 | `20260814004505_player_forecast_season_settled_label_reconciliation.sql` | applied | `a83f9c7e0da0104c5849a088bbac0b1614946bea6eb59dfe0a5722413c18b359` |
| 39 | `20260814020808_harden_wgo_game_identity.sql` | applied | `74637e0086c0dbb41125618224eec2c9ee266f5d562843293e54965736a45ab0` |
| 40 | `20260814192101_fantrax_settings_first.sql` | applied | `b23726bba85b1b8896b2f75a194749bec2da20f8f739343e7aea4496d18634d9` |
| 41 | `20260815023132_espn_fantasy_private_beta.sql` | applied | `e28fdfc9d1a67c4b44435a88d067835cd2bf96342047b0ed93f260521aa7ac21` |
| 42 | `20260818150256_player_forecast_season_v4_integrity.sql` | unknown | `54630ea33f3ec28cd42b115bd6e6fd701788e477b27e5f65190e521d94546cea` |
| 43 | `20260820013120_revoke_execute_sql_browser_roles.sql` | unknown | `fb2d6df0e1ea360bb49cc27db443f5924d18654698a25c0f712016703ac4415b` |
| 44 | `20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql` | unknown | `f037ac34a8a698d828ce4bb05210f7ca8964e4891c284f8cc5502a6fc4c3ce2c` |
| 45 | `20260820014700_player_forecast_season_queue_compaction.sql` | unknown | `da5a166ea7fffe8d6305c2e5f431c7dfe7af81d099e38da1cab068c9459ea9cf` |
| 46 | `20260820031500_player_forecast_v4_contract_checksum.sql` | unknown | `8b9899d4225f1d2390db7e67d10bf98d5ddf771d4d9cd61518e0f6ebb904720e` |
| 47 | `20260820041500_player_forecast_v5_contract_checksum.sql` | unknown | `5545f0f6ee8f700b5feb03129dce3af4adf15753d99fc3fabe3b9098c689a3b7` |
| 48 | `20260820050000_player_forecast_v5_team_metrics.sql` | unknown | `a9ee28e70e9151c6e76c0a7b331a3fec5dd3293b104d914389cc93a16421100c` |
| 49 | `20260820052000_player_forecast_copy_on_write_runs.sql` | unknown | `622c3bc88e1e6c0d5364d0088175b433509b9e1db43b246c164492ff7945c05a` |
| 50 | `20260820053000_player_forecast_v5_release_lineage.sql` | unknown | `0fdbb04cd44f7fdea4f9c9a3e7bf3f5c0d780b73b49503f38a987765515d9a27` |
| 51 | `20260824152127_yahoo_live_draft_production_hardening.sql` | applied | `851ba958aafded30e933e6ff2e3063b8b34e14261f351559b5c38cf89bbae621` |
| 52 | `20260826123000_schedule_player_forecast_season_roster_refresh.sql` | unknown | `38f1f001691006509bc55fd33cc99cbdfbfda89fd3cea62761e2319f913dbd14` |
| 53 | `20260826131500_require_editor_for_player_forecast_opening_release.sql` | unknown | `cfa0309ffe272ea3581d8ce5f615fa5da61e71f33f83a7a22bd4b4a5b524cc5f` |
| 54 | `20260826133000_inherit_player_forecast_season_assumptions.sql` | unknown | `fb0f490ecfc2895b36fce25ae51e3f33b5218769668abd1f34129f494a1c9baf` |
| 55 | `20260828130824_start_chart_yahoo_overlay_reader.sql` | unknown | `1bade7c44ca992b199b1bc32002a361606c97c9427405891db622b2284b7776e` |
| 56 | `20260828142331_recent_team_form_nullable_components.sql` | unknown | `f8354ceafd0d230cba8ed2259aeffdfa24e6aa4bdab4526a5a7ef6584e3a5332` |
| 57 | `20260828162000_add_sustainability_repair_versions.sql` | unknown | `1a6f9cec3ff1f3b25d01465bbc72df85efa03eba3e1be9ae79957a2d639fc877` |
| 58 | `20260829161013_add_roster_optimizer_team_game_schedule.sql` | applied | `cd051aae9f20f7479cc2f228f5225daabe93c2237b3d6899b184cf1d8ae06e97` |
| 59 | `20260907143356_draft_pro_foundation.sql` | unknown | `9145cb342b54f5cbcbf221cf5aa69905635ea6e28ff7a537c3f59442242a16e0` |
| 60 | `20260907145602_draft_pro_stripe_fulfillment.sql` | unknown | `00a26afddb431efec9b07238389b51f5fc6e18830f5686586418137c42573d2f` |
| 61 | `20260907182507_draft_pro_saved_drafts_transactions.sql` | unknown | `46a07040a4873343bc30d549fa4ae8f39ea73a8778dc4162f27e4e6b06f3f9b5` |
| 62 | `20260909120000_draft_pro_complimentary_access_codes.sql` | unknown | `500df7a4c165888f9299acb5caabc52cd6c775a677ab19b92abc0b8da26e84fa` |
| 63 | `20260909161959_consolidate_duplicate_nst_and_remove_legacy_rolling.sql` | applied | `cf4c033158b0a329ff8f45554124f26aac0d2b5900fb290e8005c95fa1cee046` |
| 64 | `20260916012353_starter_board_game_revisions.sql` | applied | `b9010cce9b65ce587903e8a7ac489ffe706492f502b0d7b34bbd61ec18b18cde` |
| 65 | `20260916014510_starter_board_news_queue.sql` | applied | `9f808d710c45fd7b82e7b452609f246332bcad762d6cd843236229c0b11c1203` |
| 66 | `20260916023000_starter_board_release_control.sql` | applied | `a5796fadca8673f9bb813adec52a51f5dda8ce36c48f3d5cb78200ef1a8be8ab` |
| 67 | `20260916044919_starter_board_atomic_lineup_capture.sql` | applied | `5b29e8c4337d0e6f0b2d34c421e0f26bbe00327713d9800dcf7cecfb3f34c93a` |
| 68 | `20260916045842_starter_board_operational_reporting.sql` | applied | `5342299a0e898b9013827169fccdcd2e9bae99af46e939827d04865f911d3058` |
| 69 | `20260916052239_starter_board_validation_registry.sql` | applied | `8918c3486c2d28314443cf6e4cb7d816f4a47f9fa9430a6ecb527875b33b92a7` |
| 70 | `20260916060521_starter_board_atomic_goalie_capture.sql` | applied | `2563061e3d283472dda3ad0106557e78c2e15202c23b5b530273e7db016ae1cb` |
| 71 | `20260917133519_mock_draft_adp.sql` | pending | `4220ab13befcd5231d1030a699296525e4d63126c9b06141aeb2c04546df1f04` |
| 72 | `20260919005608_tweet_pipeline_reports_and_review.sql` | unknown | `114e48167426f464f20116c51b017f07fb721797118a5ff28412ed7d4f6abd27` |
| 73 | `20260919005622_nhl_draft_identity_ingestion.sql` | unknown | `06545c5cb77cfc67c3936a60a0edf46fa1acaa621bc843c242ed4307f983003e` |
| 74 | `20260919005852_nhl_prospect_verification_actor.sql` | unknown | `e9fcea6cc6bb9bca54f7fe58ac330051d11aa8097ce2a0d11dba38946cfaa77f` |
| 75 | `20260923184653_fantrax_live_draft_sessions.sql` | unknown | `32f6db7ea409d0fd18084b54684d315d25288f27506dfb04aa92aa1d420dbad3` |
| 76 | `20260927104934_in_season_access_workspace.sql` | unknown | `c905c8fc37a3c5da2260acf6293efbce9dc670f1debe195d074ac49426f201fa` |
| 77 | `20261002021651_forge_local_execution_fence.sql` | pending | `ce793d99684a59d4ee06190dc1bb8327d3e99dc4180a33ba8995bb28769c5d56` |
| 78 | `20261002134400_game_line_snapshots.sql` | unknown | `041a78fd056c53f1624706f18a9f239f05b460456ba0da2fd3f7c4323fd0866a` |
| 79 | `20261002140500_resolve_goalie_unified_game_team.sql` | unknown | `a7beadc4c08f93dbcc4240f67be9c8d54f1cbcc5e37242230a5be6884fdbc872` |
| 80 | `20261004181455_forge_public_revision_reader.sql` | unknown | `dbf2f1cc43adbf79a497e81ae7bff0ef2d2b8d194dc63451b78aa28571edf46a` |
| 81 | `20261011115124_preserve_projection_raw_shift_occurrences.sql` | applied | `5a04e00d6141697a9408165f8451385543fcbba16f258df225cc9c9aa946ebad` |
| 82 | `20261011160000_preserve_nst_pk_fractional_start_rates.sql` | unknown | `57b812b94b41b352a4c709c89622fe9b43480c6e0b9dd2699006d1f14f0140b2` |
| 83 | `20261017183611_native_forecast_catalog_heads.sql` | applied | `e0776d8c20fce6bbff1f6fc225b1707d4258fb30148feaf31724129b6592772e` |
| 84 | `20261019052934_restrict_provider_linkage_browser_writes.sql` | applied | `e3a90e1a3bfd45424c9714f2232fdc1880f6ec25e11196270beb0a1bb89148f7` |
| 85 | `20261019053348_restore_private_token_vault.sql` | applied | `30fce724d3eedbd887126116226a1fa6b227fce2bfd4f1c16fd141478d4ba422` |
| 86 | `20261019172842_accept_html_report_projection_shift_snapshots.sql` | applied | `60039c29fd5c98e27d60414d9bbb5eb550c787744f67448deba371c2cba8ccbb` |
| 87 | `20261019211444_opponent_skater_allowed_by_position.sql` | applied | `70c8fe8ca884da8a4686eac99c289bb82f253fc18d367b65349ee56697afbdfe` |
| 88 | `20261020211500_forge_league_skater_physical_totals.sql` | pending | `b5f86c6bd990d28d5fe31c60782ca8888b0f9248735b2c370fc6e4935ff107a2` |
| 89 | `20261020224500_data_api_explicit_default_privileges.sql` | pending | `60e0ee8f6004d07182c6999fbe34534a2cceb9530cafbd1a0bb868b0fd5ff51c` |
| 90 | `20261020224600_data_api_reviewed_object_grants.sql` | pending | `d6639171292547f1884c8e5f4d23be3dc2998f6e05425c5d95bdb6ce33173c0c` |
| 91 | `20261021145154_drop_rolling_support_payload_gin.sql` | applied | `31d817e79c4258ce406f686e47d9199e91f60eb0f17dfce8b58b2b801b0789aa` |
| 92 | `20261021165413_forge_projection_results_source_run_fence.sql` | applied | `6d48dad663ee976ff53ea4cf7273040b594c046fdcfe9d114490326b60928299` |
| 93 | `20261021172444_rolling_tables_autovacuum_tuning.sql` | applied | `6e0184424a266bbe48318605a001413090b5b41399a9b5720018d60dc0f04a70` |
| 94 | `20261021172445_drop_rpgm_player_date_duplicate_index.sql` | applied | `b3582780f6265d028ad4e527bc194334e2a905c187f58206008b0903355f13ec` |
| 95 | `20261021182129_forge_latest_rolling_rows.sql` | applied | `7f1ef23da246a8f535e4e00a5a3aef33e70f7772f7d502d1baef5e233da70fce` |
| 96 | `20261021185034_drop_unread_rolling_columns.sql` | applied | `4f392329a0f9e2113e2b5d598e0eafbdc90394f7ae6293ec62fedc2eed651ea4` |
| 97 | `20261021230025_forge_served_forecast_ledger.sql` | applied | `825b9d5290c540e0505ba12bee13a39b578c21dfaf8a75e50b1fcbabbb9c6efe` |
| 98 | `20261022133743_route_runner_tables.sql` | applied | `bf8425edd040182d2f2b87092c934e32572a893d429cef18d4a4315ad3c4a109` |
| 99 | `20261022181002_forge_served_forecast_ledger_market_source.sql` | applied | `8a4cdcb3d58afcf1ca36cb6cfecebdc9455109bbb8f05695389a8f6a734b6fa3` |
