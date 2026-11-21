# CBJ at NYI · Game 2026020336

On November 19 the operator retrieved the original packet in one authorized read-only transaction outside sandboxFORGE. The native decoder matched both November 17 digest pins, the game and claim binding, the recorded times and Werenski's candidate ID. The packet contains 187 recorded reads. The production transaction returned only the compressed packet and ended with rollback. [Export receipt](NATIVE-EXPORT.json)

## Original archive

| Recorded field | Value |
| --- | --- |
| Game and slate | `2026020336`, Columbus at New York Islanders, November 17, 2026 |
| Policy and claim | `pregame-native-v1`, `e79f06a3-8f33-4f50-a856-02f880787934` |
| Release | `83750b4abd672399113659b96c279a1ddaeb425b` |
| Input cutoff and puck drop | `2026-11-17T22:44:01.746467Z`, `2026-11-18T00:00:00Z` |
| Stored payload | 187,301 bytes, gzip of canonical UTF-8 JSON |
| Raw SHA-256 | `3a76caf5e5ad1485d3638ae13b8a2a432dd7578703ea09a188608029ff4d4a9b` |
| Canonical JSON SHA-256 | `bf9041ca164e2cef73ee984237560caab82181892ad2b62e85fa0b34c0822d56` |
| Witness token SHA-256 | `c18690e2e4d7d043c49295081d9caeff8a9da64149db9d427836124d5f96aa51` |

The November 17 independent witness check is documented in the canary receipt. The November 19 export used `forge_pregame_capture_read_v1(uuid)` for the recorded claim. The original bytes stay in private storage.

## Off-Mac replay on the original capture commit

The original release `83750b4abd672399113659b96c279a1ddaeb425b` (tree `79074035caf33d6993a6e4efc9bdd5e555f8ea1c`) verified the previously staged packet and both November 17 hashes. Its eight model settings matched the packet exactly, including `STARTER_BOARD_COMPUTE_ENABLED=false`. The harness passed the unchanged decompressed JSON to the release's replay CLI. [Machine receipt](CAPTURE-COMMIT-REPLAY.json)

The first gate was the input-format check at `web/scripts/replay-forge-snapshot.ts:10`. The CLI expects a source observation with a `payload` and string `payload_hash`. The native pregame packet contains neither field. The CLI exited 1 with the message `Expected a source observation containing payload and payload_hash.` Coverage recorded one CLI invocation and zero calls to `replayForgeSnapshot`, query replay or projection calculation. The run consumed 0 of 187 reads and produced zero writes and forecasts.

Exact command on the existing Linux executor:

```sh
cd /workspace/scratch/forge-preflight/original-release && bash run.sh > receipt.json 2> launcher.stderr
```

The evidence archive contains the launcher, preload, CLI output, coverage counts and source checksums. SHA-256 `fea51ec42d613ffecec2ae9b9581e7a0221c95d6ce493cbfed7e4da1b49b0e9c`. [Original-release evidence](capture-commit-replay-evidence.tar.gz)

## Off-Mac replay on the November 19 candidate

On Linux, candidate `f886ddac731ae825a12fab915848d2b5fd7d9b8c` (tree `09ef9bf0662e14cd80fa60cee25c70a988e5c748`) stopped at the first missing model input, `modelEnvironment.FORGE_RESERVE_PASS_ENABLED`. The driver verified both packet hashes, kept the November 17 capture release in the binding, and restored all eight recorded environment entries before loading the model. The candidate includes a ninth entry in its configuration digest even when the variable is unset. The recorded eight-key digest and the runtime nine-key digest therefore differ. [Machine receipt](NATIVE-REPLAY.json)

The real `computeForgePregamePublication` returned `FORGE pregame packet code or model environment mismatch.` before its compute-scope guard or query replay. The recorded compute setting was `false`. The single execution consumed 0 of 187 reads, attempted no unrecorded query and produced zero projection writes. Werenski's points and slot remain unknown. The container had only loopback, zero IPv4 routes and a clock anchored one second after the packet's stated cutoff.

Exact command on the existing cloud executor, with the verified gzip privately staged as `historical-replay/original.gz`:

