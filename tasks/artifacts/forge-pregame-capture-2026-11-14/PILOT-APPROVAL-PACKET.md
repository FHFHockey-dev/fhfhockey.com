# FORGE pregame capture — pilot approval packet

- **Status:** revision 4, ready for TJ's review. Nothing here is approved by being written.
- **Owner:** Claude Chef session `local_e8064f61` ("FORGE pregame input capture").
- **Packet date:** 2026-11-15.
- **Revision 4:**
  - a new candidate with the trend-band reader;
  - three allowed RPCs;
  - migration 151 applied;
  - the pilot 1 and 2 outcomes;
  - the next game proposed.
- **Revision 3** (git history) holds the full probe report. Revision 3 re-pinned the TSA after the probe and set D3; revision 2 set the earliest-eligible game policy.

## 0. Since revision 3
| item | result |
| --- | --- |
| D1, custody migration 150 | Applied 14:06:02Z (`MIGRATION-150-APPLY-RECEIPT.md`). |
| D2, verifier credential | (a) the same `service_role` key with a separate client, plus Astra's post-hoc OpenSSL check (TJ). |
| G1, schedule lookup | Done 14:07:38Z (`G1-SCHEDULE-LOOKUP-20261115.md`). |
| Pilot 1, 2026020326 | **`source_failed`**: the trend-band GET hit the statement timeout (57014) and returned 500. Refused safely; claim fenced; nothing saved (`PILOT-1-RECEIPT-2026020326.md`). |
| Pilot 2, 2026020327 | Stopped at the pin, before any claim: Mac DNS (no request reached Supabase). The gate had failed open; it now fails closed (`PILOT-2-RECEIPT-2026020327.md`). |
| Trend-band fix | One GET of the new read-only RPC `forge_latest_trend_bands` per team replaces the capped history GET (`trend-band-reader/TREND-BAND-READER-PROTOTYPE.md`). |
| Migration 151 | Applied 19:30:17Z with TJ's approval. Smoke on pilot 1's failing team: 144 keys in 2.4 ms; PostgREST HTTP 200 (`trend-band-reader/MIGRATION-151-APPLY-RECEIPT.md`). |
| Neither 0326 nor 0327 | Is retried (TJ). |

## 1. Exact candidate
| item | value |
| --- | --- |
| Candidate commit | `29451c57304866d54abd2a3302625f0696472ab0` (octoberBranch, local only, not pushed). Supersedes `6562138932` and `dcb8f50bb`. |
| How it runs | From a clean `git archive 29451c573` export of the whole tree, with `web/node_modules` linked from the checkout. Not from the working checkout. |
| Migrations (both applied) | 150 `20261115000000_forge_pregame_capture_custody.sql`, SHA-256 `4213b110…98b9`; 151 `20261115190000_forge_latest_trend_bands.sql`, SHA-256 `a3e1835f…9281` |
| Pilot script | `web/scripts/forge-pregame-capture.ts` (policy `pregame-native-v1`), launched only through `operator/launch-capture.sh`, after `operator/gate.sh`, which fails closed on DNS and load |
| TSA profile | `digicert-g4-v1`, unchanged since revision 3: policy `2.16.840.1.114412.7.1`; off-path cross-signed G4 by exact SHA-256; fallback accuracy 60 s, so the bound is genTime + 61 s |

Any later commit used to run the pilot must show `git diff --stat 29451c573 <run SHA> -- web supabase` empty (docs only), or this packet is void.

**Verified at the candidate:** see §9.

## 2. Game: earliest eligible
**Eligible means:**
- The launch is at least 30 minutes after TJ's approval of that game.
- The launch is at or before T−60 minus 4 minutes, so the 240 s claim budget ends by T−60.
- The status is FUT/OK at the pin.
- It is one game, and not 0326 or 0327.

**Proposed: 2026020328, CGY @ ANA** (from the G1 lookup; the pin re-reads `games` and `roster_optimizer_team_games` at launch and refuses any change):

| | ET (Sun 2026-11-15) | UTC |
| --- | --- | --- |
| Scheduled puck drop | 20:00 | 2026-11-16 01:00:00 |
| Acknowledgement deadline (T−60) | 19:00 | 2026-11-16 00:00:00 |
| Last possible claim (T−60 minus 240 s) | 18:56 | 2026-11-15 23:56:00 |
| Launch | attended, at least 30 min after approval, before 18:56 | before 23:56:00 |

**Same-night fallbacks:** 2026020329 (VAN @ VGK) and 2026020330 (NSH @ SJS), both 21:00 ET (02:00Z), with the last claim at 19:56 ET. **Next day:** 2026020331, MTL @ NYR, Mon 19:30 ET. A fallback runs only with its own approval.

- **Cutoff:** the input cutoff is the claim's own database clock at launch. The packet states its availability cutoff as the end of its read window plus 5 s.
- **Approval token:** `tj-p2-2026020328-20261115`. The launcher exports it as `FORGE_PREGAME_CAPTURE_APPROVAL`, and the script requires `--approval` to match.

## 3. Operator and verifiers
- **Operator:** Claude runs `operator/launch-capture.sh <export>/web 29451c573… 2026020328 2026-11-15 <token> <new out dir>` on TJ's Mac, with TJ present.
- **In-run verifier:** `verifyAndWitness`, on a separate client with the same `service_role` (D2). It:
  - reads back the committed bytes;
  - recomputes both hashes;
  - stamps the statement with one TSA call;
  - reads back again, and qualifies only if both the token bound and the final readback are by T−60.
