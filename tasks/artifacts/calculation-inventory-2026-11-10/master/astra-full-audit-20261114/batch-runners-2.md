# Production artifacts audit, bounded batch 2

2026-11-14 · worker `gpt-6-astra/high` · Chef `gpt-6-astra/xhigh`.

Completed all **17 files / 3,245 lines**, in path order, from the WGO repair through the penalty-shot and power-g5v5 folders. All 17 local files match `89da739cb` byte-for-byte. Combined with batch 1: **23 of 54 files source-audited, 31 pending**. The companion TSV contains 258 symbol/block/file rows, including prior-batch references and explicit pending rows. No application code, repository tests, production data or canonical audit records changed.

Three new provisional findings: two **P1 write-path verification gaps**, one **P2 verifier defect**. These reproduce acceptance of bad evidence; **none proves that the retained production runs wrote a wrong value**. Existing A3-01/A3-02 corrections remain accepted within their established scope.

## Findings

### AFULL-OPS-05 — P1 — Team diff gate can accept missing official evidence and unchecked team changes

- **Location:** `production/penalty-shot-rebuild-2026-11-13/team-refresh.py:99–139` (`diff_problems`), `:185` (`record_diff`), `:292` (`official_for`), `:329` (`main`).
- **Claim checked:** TEAM-REFRESH.md:71–78 requires every difference to be the approved penalty shot, for the two teams, with no other field changes and shooting-team totals checked against the official boxscore. This gate creates the retained diff that later authorizes the write path.
- **Evidence:** exact source at the hash below; `/tmp/astra-prod2-probe.py`, using the existing `test_team_refresh.py::all_games_clean` fixture and unchanged pure gate. Network and subprocess execution were denied.
- **What's wrong:** `official_for` returns `{}` for a missing boxscore. The gate falls back to team IDs found in the diff, and the official check is conditional on `official.get(team)`. Conversely, when official IDs exist, rows for any additional team in the same game are never visited; the whole game's diff list has already been removed from `by_game`, so the final unexpected-game check misses them.
- **Minimal inputs → wrong outputs:** (a) the clean eight-game diff plus `official_by_game={}` → `[]` problems; no official comparison occurs. (b) the clean diff and valid official totals plus one additional row for game `2026020065`, team `999999`, `evenStrength/allScores`, `xgf:1→999` → `[]` problems. Thus an unrelated strength/xG change can enter the approved-diff file and pass later exact-equality replay. Expected: reject either missing official coverage or any row outside the exact two-team set.
- **Suggested fix:** require a complete official two-team identity/totals object for every planned game, including the shooter. Validate every diff row against that identity set before processing deltas; reject foreign/duplicate keys and unknown score states. Preserve the existing original-diff equality gate and exclusive evidence creation. Add both negative cases to the existing test file.
- **Readers affected:** the team summary rebuild approval evidence, its execute/readback path, then stored team summary readers if an erroneous rebuild were accepted. Retained `team-diff-approved.json` has 54 rows, no foreign teams, and passes the current gate; no historical occurrence of either case was established.

### AFULL-OPS-06 — P1 — Derived readback omits conservation for an already-split player

