# FORGE pregame capture — first pilot approval packet

- **Status:** ready for TJ's review. Nothing in this packet has been run against production, and nothing here is approved by being written.
- **Owner:** Claude Chef session `local_e8064f61` ("FORGE pregame input capture").
- **Packet date:** 2026-11-15. Revision 3: P1 probe run (approved) and re-pinned; D3 decided (60 s); candidate re-pinned. Revision 2 had fixed the probe and set the game policy to earliest eligible, with Tuesday as fallback.

## 1. Exact candidate
| item | value |
| --- | --- |
| Candidate code commit | `6562138932daab6829ebc178221b19eb9e4cda4a` (octoberBranch, local only, not pushed). Supersedes `1cd29b4b9` and `55ed51604`. |
| How it runs | From a clean `git archive 6562138932` export of the whole tree (13,406 tracked files, no untracked files), with `web/node_modules` linked from the checkout. Not from the working checkout. |
| Custody migration | `supabase/migrations/20261115000000_forge_pregame_capture_custody.sql`, SHA-256 `4213b1104ac4c0c262800c94eb12710b27dcea5460da96c314abb908d0df98b9`. Registered as **pending** authority row 150; not applied. |
| Rollback | `supabase/tests/forge_pregame_capture_custody_rollback.sql` |
| Pilot script | `web/scripts/forge-pregame-capture.ts` (policy `pregame-native-v1`) |
| TSA profile (pinned in code) | `digicert-g4-v1` in `web/lib/projections/pregameCapture/tsaProfiles.ts`: URL `http://timestamp.digicert.com`; the G4 anchor is embedded and its SHA-256 checked on every load. **Re-pinned from the probe:** policy `2.16.840.1.114412.7.1`; DigiCert's off-path cross-signed G4 accepted only by exact SHA-256 `33846b54…b941`; fallback accuracy 60 s (D3). A capture refuses any unpinned profile. |
| Trust root (public cert) | `tasks/artifacts/forge-pregame-capture-2026-11-14/digicert-trusted-root-g4.crt`: DigiCert Trusted Root G4, self-signed, valid 2013-08-01 to 2038-01-15, SHA-256 `55:2F:7B:DC:F1:A7:AF:9E:6C:E6:72:01:7F:4F:12:AB:F7:72:40:C7:8E:76:1A:C2:03:D1:D9:D2:0A:C8:99:88`. Exported from the macOS system root store; no download. |

Any later commit used to run the pilot must show `git diff --stat 6562138932 <run SHA> -- web supabase` empty (docs only), or this packet is void.

## 2. Game: earliest eligible, Tuesday as fallback
**Primary: the earliest eligible game,** proposed only after P1 (the probe) passes and is re-pinned, and D1 (migration) and D2 (verifier) are cleared. TJ approves the specific game before it runs.
- **Eligible means all of these:**
  - The launch is at least 30 minutes after TJ's approval of that game (time to prepare the clean export and gates).
  - The launch is at or before T−60 minus 4 minutes, so the 240 s claim budget finishes by T−60.
  - Status FUT/OK at the pin.
  - One game only; the earliest such puck drop wins.
- **Finding it:** needs one read-only schedule lookup (G1 below). The live `games` table is the source of truth; the local Oct 29 snapshot is too old to choose from.

**Fallback (not a date to wait for):** 2026020334, WSH @ TBL. The local snapshot says Tue 2026-11-17 19:30 ET (2026-11-18 00:30:00Z):

| | ET | UTC |
| --- | --- | --- |
| Scheduled puck drop | Tue 2026-11-17 19:30 | 2026-11-18 00:30:00 |
| Acknowledgement deadline (T−60) | 18:30 | 23:30:00 (2026-11-17) |
| Last possible claim (T−60 minus the 240 s budget) | 18:26 | 23:26:00 |
| Proposed launch and input cutoff | 18:00 | 23:00:00 (2026-11-17) |

- **Cutoff:** for any game, the input cutoff is the claim's own database clock at launch. The packet states its availability cutoff as the end of its read window plus 5 s.
- **Pin step:** at launch the pin re-reads `games` and `roster_optimizer_team_games` and refuses any change of id, date, sides or start.