- **Post-run:** one authoritative readback by claim id and offline re-verification, as for pilot 1. Astra's OpenSSL check is optional; its own readback is a separate approval (D4).

## 4. Timestamp authority
- **TSA:** DigiCert, `http://timestamp.digicert.com`. Only a SHA-256 digest leaves the process.
- **Probe:** passed and re-pinned (revision 3, `~/forge-pilot/probe-20261115T023745Z/`).
- **Revocation:** no online check (OCSP or CRL); the chain is checked to the pinned root and validity at genTime.

## 5. Limits (any breach fails the capture as `source_failed`, never a partial packet)
| limit | value |
| --- | --- |
| Read calls (builder + HTTP) | 600 (fixture world: 120–139 per game) |
| Rows / bytes total / bytes per response | 400,000 / 96 MiB / 24 MiB |
| Read window / stamp tolerance | 120 s / 5 s |
| Packet (gzip canonical JSON) | ≤ 32 MiB (database CHECK) |
| Claim budget | 240 s before T−60 |
| Save wait / RPC wait / TSA timeout / clock skew | 20 s / 10 s / 10 s / 2 s |

- **HTTP:** GET/HEAD only.
- **Relations:** the writer's audited input set minus its write targets.
- **Allowed RPCs (revision 4):** exactly `forge_latest_rolling_rows`, `forge_league_skater_physical_totals` and **`forge_latest_trend_bands`** (TJ, 2026-11-15), by GET.
- **New refusal:** a failed or incomplete trend-band read (an HTTP error, a short response, or too many keys) refuses the collection. The writer would run on without trend modifiers; the capture does not.
- **Refused as before:**
  - embedding off the allowlist;
  - schema-profile headers;
  - unfiltered reads outside `seasons`, `teams` and `nhl_xg_model_registry`;
  - any target-game result row;
  - any row stamped after its read.

## 6. Read/write footprint
- **Reads** (production Supabase, service role, one game):
  - **Pin:** `games`, `roster_optimizer_team_games`, `rosters` ×2, `fhfh_player_identities`.
  - **Collector:** exactly the writer's native input reads for 2026020328. The trend bands are now read by **one `forge_latest_trend_bands` GET per team** (2), replacing the capped history GET.
  - **Verifier:** two `forge_pregame_capture_read_v1` calls.
- **Writes** (schema `forge_pregame_capture` only, through its RPCs): 1 claim, 1 artifact, 0–1 save fence, 1 witness and 1 outcome.
- **Not touched:** forecasts, runs, revisions, serving, flags, cron, the rolling job.
- **External:** one TSA call.

## 7. Stop conditions
- **Before launch, stop if:**
  - the export SHA differs from `29451c573`;
  - either migration file hash differs from its authority row;
  - `gate.sh` fails (any DNS or load failure, or malformed output);
  - the clock is past 23:56:00Z.
- **During the run (automatic):**
  - Pin or claim refused: stop. `late_start` and `insufficient_time` record `never_dispatched`.
  - A transport refusal, calendar change, failed read or failed trend read: `source_failed`, and the claim is fenced.
  - A save is never retried. An unknown save is settled by claim id.
  - A TSA or verifier failure, a token bound after T−60, or a final readback after T−60: `saved_without_valid_witness`.
- **After the run:** one attempt only (one claim per game and policy). No re-run, other game or other policy without new approval.

## 8. Rollback and disable
- **Code:** nothing is deployed. The script runs only when invoked with every gate set. To disable, don't run it.
- **Database:**
  - `forge_pregame_capture_custody_rollback.sql` drops the custody schema, which destroys evidence; export the rows first.
  - `forge_latest_trend_bands_rollback.sql` drops the trend function; the writer falls back to the history GET.
  - Each needs its own approval.

## 9. Verified offline at the candidate (clean export of `29451c573`; no production, no external calls)
- **Typecheck and tests:** recorded in `CANDIDATE-29451c573-VERIFICATION.md`.
- **Trend-band reader:**
  - The selection is identical to the old reader for every player within the old cap (95/95 on a 10.5M-row production-shaped benchmark).
  - Stale players are reported as stale, and the writer's projections are unchanged.
  - Parity oracles were re-recorded with TJ's approval; the only changes are the trend read and the renamed counter (`trend-band-reader/ORACLE-DIFF-20261115.md`).
- **Custody SQL proof:** 113/113. **Trend function proof:** 18/18. **Apply-script self-test:** 10/10.
- **Rehearsal** (network trapped, 0 attempts), with the expected outcome in every case:
  - qualified;
  - late start;
  - ambiguous saves (committed and not committed);
  - ambiguous claim;
  - commit after the cutoff;
  - token in time but final readback late.

## 10. Needs TJ's approval (each separately)
| # | action | scope |
| --- | --- | --- |
| P2 | **Capture run, 2026020328** (live reads, private writes, one TSA call) | The candidate `29451c573`, policy `pregame-native-v1`, the limits in §5. Launched attended, at least 30 min after approval and before 23:56:00Z. Credentials come from `web/.env.local` for that run only. |
| D4 | Astra's own read-only readback | Optional, after the run. |

**Not part of this pilot:** push, deploy, flags, cron or hosted slate queue, forecasts, serving, reruns, or a second game.
