# Pilot capture 3: game 2026020328 (CGY @ ANA): **`qualified`**, the first verified private capture

- **Approval:** TJ's pop-up, P2, 2026-11-15 ~19:35Z: "0328, ~30 min from now". Packet revision 4.
- **Code:** a clean `git archive` export of candidate `29451c57304866d54abd2a3302625f0696472ab0` (13,437 files; `CANDIDATE-29451c573-VERIFICATION.md`). Profile `digicert-g4-v1`, policy `pregame-native-v1`. Credentials were loaded for this run only and never printed.
- **Gate (20:10:10Z, fail-closed):** active 0, longest 0 s, lock waits 0. API and TSA hosts resolve.
- **Times:** puck drop 20:00 ET (2026-11-16 01:00:00Z); T−60 00:00:00Z; launched 20:10:10Z.
- **Private receipt:** `~/forge-pilot/capture-2026020328-20261115T201009Z/`, with `capture-receipt.json`, `postrun-verify.json`, `committed-packet.json.gz`, `witness-statement.json` and `witness-token.der` (files 0600).

## Result
| | |
| --- | --- |
| Outcome | **`qualified`**, recorded; 1 save call; the witness verdict is qualified |
| Claim | `4a02a2c0-48b0-4b51-88a0-b57c67bc2cf2`; input cutoff 20:10:12.967828Z (database clock) |
| Timings | pin 762 ms, claim 132 ms, reads 19,039 ms, save 156 ms, verify 526 ms, total 20,740 ms |
| Reads | 133 GET calls (all HTTP), 10,050 rows, 1.75 MB, inside the window 20:10:13.129–20:10:32.060Z. Stated cutoff 20:10:37.060Z (end + 5 s). This includes the two `forge_latest_trend_bands` reads that failed pilot 1. |
| Candidates | 36 skaters, 6 goalies, 0 reserves |
| Packet | 163,355 bytes gzip; raw SHA-256 `908b9592…e03e`; canonical SHA-256 `0874115f…e414`; artifact inserted 20:10:32.244382Z; row version 14828024 |
| Timestamp | DigiCert genTime 20:10:32Z (whole seconds); accuracy 60 s pinned, +1 s resolution, so the conservative bound is **20:11:33Z**; policy `2.16.840.1.114412.7.1`; signer `2da09da7…`; token SHA-256 `d618e97e…91c6` |
| Deadline slack | 13,707 s (3 h 48 min) before T−60 |

## Independent checks after the run
1. **Authoritative readback by claim id** (fresh client, one `forge_pregame_capture_read_v1` call at 20:10:38Z):
   - outcome `qualified`, artifact present, not fenced;
   - the raw and canonical hashes recomputed from the stored bytes match the database;
   - the binding (game, slate, sides, scheduled start, claim, cutoff, code version, calendar revision) matches the approved request;
   - both teams FUT/OK.
2. **Offline re-verification** (`reverifyStoredWitness`): within the deadline, with the same bound, token and signer.
3. **OpenSSL 3.6.5 `ts -verify`**, an implementation separate from ours, against the pinned DigiCert Trusted Root G4: **Verification: OK**.
   - The witnessed statement's SHA-256 is `631b963c…cfa2`.
   - The token nonce `0xB19F8BFC6EDE8B05` equals the statement nonce `12799102582318336773`.
   - The statement names the packet's raw and canonical hashes, byte length, claim, row version and the database read time (20:10:32.331083Z).

## Not done (separate approvals)
- Astra's own readback (D4) and post-hoc check.
- The hosted slate queue: offline build in progress in the `forge-slate-queue` session.
- Releasing the reader.
