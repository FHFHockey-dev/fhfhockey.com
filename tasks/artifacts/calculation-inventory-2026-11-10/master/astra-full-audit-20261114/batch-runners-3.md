# Astra production runners — batch 3

2026-11-14; worker `gpt-6-astra/high`; Chef owns disposition. Fully read **29 files / 2,098 lines**, all executable artifacts in `pp-clock-validation-2026-11-13/` and `release-433-followups/`, in path order. Every current source hash matches `89da739cb`. Cumulative coverage is **52/54 files**. The accompanying TSV contains 178 symbol/block/file rows, including prior-batch references and two explicit pending files. Imported application implementations are outside this worker's bounded source coverage.

Three provisional findings concern future evidence acceptance or stopping behavior. **No historical wrong write was established.** Independently checking all 7,180 player rows in the retained approved PP dry-run found zero share-formula/range errors.

## Findings

### AFULL-OPS-08 — P2 — PP approval gate accepts an impossible share and readback repeats that oracle

- **Location:** `production/pp-clock-validation-2026-11-13/20-refresh-runner.py:158–213`, especially `:173–195`; `read_back:257–289`; `run_write:292–319`; `23-reconcile-local-dry-run.py:29` seals the same gate's result.
- **Claim checked:** REPORT.md §16 defines `pp_share_of_team = PPTOI / qualified clock seconds`; REFRESH-APPROVAL-PACKET.md:19–26 requires the frozen expected changes, then equality readback. The dry gate advertises checking PP time/share changes.
- **Evidence:** exact retained source, plus AST-only definitions from the runner and in-memory copies of the frozen dry-run. No application handler, production call or DB query was executed.
- **What's wrong:** the gate records the updated identity whenever either PPTOI or share changes, but checks only PPTOI's `after` value (or allows `None` for a share-only change). It never independently validates the share value, its range or consistency with the qualified denominator. The write readback compares to the same approved rows; equality cannot detect an invalid approved value.
- **Minimal input → wrong output:** retain the original 31 calls and change only game `2026020131`, player `8475158`, team 18, `pp_share_of_team` in both the returned row and its diff to **99**. PPTOI stays 112 and clock stays 120, whose correct share is 0.933333. `check_dry_run` returns `[]`; a fake scalar readback matching those rows also returns `[]`. An impossible 9,900% share can therefore receive a passing gate and matching readback if such output is separately approved. **This does not bypass the required human-approved hash and does not describe the actual retained approved file.**
- **Suggested correction:** validate every output row independently: qualified/nonzero clock, finite nonnegative PPTOI within clock, share equal to PPTOI/clock at the stated rounding tolerance, explicit zero/unavailable handling, and consistency between returned rows and diff `after` values. Keep the hash and exact replay gates. Add this negative case to the existing runner verification workflow.
- **Readers affected and containment:** the dry-run approval packet and its evidence oracle. Chef's focused source check of authority 149 confirms the current writer uses `replace_power_play_game_v1`, whose SQL rejects share >1 and `abs(share - PPTOI/clock) > 1e-6` for the known 120-second clock. Therefore the fake DB readback of 99 **does not establish a reachable stored-share defect under the current RPC contract**. No alternate current write bypass was established in this bounded runner pass. Reclassified P2 after Chef review: evidence-oracle defect contained by the independent database constraint. The retained approved dry-run passes both the original gate and the independent formula check.

### AFULL-OPS-09 — P2 — Scalar export cache can promote an old partial after the busy stop

- **Location:** `04-fetch-pbp.sh:13–27`, notably normal `\quit` at :23 and unconditional existing-part promotion at :27; equivalent blocks in `10-fetch-shifts.sh`, `12-fetch-pp-combinations.sh`, `16-fetch-numerator-provenance.sh`.
- **Claim checked:** headers promise to quit before reading when DB is busy; final nonempty CSV files are treated as completed/resumable evidence.
- **Evidence:** full source and execution of only the exact promotion statement in an empty-environment zsh with a synthetic `/tmp` filename. No psql, export query or credential was invoked.
- **Minimal input → wrong output:** a failed/interrupted earlier export leaves `page.csv.part`; the next busy-check session takes `\quit` without a nonzero status or a fresh completion marker. The subsequent shell condition sees the old partial and renames it to `page.csv`. The isolated exact fragment exited 0, preserved the stale bytes, created the final file and removed the partial. The next run's `-s` check skips that final. Expected: busy/failed attempt cannot promote any partial as completed evidence.
- **Suggested correction:** nonzero busy exit and `ON_ERROR_STOP`; quarantine/remove old partials before a new attempt; use a unique temporary name and promote only after positively verified successful COPY and input-page identity/count/hash. Abort must leave the previous completed evidence intact. `13-fetch-penalty-summaries.sh` has a related source-only cache risk: curl writes directly to the final file and a transport failure under `set -e` can leave nonempty partial HTML skipped next time.
- **Readers affected:** exploratory clock/shift/provenance comparisons consuming scalar pages; no production write or actual corrupt retained page was demonstrated. The later `21-export-dry-run-inputs.py` has explicit read-only transactions, return-code/settings checks and hashes; this finding does not imply its export took the same path.