## 3. Operator and independent verifier
- **Operator:** Claude (this Chef session) runs the script from the clean export on TJ's Mac, with TJ present. TJ supplies the approval token by exporting `FORGE_PREGAME_CAPTURE_APPROVAL` in the run shell.
- **In-run verifier:** `verifyAndWitness`. It uses its own Supabase client instance and its own code path, and trusts nothing the writer holds in memory. It reads the committed row back, recomputes the raw and canonical hashes from the stored bytes, checks the binding, and stamps a statement naming those bytes and that row version. It then reads back again.
  - **Limit:** it uses the same `service_role` credential as the writer. A separate DB role would be a new permission; see decision D2.
- **Independent post-hoc verifier (proposed):** Astra/Codex, after the run.
  - Inputs: the exported witness token, the statement text and the committed packet bytes.
  - Checks:
    1. Recompute the statement digest and the packet hashes.
    2. Verify the token with **OpenSSL** `ts -verify` against the pinned root. This is an implementation independent of ours.
    3. Run `reverifyStoredWitness`.
  - Optionally Astra makes its own single read-only `forge_pregame_capture_read_v1` call; that is a separate approval (D4).

## 4. Timestamp authority, probe and revocation
- **TSA:** DigiCert public timestamp service, `http://timestamp.digicert.com`.
  - Tokens are signed, so the transport needs no TLS for integrity.
  - Only a SHA-256 digest leaves the process; no FHFH data does.

**P1 probe: done 2026-11-15T02:37:45Z (TJ approved, one call, 235 ms).** It ran from the clean export of `1cd29b4b9`. The receipt is in `~/forge-pilot/probe-20261115T023745Z/` (folder 0700, files 0600): request, digest and nonce, raw response, full report.

**What the token showed:**

| property | result |
| --- | --- |
| Status | granted |
| Policy | `2.16.840.1.114412.7.1` |
| Imprint algorithm | SHA-256 |
| Nonce | present, matches |
| genTime | `20261115023745Z`, **whole seconds** |
| Accuracy | **absent** |
| SignedData | v3 |
| Signer | v1, issuer-and-serial |
| ESS binding | v1 and v2 both signed |
| Unsigned attributes / trailing elements | none / none |
| Signature | rsaEncryption + SHA-256 |

**Bundled certificates:**
1. Responder "DigiCert SHA256 RSA4096 Timestamp Responder 2026 1" (`2da09da7…`), EKU critical and timestamping-only, valid 2026-08-05 to 2037-11-04.
2. Intermediate "DigiCert Trusted G4 TimeStamping RSA4096 SHA256 2025 CA1" (`ca0b1554…`).
3. A cross-signed "DigiCert Trusted Root G4" (`33846b54…`, issuer DigiCert Assured ID Root CA). It is not our self-signed G4 anchor.

**Independent cross-check, local:** OpenSSL `ts -verify` against the pinned G4 root returned "Verification: OK", both request-bound and digest-bound.

**What changed because of the probe (offline, tested, committed in `6562138932`):**
- **Re-pin:** policy `2.16.840.1.114412.7.1`. The off-path cross-signed G4 is accepted only by exact SHA-256; any other off-path certificate is still refused. The exhaustive flip test still refuses every single-bit change.
- **Resolution:** the conservative bound now adds genTime's resolution (1 s for DigiCert), in the verifier and in SQL (`tsa_resolution_us`; upper bound = gen + accuracy + resolution).
- **D3 (TJ, 2026-11-15): fallback accuracy 60 s.** For DigiCert the bound is genTime + 61 s. The database-clock cross-check tolerance widens to match.
- **Regression fixture:** DigiCert's real token (random digest, no FHFH data) is in the test fixtures. Without a fallback it is refused; under the final capture profile it verifies, with bound = genTime + 61 s.

**Revocation policy for the pilot:**
- No online revocation check (OCSP or CRL would be further external calls).
- The verifier checks the chain to the pinned root and validity at genTime.
- The witness keeps the signer certificate SHA-256 and the full token.
- A post-hoc CRL/OCSP check of the recorded signer can be approved separately later.