- **Location:** `production/penalty-shot-rebuild-2026-11-13/ps-rebuild.py:109–140`, especially `:125–129`; called by `main:380` before appending the done marker.
- **Claim checked:** PLAN.md:102–112 promises key-by-key player all-situation conservation, unchanged unaffected fields, and resumable/idempotent rebuilding. A transport failure after commit can leave a split game without a local done marker, so the runner may legitimately read split rows as its next baseline.
- **Evidence:** existing `test_ps_rebuild.py` AFTER fixture used as the new baseline; exact pure `readback_problems` executed offline. Same source hash as the release target.
- **What's wrong:** both total conservation and ES/PS reconciliation run only if the before marker is `None`. For a before marker of 1, ES and PS are outside `KEEP_COLS`, so changed player totals can pass while unchanged team totals still match the official record.
- **Minimal input → wrong output:** before equals the existing clean AFTER fixture (all rows marker 1). Change only player 1 `shots_es` from 4 to 103 in after; leave team rows, PP/PK, assists, TOI and official totals unchanged. `readback_problems(..., baseline_ok=True)` returns `[]`. The player's all-situation shots changed from 6 to 105. Expected: an already-split idempotent replay must reject this change.
- **Suggested fix:** check all-situation conservation for both legacy and split baselines. Apply the legacy ES-minus-PS equation only to legacy rows; require exact unchanged split shot/goal components for an already-split baseline, plus appropriate player-to-team consistency. Add an uncertain-write/resume regression with a split baseline, not only completed-game skipping.
- **Readers affected:** derived rebuild completion/done evidence and downstream player strength/all-situation readers if a corrupt response were accepted. The retained eight before/after pairs all pass the current readback, with 38 player rows and two team rows per game; this finding does not allege corruption in those snapshots.

### AFULL-OPS-07 — P2 — Team landing verifier accepts duplicates and does not fail its exit status on mismatch

- **Location:** `production/penalty-shot-rebuild-2026-11-13/verify-team-landing.py:8–21`, especially first-match selection at `:14` and final print at `:21`.
- **Claim checked:** a served verification should establish exactly one matching team row, correct totals/GP and an actionable failure result, consistent with A3-01's strict player/goalie verification standard.
- **Evidence:** inspected source evaluated only with a synthetic `urlopen`, no imports or network, 16 fake responses per scenario. `/tmp/astra-prod2-probe.py` captures the final output and normal completion.
- **Minimal inputs → wrong outputs:** each response has a correct first team row and another row with the same team ID but `sf=999` → prints `ALL_OK`; duplicates are ignored. With only the wrong `sf=999` row, it prints `MISMATCH` but completes normally, so a Python process has exit status 0. Expected: duplicate identities and value mismatches both fail, with nonzero exit status.
- **Suggested fix:** require exactly one matching team row, retain responses, accumulate explicit problems and `sys.exit(1)` on semantic failure. Add offline duplicate/mismatch checks analogous to `verify-landing-strict.py`. Keep the 16-request limit explicit and separately authorized before any future live use.
- **Readers affected:** manual/automated acceptance of team landing receipts. This is separate from the old player verifier, whose A3-01 defect was already corrected by the strict replacement; that closure was not reopened.

## Scripts, safety and definitions