### AFULL-OPS-10 — P1 — Release follow-up runner continues after a non-JSON HTTP 200

- **Location:** `production/release-433-followups/post-release.py:52–77`, especially JSON fallback :64–67 and stop predicate :73.
- **Claim checked:** header :3 promises “stop on any error”; the sequence includes mutating app endpoints and provider fan-out, so uncertain responses must not silently authorize the next step.
- **Evidence:** exact source and evaluation of only the AST stop expression. No top-level imports/secret-file read, URL call or DB guard ran.
- **Minimal input → wrong output:** HTTP status 200 with an HTML response is converted to `{'raw': '<html>unexpected page</html>'}`. `status != 200 or j.get('success') is False` evaluates **False**. The runner waits 20 seconds and continues to the next write/provider step, eventually logging DONE if all four return this shape. Expected: malformed/unrecognized output stops with uncertain outcome.
- **Suggested correction:** reject non-JSON or wrong-shaped responses, then require each endpoint's explicit success contract and expected date/version/count evidence. Preserve stop-before-retry semantics and document any endpoint that legitimately lacks a success field. Do not blindly retry an uncertain committed operation.
- **Readers affected:** release follow-up completion evidence and the decision to perform subsequent calls. This is a source-confirmed gap in a runner capable of real writes; **no retained response proves it occurred historically**. Chef may classify the retained operational artifact's reachability separately; no automatic cron admission was established here.

## Script safety and numerical assessment

Paths below are relative to `production/pp-clock-validation-2026-11-13/` unless qualified. Separate named functions/methods and top-level computation blocks are in the TSV.