## 5. Limits (refusal caps; any breach fails the capture as `source_failed`, never a partial packet)
| limit | value |
| --- | --- |
| Read calls (builder + HTTP) | 600. The fixture world needs 120–139 per game; production is unmeasured. |
| Rows | 400,000 |
| Bytes total / per response | 96 MiB / 24 MiB |
| Read window | 120 s |
| Stamp tolerance (row stamp vs. receive clock) | 5 s |
| Packet (gzip canonical JSON) | ≤ 32 MiB (database CHECK) |
| Claim budget (read + save + settle + reads + TSA + witness + outcome + skew) | 240 s before T−60 |
| Save wait / RPC wait / TSA timeout / clock-skew tolerance | 20 s / 10 s / 10 s / 2 s |

- **HTTP methods:** only GET/HEAD.
- **Allowed relations:** the writer's audited input set minus its write targets.
- **Allowed RPCs:** exactly `forge_latest_rolling_rows` and `forge_league_skater_physical_totals`, by GET.
- **Refused:**
  - embedding of anything off the allowlist;
  - schema-profile headers;
  - unfiltered reads outside `seasons`, `teams` and `nhl_xg_model_registry`;
  - any target-game result row;
  - any row stamped after its read.

## 6. Read/write footprint
- **Reads (production Supabase, service role, one game):**
  - Pin: `games`, `roster_optimizer_team_games`, `rosters` ×2, `fhfh_player_identities`.
  - Collector: exactly the forecast writer's native input reads for game 2026020334 (issued context before and after, preflight, completeness, skater and goalie loaders), within the limits above.
  - Verifier: two `forge_pregame_capture_read_v1` calls. Each returns the packet bytes once; egress is about 1.33× the packet size per call.
- **Writes (only in schema `forge_pregame_capture`, through its RPCs):**
  - 1 claim;
  - 1 artifact (the packet; expected a few MB gzipped, unmeasured);
  - 0–1 save fence;
  - 1 witness (statement + token, about 2–6 KB);
  - 1 outcome (metadata only).
- **Not touched:** forecasts (`forge_*_projections`, `*_prediction_outputs`, `model_market_flags_daily`), runs (`forge_runs`), revisions (`forge_game_revisions`, `publish_forge_game_revisions`), serving, flags, cron and the rolling job. The rehearsal asserts this.
- **External:** the TSA, once for the probe and once in the capture. Nothing else.
- **Prerequisite write (separate approval, D1):** applying the custody migration. DDL only: a new schema, five tables, eight functions and their grants; no existing object changes.

## 7. Stop conditions
- **Migration apply:** stop if fresh load checks show active long queries, lock waits or overlapping cron windows. Stop on any readback mismatch: schema, tables, triggers `ENABLE ALWAYS`, function owners and SECURITY DEFINER, EXECUTE granted only to `service_role`.
- **Probe:** stop on any verification failure, missing accuracy (unless D3 is approved), or a chain that doesn't anchor at G4. Nothing else is called.
- **Before launch:** stop if:
  - the export SHA differs from the re-pinned candidate named in the approval;
  - the migration hash differs from the authority row;
  - the probe hasn't passed;
  - the launch clock is past the approved game's T−60 minus 4 minutes.
- **During the run (automatic):**
  - Pin or claim refused: stop; `late_start` and `insufficient_time` record `never_dispatched`.
  - Any transport refusal, calendar change or failed read: `source_failed`; the claim is fenced.
  - A save is never retried. An unknown save is settled by claim id: either the committed row is found, or a fence blocks any later save.
  - The TSA or verifier fails, the token bound is after T−60, **or the final committed readback is after T−60 of the earliest start**: `saved_without_valid_witness`.
- **After the run:** one attempt only, because one claim exists per (game, policy). No re-run, other game or other policy without new approval.

## 8. Rollback and disable
- **Code:** nothing is deployed. The script runs only when the operator invokes it with every gate set (`FORGE_PREGAME_CAPTURE_ENABLED=true`, matching `--confirm-game-id`, `--approval` equal to `FORGE_PREGAME_CAPTURE_APPROVAL`, a 40-hex `--code-version`, TSA URL and anchor, a new `--out` directory). Disable = don't run, or unset the env.
- **Database:** `forge_pregame_capture_custody_rollback.sql` drops the schema and its eight functions. That destroys retained evidence, so export the rows first; it needs its own approval.
- **Nothing to restore:** there are no serving or flag changes.