```sh
cd /workspace/scratch/forge-preflight/historical-replay && bash run.sh > receipt.json 2> run.stderr
```

Exit 20 records the model-metadata stop. The archive contains the driver, launcher, source attestation, output, exit status and checksums. Its SHA-256 is `e7d3d48f950e6daf0ecd2170eec81f33423b722269b0be0560d9073a28568abb`. [Replay evidence](native-replay-evidence.tar.gz)

## Earlier fragment reconstruction

From the repository root with the pinned Node version and installed `web` dependencies:

```sh
packet_run=$(mktemp -d)
web/node_modules/.bin/esbuild tasks/artifacts/sandboxforge-2026-11-19/packet/offline.ts \
  --tsconfig=web/tsconfig.json --platform=node --target=node22 --bundle --log-level=warning \
  --outfile="$packet_run/offline.cjs"
node "$packet_run/offline.cjs" reconstruct-fragment
```

To verify the private original gzip offline with the same runner, run `node "$packet_run/offline.cjs" verify-native /private/path/original-packet.gz`.

The runner feeds the two retained Werenski rates into the repository's real `fetchLatestSkaterContextProfiles` via the strict replay interceptor, scoped to this player and slate. The query envelope is reconstructed from code. The four retained source values are player ID `8478460`, source date November 14, `nst_shots_per_60=9.78` and `nst_ixg_per_60=0.49`. The actual shot-quality calculator returned **0.0501 individual expected goals per shot** and **0.6617 sample weight**. Both quantities depend only on the two retained rates. The omitted rush, rebound and on-ice values are missing from the record. The runner does not emit the resulting incomplete multipliers or any player forecast. It checks the real issued-context loader fails at its first unrecorded `games` read. The fragment run performed zero writes. [Local output](LOCAL-FRAGMENT.json)

| Input area | Evidence and gaps in the earlier fragment |
| --- | --- |
| Schedule | Exact packet binding, including teams, game and calendar revision. The `games` response and the canonical schedule source rows, statuses and availability are missing. A revision hash carries no row data. |
| Roster, identities and lineups | Werenski's CBJ membership row and FHFH ID `9692`; the player-directory output identifies position D. The captured line-combinations record was named, but its assignments, timing and complete roster and candidate sets are missing. |
| Skater rate and deployment context | Two Werenski rates from one printed `player_stats_unified` fragment. The rolling and support payloads, WGO TOI values, trend bands, other NST columns, league totals and full skater/team rows are missing. |
| Remaining model inputs | Missing exact read transcript, complete target and candidate data, team/goalie/rest context, reserve candidates, season-bootstrap state and captured model environment. |
| Historical outcome | The later trace found no matching pre-puck-drop publication or linked run snapshot. The pre-existing November 13 forecast row does not establish publication from this claim. |

## Custody sources and checks

- The Nov 17 release receipt supplies the committed byte count, pinned digests and independent witness timeline. [Canary receipt](../../forge-pipeline-reliability-2026-11-17/HOSTED-CANARY-2026020336.md)
- The Nov 18 trace identifies the retained Werenski candidate and publication break. Its originating local transcript `01a1eae4-6d44-7ef3-925f-ecff1d3ae32f` lines 2716–2729 contains the selected packet fields. The archive read used in-memory base64/gzip decoding and printed samples. [Trace diary](../../../diaries/2026-11-18-codex-forge-rso-0336-trace.md)
- Before the authorized export, the checkout, named FORGE staging folders and selected November 17–18 transcripts yielded only the fragment. Its verifier rejected both a wrong-size file and a same-size file with a different digest. The packet decoder, shot-quality calculator, its weights and number helpers, and the `fetchLatestSkaterContextProfiles` function matched the November 17 capture release. The runner passed a scoped strict TypeScript check.
- The existing synthetic publication parity fixture passed 3 selected cases on the Mac, including actual writer parity, rejection of an unrecorded read and game/clock/config rejections. It used a separate fixture game and supplied no historical input or acceptance for 2026020336. Run it from `web` with `npm test -- lib/projections/pregameCapture/parity/parity.test.ts -t 'qualified pregame publication calculation'`.