| Files | Bounds, stops and write gating | Resume, evidence and numerical limits |
|---|---|---|
| 01, 02, 03-classify, 03-run-summary, 07, 08, 09 SQL | 10 s SQL bounds; scalar reads. Classifier uses temporary-table DDL, not durable writes. Some inventory aggregates cover all seasons; selected raw probes cover fixed games/dates | Classification uses past dates, not a final-state requirement; minute parsing and 4,800 s ceiling are diagnostic categories, not actual-game duration validation. Null PIM/opportunity display summaries do not establish zeros in source data |
| 04, 10, 12, 16 shell exports | One psql session/page, normally 10 games (provenance 50); 10 s statements; active >5 or age >10 busy gate in same session; no provider calls | Existing nonempty file means done, with no frozen page identity; batch arguments assume valid positive values. AFULL-OPS-09. Read shapes are scalar, but shell helpers do not enforce a read-only transaction |
| 05 comparison / 06 inspection | Offline CSV inputs; selected seasons/games; application clock helpers imported but not executed by this audit | Official/PBP missingness remains explicit. Two-second comparison, exclusions around penalties/goals/boundaries and descriptive feature attribution are not independent clock calibration. Inspection prints clock exceptions; it is not an admission gate |
| 11 shift check | Offline selected team-games; both-team half-open integer seconds | Counts shift rows, including goalies, so duplicates/overlaps can inflate coverage. Max-player <= clock is true by intersection construction; header acknowledges tautology. Zero-PP game shares use a diagnostic convention; aggregate empty denominator can yield JSON null |
| 13 HTML fetch / 15 parser | Five fixed NHL report requests, sequential 10 s spacing, 30 s curl timeout; non-200 removes output and exits. Parser reads local argv HTML only | NHL, not NST. Partial-cache source risk above. Token/marker parser is a manual diagnostic, not a robust feed admission gate; missing markers can produce empty arrays or malformed-token exceptions |
| 14 share coverage | Qualified 2026–27 regular games; zero clock marked not applicable; normalization completeness required; shift seconds deduplicated per player | Requires at least three player-seconds per PP second; goalie heuristic is any single shift >=300 s, explicitly disclosed in REPORT. Unit/player maxima are construction checks. Stored numerator/denominator agreement is separate from recomputed displayability. Actual writer uses roster goalie identity; do not treat this heuristic as its implementation |
| 16 numerator comparison | Offline current/historical clock variants; numerator ±2 s and denominator ±1 s comparison | Preserves old writer's block-length denominator separately from union seconds; shared-time unit selection has tie sensitivity. Multiple versions can match a value, so match is not proof of historical writer identity. Floating local-master import aliases are not a source pin; REPORT corrects an earlier stale-master assumption |
| 17 SQL cost / 18 timing / 19 pairwise | 10 s SQL EXPLAIN ANALYZE queries; some selected-player history is not season-limited. Timing three offline passes; historical pairwise only supplied triples | pg_column_size estimates stored value bytes, not network/billed cost. Timing's span intersections are a workload surrogate, not a complete accuracy rerun; quantiles use floor(p*(N-1)) of warm samples. Historical helper is not current writer proof |
| 20 refresh | Required `dry` or `write` subcommand; frozen 309 IDs/31 batches <=10, concurrency one, >=5 s after call, 60 s HTTP/elapsed stop; hygiene before call/readback. Non-200/failed/skipped/exact-ID mismatch stops. Write needs exact approved dry hash and passing gate | Manual `--start-batch`; no automatic retry or persistent done file. Stop prints the mismatching batch, never a later resume point. Equality readback includes values, clock state/source and version; misses independent share semantics (OPS-08) and does not select `computed_at`. Writer/RPC transaction idempotence is outside this file. Deployment/migration/flag prerequisites are external approval steps, not verified by runner |
| 21 export | Frozen batches, hygiene and 5 s spacing; six CSVs/batch; default_transaction_read_only and START TRANSACTION READ ONLY, local 10 s timeout; validates return code and shown settings, exact game IDs | 186 CSV hashes/counts and transaction settings recorded. Local files overwritten, no resume. No process-level subprocess timeout; SQL timeout does not bound connection/startup waits. No raw payloads exported |
| 22 stubs / 22 local harness | No math in pass-through wrappers. Fake client permits local known tables; RPC throws. Imported handler receives dryRun=true/concurrency=1; unsuccessful response stops before later batches | Fake select ignores projection; maybeSingle chooses first rather than simulating duplicate error. Output is intentionally unchecked until 23. These fakes do not prove the entire imported application graph has no side effects; it was not run here. CSV hash manifest is read but file hashes are not revalidated by the harness |
| 23 reconciliation | Exact frozen call game lists, shared expectation gate, roster change categories; writes sealed JSON/hash, fails flagged teams | Source imports 20 definitions; no main executed here. Manifest byte hash does not itself verify all referenced CSV bytes. Known missing raw CSVs prevent independent full handler replay; OPS-08 inherited through shared gate |
| hygiene shell/SQL | Active-client count/max age excluding own backend; exits 3 above 5/10 | No hockey math; a point-in-time load guard, not a lock/reservation against subsequent concurrent activity |
| release-433/post-release.py | Four hardcoded sequential actions, DB guard before each; read-only guard query 8 s, subprocess 60 s; twelve 20 s waits max. Calls timeout 300 s, then 20 s spacing. No dry/execute flag | No resume/done skip; rerunning repeats all actions. CTPI chunks are 31+15 dates. Header attributes 32 NHL requests each to update-games and SOS; endpoint implementation fan-out not independently traced here. No NST path. OPS-10 weak response stop. Update-games URL does not itself freeze season |

Secrets: 20 reads its bearer only from an environment variable; release follow-up reads CRON_SECRET from `.env.local` at top level and places it in a header. Neither source intentionally logs the secret. **No credential was read during this audit.** Failure snippets may contain downstream body/process diagnostics, so this is not a universal error-content sanitization claim. 20 denies three named provider hosts; that is not a general destination allowlist. No direct NST request appears in these 29 files; if a future endpoint starts NST fan-out, these caller delays alone do not enforce the four rolling NST limits.

## Retained evidence and limits

All PP paths here are under `results/after-d152/`. Checks parse retained local records; they do not establish current live state.