| File / group | Bounds, stops and gating | Resume / evidence | Numeric or scope assessment |
|---|---|---|---|
| WGO repair SQL | Exact 14 IDs, player/date/season/TOI/gp=1 and four-null-state predicates; one DO statement raises unless 14 updates. 10 s statement / 3 s lock timeout. Hygiene SELECT is an operator check, not an automatic branch | Re-run matches zero and aborts atomically; does not repeat writes. Game ID cannot be rolled back to NULL under the enforced constraint; wrong IDs need targeted correction | Identity/year arithmetic is consistent with NHL ID layout; last-20 counts and distinct IDs are separate. Current scrape-time team remains unknown. Source provenance relies on the retained NHL reconciliation; no fresh NHL lookup |
| `ps-rebuild.py` | Default read-only DB preflight; `--execute` required; eight fixed IDs/dates, one call per pending game, concurrency 1, 10 s spacing, 200 s HTTP timeout, route maxDuration180 s. Migration/deployment/manifest and DB/window gates | Exclusive stamped snapshots; done IDs skipped; uncertain response stops. Final loop verifies split markers/team totals. No resume after a partial transport outcome without inspecting it; AFULL-OPS-06 covers the split-baseline gap | Official SOG retained; shootout winner's extra goal subtracted once. Marker-gated all totals; manifest two goals/six saves. Prior-season games excluded from writes |
| `summary-refresh.py` | Dry-run default; explicit execute and optional max-games; two calls/game, 16 total for all eight, 10 s apart, 240 s timeout. Strict body/game ID/partition counts; per-call window/DB/window | Completed games are not baselined again; exclusive before/after evidence; current v1/revision2 heads rewritten, incompatible orphan heads unchanged. No per-subcall resume marker: a stop between player and goalie phases needs manual reconciliation | Individual G/S/iCF/iFF and goalie SA/SV/GA exact PS changes only in allStrengths; exactly one primary score state; onIce/xG/TOI and other players unchanged. `apply_move` treats absent field as zero; baseline data validity is assumed, not a proof of generic null safety |
| `team-refresh.py` | Default is a **real production diff request**, not an offline run; execute needs retained diff, then per-game re-diff before write, 16 requests/eight writes, 10 s spacing, 240 s timeout. Read-only result flags and exact approved-diff equality required | First accepted diff and all stamped evidence exclusively created; done games skipped; no automatic retries. Post-write response compares counts to each other, not explicitly to plan's 140; readback depends on a complete pre-snapshot | Both for/against PS deltas and unchanged strength/xG columns guarded for inspected rows; AFULL-OPS-05. Header's “both teams' SF/GF official” wording is broader than TEAM-REFRESH.md/current gate's shooter SF/GF check |
| `verify-landing-strict.py` | Live default requires separately authorized 24 sequential GETs, 1 s apart; stops on transport/non-200; saves raw response and exits nonzero for problems. `--selftest` is offline | Reads original first baseline and retained post snapshots. Canary pre-refresh ES unavailable is explicitly labeled; no reconstruction of missing evidence | Requires exact unique player row, GP=1 and every expected field. Five selftest scenarios pass. It continues collecting semantic mismatches within budget; JSON decode failure terminates rather than falsely passing |
| Old `verify-landing.py` | Top-level live requests on import; 24 GETs, three per game; no selftest/approval flag | Reads temporary baseline logs; no durable response capture | Existing A3-01 false-pass remains in this superseded file; strict replacement is the accepted checker. Do not credit its old ALL_OK alone |
| `verify-team-landing.py` | Top-level live requests on import; 16 GETs, 0.5 s apart, 60 s timeout | No saved responses or explicit failure exit | Counts/GP compared against fixed official totals; AFULL-OPS-07 |
| Five power diagnostic SQLs | Read-only finite date ranges. EN reconciliation files set 8 s timeout; other queries rely on caller's statement/guard settings. No write or provider requests | Deterministic scalar evidence, not mutation/resume code | gp=1/situation all, inclusive 150-day window and exact stored carry keys; full 17-column manifest, rounded display probes only. EN true5v5 uses1551, no-goalie goals are distinct from five-skater EN. xGA/GA per60 use3600/TOI with NULLIF0 |
| `power-g5v5-loop.py` | **Mutates by default**, as documented; `--preflight` is required for read-only mode. Top-level file reads credentials, opens log and starts DB flow, so never imported. Localhost restricted to preflight; other arbitrary bases refused. Approved 09-29..11-13 is46 dates,32rows/date; CLI range itself is not hard capped | Verified first backup, fresh pre-run backup, 47-key carry manifest; state-derived pending dates rather than done file. Start25min and write15min windows, repeated after DB waits; live cron283 check. 5 s spacing, slow>60 s stop, uncertain outcome stop, no automatic HTTP retry | v4 label/known goalie/cutoff and all carried17columns checked each date; first/sample dry-run equality, Nov12 offense+goalie ±0.05, served labels/values, final all-date/key checks. Same exact known-null comparison; float conversion assumes finite input. Resume checks certify these invariants, not an independent recomputation of every rating |
| Four existing test files | Fully inspected. PS/summary/team modules were AST-loaded as constants/definitions; real runner top-level flow was excluded. Power test already AST-loads only window helpers | Fixtures use temporary output paths and mocked I/O/clock; no real credentials. Network/subprocess functions denied in the harness | **39 tests passed**, including A3-02 exclusive evidence and completed/pending resume cases plus power guard wait crossing the protected window. These are guard/regression tests, not proof that live route implementations have no fan-out |