## 9. Verified offline (local only, no production, no external calls)
- **Byte-for-byte writer parity of the stage split** in 14 scenarios (9 with compute on; 5 with compute off, including a resumed run). See `SPLIT-PARITY-EVIDENCE.md`.
- **Custody SQL proof:** 113/113 on local PostgreSQL 15, run as a non-superuser owner (`supabase/tests/forge_pregame_capture_custody.py`). It covers:
  - claim refusals and the concurrent single winner;
  - save once, the settle fence and the sweeper;
  - outcome/claim consistency;
  - witness digest, upper bound, read order, and the token-in-time-but-final-readback-late refusal;
  - an earlier current start;
  - immutability, including replica mode;
  - grants and rollback.
- **Vitest:** 131 tests in 8 files (capture modules, pilot script, probe, real DigiCert token), plus the baseline migration test 21/21, including:
  - **Fail-first cutoff test:** a token bound within T−60 with a final readback after it does not qualify. It failed on the old verifier and passes now.
  - **Exhaustive tamper test:** every single-bit flip in a token is refused.
  - **Strict RFC 3161 checks:** EKU, signer identity, version, accuracy, DER and time-range checks.
- **Baseline migration test:** 21/21 (authority row 150, pending).
- **Probe tooling:** offline, against the test TSA, covering pass with a retained receipt, missing accuracy, a non-timestamping signer, TSA unreachable, and refusal of a reused folder; the pinned profile's anchor fingerprint and the capture's refusal of an unpinned policy.
- **Rehearsal** (`--rehearse`, through the real runner wiring, collector, strict transport and verifier; network trapped, 0 attempts):

  | case | result |
  | --- | --- |
  | one exact game | qualified, independently re-verified, bound ≤ T−60 |
  | late start | `never_dispatched` |
  | ambiguous save that committed | settled, qualified, 1 save |
  | ambiguous save that didn't commit | `save_unknown`, fenced |
  | ambiguous claim | left for the sweeper; no save |
  | commit after the cutoff | not qualified |
  | token in time, final readback late | not qualified |

  In every case: no writes reached input sources, no forecast or revision surface was touched, reads stayed on the allowlist, and the packet held no outputs.
- **9a. Clean-export typecheck of `6562138932`:** `git archive` of the full tree (13,406 files, no untracked files), `npm run typecheck` under the heavy lock: **exit 0, 0 errors**.

## 10. Needs TJ's approval (each separately; nothing here is approved)
| # | action | scope |
| --- | --- | --- |
| D1 | Apply migration `20261115000000` to production | Singly, after fresh load checks; read back; record in `schema_migrations`; flip authority row 150 to applied with the receipt. |
| D2 | Verifier credential | (a, recommended for the pilot) the same `service_role` with a separate client, plus the Astra/OpenSSL post-hoc check; or (b) create a dedicated verifier role with read-only EXECUTE on `read_v1`/`record_witness_v1` (a new permission and migration). |
| D3 | ~~Accuracy fallback~~ **decided** | TJ, 2026-11-15: 60 s (bound = genTime + 61 s with the 1 s resolution). |
| D4 | Astra's own read-only readback | One `forge_pregame_capture_read_v1` call after the run, for independent verification. |
| P1 | ~~TSA probe~~ **done** | Ran 2026-11-15T02:37:45Z with TJ's approval and was re-pinned in `6562138932` (§4). |
| G1 | **Schedule lookup** (read-only) | After P1, D1 and D2 clear: one bounded read of `games` (ids, date, start, sides) from now through the fallback date, to name the earliest eligible game for TJ's approval. |
| P2 | **Capture run** (live reads + private writes + one TSA call) | The earliest eligible game TJ approves (fallback 2026020334 at 18:00 ET on 2026-11-17), policy `pregame-native-v1`, the re-pinned candidate, limits as in §5, credentials loaded from `web/.env.local` only for that run. |

**Not part of this pilot:** push, deploy, flag changes, cron or hosted slate queue, forecasts, serving changes, reruns, or any second game.