- `refresh-batches-2026-27-regular.json`, SHA-256 `c2c287aa09d5078f5fd472b4e6dc655743c1c658589874699e9678dbc020a5c4`: independently counted 309 unique IDs, `2026020001..2026020309`, 31 batches, maximum 10.
- `local-dry-run/dry-run.json`, SHA-256 `db94a9de864b9dfa8fa69f24c6be9045dd037ed1937393c3b03dd69d9ec4f15c`: 31 calls; actual pure original gate reports 618 clocks, 609 available, nine not applicable, zero unavailable, 16 changed team-games, 15 deletes, 23 PP updates, 14 other updates, five inserts. Independent arithmetic across **7,180 rows** checked positive/matching clock, `0 <= PPTOI <= clock` and `abs(share - PPTOI/clock) <= 1e-6`: zero violations. This is distinct from the mutated negative probe.
- `local-dry-run/export-manifest.json`, SHA-256 `bbcba75cebc65e45edd51d201e3f9fef05e20ab37d0280e4d4106bd41805c145`: 31 batches all record transactionReadOnly=`on`; 186 referenced scalar CSVs. **Those CSV files are not retained in this repository directory**, so their actual bytes cannot be independently compared with the manifest and the full local writer run cannot be reproduced from these retained files alone.
- `local-dry-run/reconciliation.json`, SHA-256 `123b1e585735a4a0b32f9a1b13edc36f76a9e67462d4238bfe893e45b25cb975`: 593 unchanged, 16 changed, nine not applicable, zero flagged, consistent with retained totals.
- `refresh-write-2026-11-13T2059Z.txt`, SHA-256 `bc9fd526a5208060e37845cf76e6f1779ac3f5d11a3183862b9f9afb0043a4fb`: :63–93 record 31 batches; :94 records written/read back completion. Independently extracted durations range **2.32–5.47 s**, below the 60 s bound but inconsistent with queue's narrower 2.3–4.9 s narrative. These are scalar readback log claims, not a full independent after-state export.
- REFRESH-APPROVAL-PACKET.md:7 attributes approval to the exact db94 hash; :8 records later #441 unset writer flag. :19–26 states scope/readback/stop requirements. Its :20 `--phase write` wording does not match the actual positional `write` CLI; :25's `computed_at` setting is not selected by runner readback. The imported writer may set it, but this runner does not verify it. REPORT:417–421's roster identity and ratio definition govern the writer, superseding the exploratory 300 s heuristic.
- No standalone `release-433-followups/` response/log is retained alongside its runner. Queue and handoff descriptions are repository-attributed completion/approval evidence, not primary approval transcripts or independently verified response bodies.