NST pacing is not applicable to these runners' direct calls: they perform DB/first-party summary work or read retained values. No NST provider URL is requested by the inspected scripts. The data-repair report's separately approved NST re-fetch is outside this 17-file executable set. A future call still needs its exact approval and inspection of the route implementation; read-only/dry-run labels alone are not authorization.

Secrets are read into memory and used in Authorization headers; inspected log calls do not print the secret. DB helpers enforce read-only PGOPTIONS. No secret was loaded during this audit. Raw subprocess error/body snippets can be emitted on failure; this pass does not claim all possible downstream error messages are sanitized. Deployment gates inspect feature-marker strings at a successful production SHA in master history; they are weaker than full source/closure verification, and do not lock the deployment against a later change.

## Retained receipts and historical versus current source

- **WGO:** `data-repairs-2026-11-13/wgo-apply-readback.txt:1–49` records hygiene 0/0, DO completion, all 14 requested repaired identities, and WiGO frames 14/14 and 3/3 with zero bad rows. It agrees with the guarded SQL and REPORT.md:3–11. Transaction rollback/no-op behavior was inspected, not executed in PostgreSQL; no bootstrap was attempted.
- **Derived PS:** all eight `before-<game>.json` / `after-<game>.json` retained pairs were fed to the actual pure readback function with the retained official totals. All returned no problems, each after has 38 player + 2 team rows. `run/run.jsonl:44` records DONE for 8 games. This is an offline retained-state check, not live DB verification.
- **Player/goalie summaries:** all eight IDs are in `summary-refresh.done`; `summary-run.jsonl:59` records the seven-game remainder / 14 calls, zero remaining. Strict verifier's `expectations()` and all five selftest cases pass against the retained files. The canary's original pre-refresh ES remains unavailable, explicitly waived in the strict checker; this known A3 limit is not silently closed.
- **Team:** `team-diff-approved.json` has 54 changed rows and no foreign-team rows; it passes the actual pure gate against fixed official totals. `team-run.jsonl:2` records 1,120 generated rows / 54 diff rows, and `:12` records 8 games / 16 calls DONE. **No `run/team-after*` snapshot exists**, so the current source's full before/after team readback cannot be independently re-executed on retained data. Done markers and route logs are narrower evidence than row-level snapshots. Do not claim the later stamped-evidence implementation produced the older receipts: retained filenames/logs predate A3-02 hardening, even though the current scripts match the audit release target.
- **Power:** retained issued backup and pre-run snapshot are byte-identical, SHA-256 `84d4ac83d69fbf2df5cc38ee85c9f7157e10c732360798bf27139b47ca9d4f8d`. Independently parsed 1,472 unique team/date rows, 46 dates, 32 per date, range 09-29..11-13; carry manifest 47 unique keys. `run/run.jsonl` final receipt records 1,425 v4 + 47 legacy, zero problems, 46 calls DONE. These agree with **PREFLIGHT.md §6**, which supersedes PLAN.md's older preflight description. The current preflight does make a probe, dry-run and served requests; PLAN's old “no route calls” sentence is not the governing contract. No current DB/source-row/model-value comparison was rerun.

Retained log pins: PS run `5154f636504fd2bcef5f4b6c8c023f5454c45b3a0c1851ad669cbd183a764e3d`; summary run `4003ac05191993e492aadd9e16d1b1465d957966ebcf8db4332e894123386bd1`; team run `481c14e25dce84cb7a4c033a54d5e43ce01a361efd1027ca2b5c9056427acc1c`; team approved diff `96bc12cdf7911cb1c550335069d2175a5d1218b506927cb9a01971dad9deaa6a`. Each of the three eight-ID done files has SHA-256 `2275546d7f83f3ac03326e97ecde62f9ecfc7ab5bfb530cca6687eec1a0be568`.