## Checks actually run

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin TMPDIR=/tmp python3 -I -B /tmp/astra-prod3-probe.py > /tmp/astra-prod3-probe-output.json
```

Exited 0. The probe runs inspected standard-library imports/definitions from 20, its pure check with local files, fake readback, one exact shell promotion statement against `/tmp`, and the release stop expression. No production main, provider/DB/HTTP/browser action or real application import executed. Probe SHA-256 `ead9b6758e7237add7d18903512e9818601ac1d3c6e5f1d589018c8ee7d636f9`; output `b0103f5e36aa1a0c0bf7959ca289f52eb1fcaa4d05a5738c58b1f142e1cce9e3`. Separate read-only Python parsing performed the receipt arithmetic/count/hash checks above; TypeScript compiler AST reading inventoried named symbols without executing files. No application test suite, PG bootstrap, code/test edit or commit.

Pending at this batch boundary: `rolling-resume/rolling-resume-slow.py` (113 lines) and `trend-bands-2026-11-13/trend-bands-history.py` (113 lines), separately assigned next. Original approvals, current production deployment/schema/state, application import closures and unavailable raw export files remain outside these source-only passes.

## Cumulative 54-file inventory

Paths relative to `master/production/`. SHA-256 pins actual local bytes. Target is `89da739cb`; `absent` archives are retained later operational evidence, not target-tree source. Prior batch statuses reference their separate symbol ledgers.

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
| `pp-clock-validation-2026-11-13/01-season-inventory.sql` | 8 | `f1a19e87743705131c239962836606c1fb1bd68f572afda63b52317740865ae4` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/02-pbp-coverage.sql` | 8 | `5af4f6b5e6ae95436c30f02b1db1c688878797eacd07946d45c8af4fc6679bb4` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/03-classify-teamgamestats.sql` | 42 | `a81258a412b929dcc5dee9d0bea0282e5e52a56888fc239cdc22df138c81ac6c` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/03-run-summary.sql` | 8 | `2356956db2ecfb09f31c664a7360717585ea0bfdf279227406a46c4554b8f03b` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/04-fetch-pbp.sh` | 29 | `eb374bbf120415a995a5e804893c8c1fe4c5221e88e329fcd1d66fdff44de4dc` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/05-compare-clock.ts` | 313 | `0a2a7a191fbf4b9a18500f23369a89607f3f7049ce88bbd8bcffc524f5f7c7a4` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/06-inspect-games.ts` | 87 | `bad476e68e1a3485c7bb4b929f4715abde7f1575ebdf9685c9524c2ecfd675ab` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/07-coverage-status.sql` | 8 | `562c378c00f9ebee5a47964e74d009a3ed5a158957c11095b1b4fac40a54604b` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/08-raw-endpoints.sql` | 8 | `4fd111c9e651629bff91161761aea1dc86530c15987dde12c46a34a390b56295` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/09-repair-source-probe.sql` | 14 | `46d376538bd6270adb67f881b70e1943a4e05d49402251399b8a7d7e533ff361` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/10-fetch-shifts.sh` | 29 | `7e045d326e7b5e4cc15c7e0383d36bc52f72fe837ed53663b0a2040f8c3c5b3d` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/11-shift-numerator-check.ts` | 89 | `ff647dfe4d0253c2de0028da79db9c63f2b2278a3a226f7ac1962883de869607` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/12-fetch-pp-combinations.sh` | 29 | `c546ba0e66fc04c59f5b3bf3605aae27d1e9cab137a2bc5869f32a8c52b998c3` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/13-fetch-penalty-summaries.sh` | 20 | `ed3a3126727ea33ae8b3fb90d65f16320d65f16eb0c66367688e7c7c4aae7605` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/14-share-coverage.ts` | 170 | `34be1c247cc77dd7c92656ad189a5d060db5370617ea6cc26fa68603625efeeb` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/15-parse-penalty-summary.py` | 58 | `60e3e87bdd58a91195cd026784a2ef2395c61da54e0e60f8b0885ffb614ca805` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/16-fetch-numerator-provenance.sh` | 37 | `461dbe7e5548ddb3f49e04364e1d47e2033a97142452840671a312c503b2edb9` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/16-numerator-compare.ts` | 240 | `4ed6c7f67d93aa92e9dc10f833f11bbeabec3e0482d16a71ce19f672fc26948a` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/17-cost-probe.sql` | 76 | `088fcd90d050b647339ef2c6cbb6086cc0271805600b1187ad864eb1ced09505` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/18-compute-timing.ts` | 40 | `78fe36383fbb0a3c99ce7b0b0856b3897fe01be2c5cb59a0eb3669f5940b7b69` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/19-production-pairwise-check.ts` | 27 | `ea15072fe3ed5e7f1ec49b2ee92c527dbd038e98bc1f76857c6cf61cbb3f3e7f` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/20-refresh-runner.py` | 338 | `b86a75715047d7e2592a35b36bea8baabda623bd49cf3b384fa67f6a73583275` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/21-export-dry-run-inputs.py` | 110 | `015653d064d8762b1a5e074fc9532d3017ce25c5a31b04250774c9d4ef5528a3` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/22-local-dry-run.stubs.ts` | 8 | `40336ac7df6b8c8f985f9a0a473979454584e2a8bef7b8190d8ac75ffa3b4f33` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/22-local-dry-run.ts` | 114 | `62db3adad2bf0495cf416fb9f2ef1ec469344212b1783afee6d802517ba78848` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/23-reconcile-local-dry-run.py` | 98 | `cfd71c35e738ef849aae44e2803558afcd8788514e10bd9ceed50234b5d60744` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/hygiene.sh` | 8 | `d772fc1d04bbcaf791d52bfa27c4d9936cdd6f8c4ee8e8c634eee60463313d32` | same | audited-batch3 |
| `pp-clock-validation-2026-11-13/hygiene.sql` | 5 | `8cd8776ecc42ce611ed5373883395602c5afcc12173fa00837b724950f77461b` | same | audited-batch3 |
| `release-433-followups/post-release.py` | 77 | `77e23560adfa84ec6ef92cd689be25f5f3bfcf1c063b30a4e1bb43090d7d1088` | same | audited-batch3 |
| `rolling-resume/rolling-resume-slow.py` | 113 | `c655915db71fb993326a5af39ff21000e088f7f489c9a5922e35b3c1c8bb7869` | same | pending-next-batch |
| `trend-bands-2026-11-13/trend-bands-history.py` | 113 | `5fa8432214ab53024649aa822492ac0b797f996104c46563d26f0331e9e12f6d` | same | pending-next-batch |