## Checks actually run and remaining limits

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin TMPDIR=/tmp python3 -I -B /tmp/astra-prod2-probe.py
env -i PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin TMPDIR=/tmp python3 -I -B /tmp/astra-prod2-receipts.py
```

Both final commands exited 0. The existing tests' importlib runner loads were replaced with AST-only definitions; test bodies/assertions remain unchanged. Network/process execution was denied in the probe. The strict selftest used its supplied fake fetch; team verifier evaluation used a complete fake HTTP object with imports removed. Retained receipt check loads only reviewed definitions/constants and calls pure checks. No production runner main with real dependencies ran. No provider, DB, browser, app endpoint, PostgreSQL bootstrap, code/test edit or commit occurred.

Probe/output hashes: `c3cce197b8dc98ca2b1564c406e1521cffeb68cf3d63876381a1b0fb465d5801` / `6923f19331ba668fd4d75dbac906743443d1e1ee2d713d8272e5e22e776dd992`. Receipt probe/output hashes: `8140ae6f4cc91cd136ecc6e8d91d81aefd65884a3f7c172542e2f91be7af1e50` / `611d7708cccc952651ec4fa4eb7cfdeab5c4109ed6bb28f331d310b14aca0fd8`. A receipt helper syntax error was corrected; its first subsequent run revealed missing team-after files, which are now explicitly reported rather than bypassed. Temporary probes are not committed regression tests.

Out-of-batch: first-party route/migration implementations and all reader closures; independent power/derived mathematical recomputation; current live deployments, schedules, schema and DB contents; original approval authentication; 31 remaining runner files. Source-only SQL inspection does not establish current applied definitions. No absent receipt or historical waiver has been converted into a pass.

## Cumulative 54-file inventory

Paths relative to `master/production/`. `audited-batch1` means see batch1's symbol ledger; `audited-batch2` is this pass; all others remain pending. Hashes are actual local bytes, compared to `89da739cb`.

| Path | Lines | SHA-256 | Target tree | Status |
|---|---:|---|---|---|
| `codex-adoption/pre-sync/web_lib_projections_startChartPipeline.test.ts` | 1181 | `dbeb76b012f4891588d1213fbf014f95ab6a9fca8fd88f2d026fd5c557edfc19` | absent | audited-batch1 |
| `codex-adoption/pre-sync/web_lib_projections_verifiedForgeReleases.test.ts` | 94 | `a387c66f58c6791cb27d56827fbe9f5044c1cec46413886f7b0f34aeb3d11571` | absent | audited-batch1 |
| `codex-adoption/pre-sync/web_lib_projections_verifiedForgeReleases.ts` | 159 | `862c9106383c8e6e0a3bcdda2dadfbfe09e4bd0402f09d4efbd58d027fc885c9` | absent | audited-batch1 |
| `codex-adoption/pre-sync/web_next-env.d.ts` | 6 | `ced3cb1bdbb8082cae388902481ba6a8a1e454ec7daed6125b368118f06e4a77` | absent | audited-batch1 |
| `ctpi-v2-validation-2026-11-13/ctpi-v2-checkpoints.ts` | 592 | `d3fdb516bddcd414aceeef38a2dc061c041f1cb52eab8eea9e7dfdd5da1ffcf6` | same | audited-batch1 |
| `ctpi-v2-validation-2026-11-13/ctpi-v2-validation.ts` | 983 | `b943845aa6ef6bbf8d9f4d650444788236f3b16e90a21522eda982b2d7877a3c` | same | audited-batch1 |
| `data-repairs-2026-11-13/wgo-legacy-identity-14-rows.sql` | 86 | `1af10085dcdbd7a771c382fb2be38a696c353cf9232763111532523b02076b7f` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/ps-rebuild.py` | 403 | `b6fbc6cb91da7ef0ff697a48640ba63643efdc7dfd21ca65579bd8d1b83d0910` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/summary-refresh.py` | 503 | `eba89e149346cb5000fe2342390b72645378c3fba21a6963ef6e9f13b0e88749` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/team-refresh.py` | 408 | `4c5ec17bd5078d70d5617202409b45acbda5f35743083c1d639208f54691d2d2` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/test_ps_rebuild.py` | 206 | `a0249953013082f32b751f39fd83911f59641f938cb93e3f24a2a7f0bba9623c` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/test_summary_refresh.py` | 213 | `d5e95a6a7aa2de870b92a764c7a251a50d6684d36ab34912994a42e6cc2eea97` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/test_team_refresh.py` | 294 | `80042326e4fffab4edd08f487f278d191de9fdceeb6ff2eafd70ca73f6fb659f` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/verify-landing-strict.py` | 231 | `9bc6f2059eb78ef9cf4263df9f1d578af92a3b2019e550952a0ff4e437db00c0` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/verify-landing.py` | 30 | `2cc9fdb67cb3dde05c4dd6a8c8c04a9c550767367d9cf245e204ff060dc4e9bc` | same | audited-batch2 |
| `penalty-shot-rebuild-2026-11-13/verify-team-landing.py` | 21 | `d905215383c2503755f6760d3c2050e790d7750e1e53ee7410107abae34f50e3` | same | audited-batch2 |
| `power-g5v5-2026-11-13/carry-manifest.sql` | 18 | `a0a7753d17344a38bf4d34a296218d5fd50a2b1e7b57cfec673310af25621eed` | same | audited-batch2 |
| `power-g5v5-2026-11-13/en-games-shots-toi-reconciliation.sql` | 28 | `c86aaba0c83478da7e8f810e22807aca5f2e8222c45186eef91e9b4903517584` | same | audited-batch2 |
| `power-g5v5-2026-11-13/en-goals-reconciliation.sql` | 26 | `336fd3ea0ddd48cab73f219cc2234e5f28a4d302c568912c68a84099e5aea131` | same | audited-batch2 |
| `power-g5v5-2026-11-13/power-g5v5-loop.py` | 579 | `c01d2e7069e1522fcea46efcfe403c37d30ee5daa4a761b5e5ed7be6d7f4f0e7` | same | audited-batch2 |
| `power-g5v5-2026-11-13/preflight-carried-keys.sql` | 40 | `debb4d2c68d9c330d112f3a5ba30419ee72fe12041aa59f62f88994eb68c3b2f` | same | audited-batch2 |
| `power-g5v5-2026-11-13/preflight-window-checks.sql` | 48 | `47bb26178da936a4ad11fb08a42484ec83562bf40c54017e638b4ceb9b183a05` | same | audited-batch2 |
| `power-g5v5-2026-11-13/test_power_g5v5_loop.py` | 111 | `d288b874adbc1431c50f70ef78bff068589ffb67a212c4c1f962864e0cc85e58` | same | audited-batch2 |
| `pp-clock-validation-2026-11-13/01-season-inventory.sql` | 8 | `f1a19e87743705131c239962836606c1fb1bd68f572afda63b52317740865ae4` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/02-pbp-coverage.sql` | 8 | `5af4f6b5e6ae95436c30f02b1db1c688878797eacd07946d45c8af4fc6679bb4` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/03-classify-teamgamestats.sql` | 42 | `a81258a412b929dcc5dee9d0bea0282e5e52a56888fc239cdc22df138c81ac6c` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/03-run-summary.sql` | 8 | `2356956db2ecfb09f31c664a7360717585ea0bfdf279227406a46c4554b8f03b` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/04-fetch-pbp.sh` | 29 | `eb374bbf120415a995a5e804893c8c1fe4c5221e88e329fcd1d66fdff44de4dc` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/05-compare-clock.ts` | 313 | `0a2a7a191fbf4b9a18500f23369a89607f3f7049ce88bbd8bcffc524f5f7c7a4` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/06-inspect-games.ts` | 87 | `bad476e68e1a3485c7bb4b929f4715abde7f1575ebdf9685c9524c2ecfd675ab` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/07-coverage-status.sql` | 8 | `562c378c00f9ebee5a47964e74d009a3ed5a158957c11095b1b4fac40a54604b` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/08-raw-endpoints.sql` | 8 | `4fd111c9e651629bff91161761aea1dc86530c15987dde12c46a34a390b56295` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/09-repair-source-probe.sql` | 14 | `46d376538bd6270adb67f881b70e1943a4e05d49402251399b8a7d7e533ff361` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/10-fetch-shifts.sh` | 29 | `7e045d326e7b5e4cc15c7e0383d36bc52f72fe837ed53663b0a2040f8c3c5b3d` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/11-shift-numerator-check.ts` | 89 | `ff647dfe4d0253c2de0028da79db9c63f2b2278a3a226f7ac1962883de869607` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/12-fetch-pp-combinations.sh` | 29 | `c546ba0e66fc04c59f5b3bf3605aae27d1e9cab137a2bc5869f32a8c52b998c3` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/13-fetch-penalty-summaries.sh` | 20 | `ed3a3126727ea33ae8b3fb90d65f16320d65f16eb0c66367688e7c7c4aae7605` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/14-share-coverage.ts` | 170 | `34be1c247cc77dd7c92656ad189a5d060db5370617ea6cc26fa68603625efeeb` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/15-parse-penalty-summary.py` | 58 | `60e3e87bdd58a91195cd026784a2ef2395c61da54e0e60f8b0885ffb614ca805` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/16-fetch-numerator-provenance.sh` | 37 | `461dbe7e5548ddb3f49e04364e1d47e2033a97142452840671a312c503b2edb9` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/16-numerator-compare.ts` | 240 | `4ed6c7f67d93aa92e9dc10f833f11bbeabec3e0482d16a71ce19f672fc26948a` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/17-cost-probe.sql` | 76 | `088fcd90d050b647339ef2c6cbb6086cc0271805600b1187ad864eb1ced09505` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/18-compute-timing.ts` | 40 | `78fe36383fbb0a3c99ce7b0b0856b3897fe01be2c5cb59a0eb3669f5940b7b69` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/19-production-pairwise-check.ts` | 27 | `ea15072fe3ed5e7f1ec49b2ee92c527dbd038e98bc1f76857c6cf61cbb3f3e7f` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/20-refresh-runner.py` | 338 | `b86a75715047d7e2592a35b36bea8baabda623bd49cf3b384fa67f6a73583275` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/21-export-dry-run-inputs.py` | 110 | `015653d064d8762b1a5e074fc9532d3017ce25c5a31b04250774c9d4ef5528a3` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/22-local-dry-run.stubs.ts` | 8 | `40336ac7df6b8c8f985f9a0a473979454584e2a8bef7b8190d8ac75ffa3b4f33` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/22-local-dry-run.ts` | 114 | `62db3adad2bf0495cf416fb9f2ef1ec469344212b1783afee6d802517ba78848` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/23-reconcile-local-dry-run.py` | 98 | `cfd71c35e738ef849aae44e2803558afcd8788514e10bd9ceed50234b5d60744` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/hygiene.sh` | 8 | `d772fc1d04bbcaf791d52bfa27c4d9936cdd6f8c4ee8e8c634eee60463313d32` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/hygiene.sql` | 5 | `8cd8776ecc42ce611ed5373883395602c5afcc12173fa00837b724950f77461b` | same | pending-next-batch |
| `release-433-followups/post-release.py` | 77 | `77e23560adfa84ec6ef92cd689be25f5f3bfcf1c063b30a4e1bb43090d7d1088` | same | pending-next-batch |
| `rolling-resume/rolling-resume-slow.py` | 113 | `c655915db71fb993326a5af39ff21000e088f7f489c9a5922e35b3c1c8bb7869` | same | pending-next-batch |
| `trend-bands-2026-11-13/trend-bands-history.py` | 113 | `5fa8432214ab53024649aa822492ac0b797f996104c46563d26f0331e9e12f6d` | same | pending-next-batch |

