# BLSH v6 hosted fixture replay: approval batch R2 (recut R′, 2026-11-21)

**Status: proven locally only, on 2026-11-21 UTC.** Nothing has been pushed, built, deployed, installed, exposed, armed or written in production.
- This is a **PARTIAL-fixture hosted replay**, not live acceptance. The public gate stays closed.
- TJ path A, verbatim in `../TJ-INSTRUCTIONS.md` ("BLSH re-cut path A · Nov 21 ~17:40Z").
- Chef owns the release, the push and the TJ conversation. This lane never pushes.
- The BLSH install stays **HELD** ("Yes, keep it held", 17:37Z) until TJ approves this batch.

## 1. Candidate

| | |
|---|---|
| **R′** | **`0d8b141bc43750cc4da6c932d6fcaa87b0094f23`** = `refs/rc/blsh-replay-ctxgate-20261121` |
| Parent | `cda345c4f035a52ce7fc6eacfcae8fcec8902769` (the one approved integrated candidate) |
| Fast-forward | `origin/master` = `f47905d28718…` (`git ls-remote`, 17:5xZ). It is an ancestor of R′, so R′ pushes as a fast-forward **while master stays there**. |
| Made with | `commit-tree` from exact blobs, using a temporary index file. The main repository got no branch, worktree or checkout. Author TJ. No AI attribution. |
| Diff | `R2-DIFF.patch` (`f37f0d0c…a7`), 9 files, +298/−23 |

**Superseded and never to be used.** Both are dangling objects that no ref points at.
- `a2002688…` is an empty commit (tree identical to `cda345c4f`), from a shell word-split error.
- `1a77df8b…`: its run-1 proof stopped at the repeat-SQL refusal case, so R′ fixes that SQL's error message.

### Files (blob ids at R′)

| File | Blob | What changed |
|---|---|---|
| `web/lib/blsh/nativeCaptureV6/requestContextHandler.ts` | `1124a279…` | **Seam 1.** The optional `replayDateGate` dep is a pair of constants, not a clock. It is used only in the `outside_approved_date` line, and only when the signed source date equals the pinned date and the logical day is that date + 1. The live default export (`LIVE_DEPS`) has no such pin. |
| `web/scripts/blsh/readRequestContextV6.ts` | `1b1b3633…` | **Seam 2 (a held reader).** An optional `replayCaptureDay` pin, which defaults to `sourceDate + 1`. It must be at least `nextDay` and inside the season, and it is echoed in the receipt only when set. |
| `web/lib/blsh/replay/hostedReplay.ts` | `cd04fc6c…` | Wires both seams:<br>- `REPLAY_LOGICAL_INGRESS_DAY` = `2026-11-20`, derived from the existing gate-clock constant;<br>- the reader pin = the real UTC day of the context route's ingress;<br>- the context receipt gains `unapprovedGrant`, `mismatchedDateGrant` and `logicalIngressDay`. |
| `web/lib/blsh/nativeCaptureV6/requestContextHandler.test.ts` | `59f0b602…` | Four new tests. The fixture takes a day. |
| `web/scripts/blsh/readRequestContextV6.test.ts` | `82d7ab04…` | Two new tests. The fixture takes a day. |
| `web/lib/blsh/replay/hostedReplay.test.ts` | `b5b86940…` | Pins the logical day. |
| `tasks/artifacts/blsh-replay-2026-11-20/hosted-r2/arm-replay-get-dated.sql` | `526858e3…` | New operator SQL. |
| `tasks/artifacts/blsh-replay-2026-11-20/hosted-r2/arm-replay-get-repeat-dated.sql` | `44e21e1a…` | New operator SQL. |
| `tasks/artifacts/blsh-replay-2026-11-20/hosted-r2/readback_export_dated.py` | `2a8f4af3…` | New operator copy. It writes `replayCaptureDay`. |

**A scope note for TJ: three parts of the diff go past "the replay context date gate, its tests and new operator SQL".**
- **Seam 2, the held reader** (detailed below). This is the main one.
- **`readback_export_dated.py`.** This is an operator copy, not SQL. It passes the operator's `RUN_DATE` to the reader as its pin.
- **Two refusal probes in `hostedReplay.ts`.** It now sends two extra refusal grants, `unapprovedGrant` and `mismatchedDateGrant`, and adds `logicalIngressDay` to the receipt. That gives hosted evidence that a wrongly keyed or wrongly dated replay grant still refuses. Both grants are refused before any I/O.

On seam 2:
- **Why it is needed.** The held request-context reader checks, at line 100, that the native retrieval and the context claim both fall on `sourceDate + 1`, using **real** database stamps. A replay run on Nov 21 has real Nov 21 stamps, so without a pin it always fails `context_clock_mismatch`, and the native → context → reader chain cannot pass on any other day.
- **How it is bounded.**
  - The pin is optional, and absent it behaves exactly as before.
  - `prepareV6Observation.ts`, the live caller, never passes it.
  - The replay supplies it from its own real ingress time, never from the export it verifies.
  - The operator supplies it as `RUN_DATE`.
  - It is echoed in the receipt.
- **Not in `SOURCE_PINS`.** None of the 9 files is pinned there.

### What stays byte-for-byte unchanged (re-verified today, not rerun)

| Item | sha256 |
|---|---|
| Envelope (Drive `1UG0nCC6…`) | `f2525c71e662da43b0ac36ac479ac27c354044273c5f6b02c493d74eb3046d44` |
| `install.sql`. Regenerated today from the envelope by `sandbox_sql.py` `37cc8fad…`, `cmp`-identical. | `766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b` |
| `reset.sql` | `8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e` |
| `FIXTURE-LABELS.json` (PARTIAL) | `ed13c5ffb0ae3d24af8a363f8af1c8d642013331cc8b97c17df52b8ca8b3567e` |
| The installer evidence, **reused, not rerun**: `FAULT-TEST-RECEIPTS.md` (9/9 disconnect faults), duplicate install 14/14 | `5626607c63737c3fae4e03ce01f9401772de6dcd501babef801c3ff97cde7d88` |
| `install-guarded.sh` | `a6cfcac12c4c7c6dbe51df83fa7088b82034d346d63aec51796f2120bf650c81` |
| `run-hosted-install.sh` | `d22a2704095b8bd77d13332433cc851abab8d4cf816299827a319ee2ada8ea95` |
| `state-probe.sql` | `9b9317850fb5ca3ab26b97b196df92ed4f71fb5906d446ab4fea2987f05cc9b7` |
| Kit (`blsh-hosted-kit/MANIFEST.sha256`): `isolation-check.sql` | `5f01c742b005a5701b798ef21594b1acd71e10f0fa4f0fbca4b2fd96cb79607b` |
| `denial-check.sql` | `9b4f7da6ec50b933e51b1c90909e0f65fd0697237261d770859a86520c3a4ced` |
| `reachability.sql` | `01348d2680a5cdcb966d54852042b02f99aab0572efcf41e053520698bbe002d` |
| `probes.sh` | `282a86a63ed4686d1c7a32b068348ea8881ed677e6b18348abca815d376c7907` |
| `token_setup.py` | `45b3b87b5473e8eeca7b1ae933e39ea13c1e7bad85af0a1394e71cc93bca8d58` |
| `disarm-replay-get.sql`. Its job names are unchanged, so it applies as is. | `5d201e3ca381c38b1ce39f1343ee5adf6bbccf1c34ac708cb72380b961882cc9` |
| `readback-replay-get.sql` | `b718049be3ecfc74c6e5f3a89902848922be934e27ffc7c22d8d3e2ea1366a74` |
| `tls_rule_check.mjs` | `c0fbd5a7e937e0fe41b21f792702400fd8b5252b191a2f7927cc7d03a9af02af` |
| v6 harness `readback.ts` (`99fb9638a`) | `5422e0d2e0b7033ec30b2441172868a1440bfba57665a2c751c12bf3dc14bd43` |
| The pinned originals `arm-replay-get.sql` / `-repeat.sql` (not edited, still refuse today) | `44c00e03…39bb6aca` / `ef988616…cb434b93` |

### New artifacts (this folder; the three operator files are byte-identical to R′'s `hosted-r2/` blobs)

| File | sha256 |
|---|---|
| `operator/arm-replay-get-dated.sql` | `fb52ffb73670e9ab15ae11e7d6999d8f22e8db3281902433d0e1abaf3ac9c445` |
| `operator/arm-replay-get-repeat-dated.sql` | `7d98f34872a6bc278f127df3fa40c1bdaf2ccca30aed2f6ad6cca586b4961a56` |
| `operator/readback_export_dated.py` | `4d1cd53866e16a08d17d5de96e6fe15680266c2538d98644748b0047f673fe44` |
| `operator/local_proof_r2.sh` (local only; diff vs `local_proof.sh` `f57adfbb…` in `local_proof_r2.vs-original.diff`) | `8cfe586dcc9916d90cc9aa7f0e615aa6e2d220961e94c47d84a3b6c1b7aaadcf` |
| `R2-DIFF.patch` | `f37f0d0c5cbb33b3b10dbc3b5c16efdfe7ac3eacc6f33ecd281aaa00667dd7a3` |

**What the dated SQL does.** Both files copy the originals' preflight, table, function and cron commands unchanged (see the `*.vs-original.diff` files). They add three psql variables, `run_date`, `schedule_native` and `schedule_context`, and refuse unless every rule below holds:
- `run_date` equals today's UTC day and falls within **2026-11-20..2026-11-26**. The native plan refuses the Nov 19 slate from Nov 27 00:00Z (the 8-day bound in `nativeProcessCapturePreparation.ts`).
- Each schedule is the exact `M H D Mo *` form, on `run_date`.
- The native firing is more than 1 minute away.
- The context firing is at least 2 minutes after the native firing, and no later than **23:50Z**.

The repeat file also checks that the requests table exists before its other preflight checks. The pinned original fails there with "relation does not exist", so the copy refuses with `replay_repeat_preflight_failed` instead.

## 2. Gates on exact R′ (all run 2026-11-21 UTC, real clock, a day other than 2026-11-20)

| Gate | Result | Evidence |
|---|---|---|
| `local_proof_r2.sh` on a clean checkout of R′, with the `99fb9638a` harness and kit overlaid as untracked files. The checkout is a throwaway repo under `/private/tmp` with HEAD = R′ and 0 tracked diffs, because the script and `requestContextStore.test.ts` read `git rev-parse HEAD`. | **24/24** `proof.json`. The 24-check block is byte-identical to `local_proof.sh`'s. Exit 0. | `evidence/local-proof-r2-0d8b141bc/` |
| Negative controls in the same run | **11/11** `negatives.json` | as above |
| Dated SQL on disposable PG15 | Accepted 3 times (arm, repeat, rerun arm); **13/13 refusals**, each leaving cron, the request table and `net` unchanged | `sql-refusals.jsonl` |
| Focused vitest: `lib/blsh/replay`, `lib/blsh/nativeCaptureV6` (all), `readRequestContextV6`, `readNativeV6Ledger` | **210/210**, 16 files, 0 skipped | `evidence/vitest-focused.txt` |
| `vitest related` on the 3 changed sources, which includes `prepareV6Observation.test.ts` (the reader's live caller) | **152/152**, 5 files | `evidence/vitest-related.txt` |
| Mutation check: the new tests run against `cda345c4f`'s handler and reader sources (in the working copy) | 4 of the 7 new tests fail on the base: the 2 replay-gate handler tests and both reader tests. The other 3 assert refusals that also hold on the base: the live route, refused replay grants, and the replay constant. The constant test was not run against the base, because the base has no such export. The output was not saved. | diary |
| No stale hash pins | The sha256 and blob ids of the 6 changed TS files at `cda345c4f` appear nowhere in the R′ tree (`web/`, `tasks/TASKS/`, `supabase/`) | diary |
| Stage-2 `SOURCE_PINS` at R′ (`git cat-file` on the commit, as `verifySourcePins`) | **10/10**; `reviewNativeV6Packet.mjs` unchanged | `evidence/source-pins.json` |
| `npm run typecheck` | **exit 0** | `evidence/typecheck.txt` |
| `npm run lint` | **exit 0**: 0 errors, 69 pre-existing warnings, none in touched files | `evidence/eslint.txt` |
| CSS-module pure check (Next's `postcss-modules-local-by-default`, pure mode) | **241/241** `.module.scss`. R′ changes no styles. | `evidence/css-pure-check.json` |
| Fast-forward vs `origin/master` | yes (`f47905d28`) | above |

**What the proof showed** (run-2, real day 2026-11-21):
- **Native GET:** 200 in 22.4 s, `packet_complete_pending_review`, 20 objects.
- **Context GET:** 200 in 0.1 s, and every grant behaved as expected:
  - tampered grant: 403 `approval_invalid`;
  - grant from another key: 403 `approval_invalid`;
  - grant signed for 2026-11-18: 200 `outside_approved_date`;
  - the live route given the test grant: 403;
  - the valid grant: complete, 8 objects. The context reader passed with `replayCaptureDay` `2026-11-21`, and the operator reader passed too.
- **Every response** carries `sha` `0d8b141bc…`.
- **Repeat:** `already_claimed` ×2, counts identical, `receiptWritten:false` ×2. A second first-arm is refused.
- **Rerun path:** complete. The final reset brought roles, memberships and the outside-sandbox bytes back to the pre-install state.
- **Isolation:**
  - 0 NHL and 0 NST hits at the network front;
  - only the Supabase host contacted;
  - 0 live rows;
  - the bytes outside the sandbox identical before and after;
  - the denial matrix held.
- **Readers still reject the replay:**
  - stage 1: `capture_ingress_window_unconfirmed`;
  - the stage-2 TLS rule: `tls_peer_unauthorized`.
- **The live route on Nov 21:** a correctly signed live-key grant for 2026-11-19 POSTed to `/api/v1/db/blsh-request-context` returned 200 `{"state":"skipped","reason":"outside_approved_date"}`, with sandbox, live counts and front hits unchanged.
- **Real time stays real:**
  - the native retrieval and the context claim are stamped on 2026-11-21;
  - in vitest, a native run from another day, or one not yet closed at ingress, is refused as `native_source_unverified` (the same-day and `closed ≤ now` checks).

## 3. The batch (Chef applies; one approval)

Every psql call is `psql "$DB" -X -A -t -v ON_ERROR_STOP=1`, as `postgres`, through the session pooler, from this Mac with keep-awake on.

| # | Step | Artifact | Pass condition | On failure |
|---|---|---|---|---|
| 0 | **Read-only preflight** | `git ls-remote origin master`; `state-probe.sql`; the kit `RUN.md` §0 queries; the Vercel inventory (6 projects) | All of these hold:<br>- master is still `f47905d28` (else see §5);<br>- production is on master;<br>- no FORGE live run is armed;<br>- the release hold is posted;<br>- 0 `blsh_replay*` roles, schemas or memberships;<br>- 0 `blsh-replay-%` jobs;<br>- no open transaction older than 1 h;<br>- the Exposed-schemas value is noted;<br>- the UTC day is within 2026-11-21..26 and the time is before the §4 cutoff;<br>- the capture kill switch `public.blsh_capture_control.enabled = false` (off since 11-16), with live BLSH jobs 404–407 unchanged (ids, schedules 12:05/12:20/12:50/12:52Z, active);<br>- the hosted pre-install `outsideNarrowFingerprint` equals `4eebb9633ba7e4718a82f12435ea4ecb` (read 17:01Z and 18:16Z; receipts in `../installer-recovery-2026-11-21/receipts/hosted-readonly-r2-prep-20261121/`), and the step-0 value is recorded;<br>- `cron.timezone` reads null through the pooler. The dated arm SQL coalesces null to GMT, which it accepts (`coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC')`, confirmed in `arm-replay-get-dated.sql` line 30). | Stop |
| 1 | **Guarded install, once** | `HOSTED=1 MAX_ATTEMPTS=1 LINGER_WAIT_S=180 bash install-guarded.sh` on `install.sql` `766aec3b…` | `committed_verified` (exit 0) | Exit 3: report and stop. Exit 4: **STOP, no reset.** |
| 1b | **Read-only checks** | `isolation-check.sql`, `denial-check.sql`, `reachability.sql -v exposed='<noted>,blsh_replay_api'` | All `"verdict":"ok"`. The only findings are the 2 accepted inherited grants, proven unreachable. | `reset.sql`, then stop |
| 2 | **Temporary access** | Add `blsh_replay_api` to Exposed schemas (dashboard), `notify pgrst` | `probes.sh`: exit 0, `failures:0`, 9 lines `ok:true`. The PGRST106 hint equals the noted list plus the sandbox. | Unexpose, `reset.sql`, stop |
| 3 | **Token, before the build** | `token_setup.py --hours 23` → Vercel `fhfhockey` production `BLSH_REPLAY_API_TOKEN` (sensitive) | The variable exists; its value is never printed | Stop |
| 4 | **Single build** of R′ (a separate push approval, Chef) | FF push of `0d8b141bc…` | The deployment for that exact SHA is READY. The other projects are canceled or ignored (expected 1 fhfhockey build + 3 cancels; re-inventory first). | Stop. No second build. |
| 5 | **One-shot cron pair** | `arm-replay-get-dated.sql -v run_date=<today> -v schedule_native='<M> <H> <D> <Mo> *' -v schedule_context='<M+2> <H> <D> <Mo> *'` (`fb52ffb7…`) | Both jobs fire once and unschedule themselves | Rerun rule |
| 6 | **Readback** (read only) | `readback-replay-get.sql` (`b718049b…`) | **Native:** 200, `sha` = R′, `packet_complete_pending_review`, 20 objects, every fixture `ok`, outbound only `*.supabase.co`.<br>**Context:** 200; `logicalIngressDay` `2026-11-20`; `tamperedGrant` and `unapprovedGrant` 403 `approval_invalid`; `mismatchedDateGrant` 200 `outside_approved_date`; `liveRouteWithTestGrant` 200 `disabled` (no live key) or 403; valid grant complete, 8 objects; `readers.context.ok`, with `replayCaptureDay` = today.<br>**Sandbox:** 28/2/1/1/20/8 and the PARTIAL labels; other cron jobs unchanged. | Rerun rule |
| 7 | **Duplicate trigger** | `arm-replay-get-repeat-dated.sql`, same variables, new minutes (`7d98f348…`), then step 6 | `already_claimed` ×2; `receiptWritten:false` ×2; counts **identical** to step 6 | Report; cleanup |
| 8 | **Offline readers** | `select blsh_replay.export_v1('2026-11-19')` → `readback_export_dated.py export.json OUT <deploymentId> 0d8b141bc… <run_date>` (`4d1cd538…`) → harness `readback.ts` + `tls_rule_check.mjs` | Stage 1 refuses `capture_ingress_window_unconfirmed`; the TLS rule refuses `tls_peer_unauthorized`; the context reader is ok, with `replayCaptureDay` = `run_date` | Report |
| 9 | **Cleanup, in order** | `disarm-replay-get.sql` → unexpose and restore the noted value → `reset.sql` → `vercel env rm BLSH_REPLAY_API_TOKEN production` | 0 roles, 0 schemas, 0 memberships, 0 replay jobs. The post-reset `state-probe` equals step 0, including `outsideNarrowFingerprint`. The retired token gets a non-200. | Report the exact residue |

- **Rerun rule.** At most one same-build rerun, and only after a transient or `rolled_back_clean` failure: disarm, unexpose, `reset.sql`, then steps 1, 1b, 2, 5 and 6 with new minutes. Never after an ambiguous verdict. Rehearsed locally: `rerun.json`.
- **Runtime.**
  - **Measured locally:** native 22.4 s, context 0.1 s, repeat under 0.1 s each.
  - **Wall clock:** about 45–60 min end to end. Steps 0–3 take ~15 min, the build ~10–15 min, steps 5–8 ~10 min and cleanup ~5 min.
- **Footprint.**
  - 1 fhfhockey production build plus the other projects' canceled entries;
  - 4 route invocations, plus 2 if rerun;
  - about 90 Data API calls and about 1,320 install statements;
  - **for under 1 h:** 2 NOLOGIN roles, 2 private schemas, 1 exposed schema and 1 env var;
  - 0 NST requests (the fixture adapter), 0 live-table writes, no new paid resource.
- **Rides in the same build** (unchanged from `cda345c4f`): the replay routes, the official-pilot re-date files and migration file `20261120143000`, and the cron audit inventory. Step 0 confirms, read-only, that the re-date migration is not applied, that the capture kill switch `blsh_capture_control.enabled = false`, and that jobs 404–407 are unchanged (ids, schedules, active).

## 4. Stop conditions (any one: stop, then step 9 if anything was installed)

- **Date and clock:**
  - the real UTC day is outside 2026-11-21..2026-11-26;
  - arming would put the context firing after 23:50Z;
  - native and context would straddle 00:00Z (the dated SQL refuses this).
- **Moved state:**
  - master moved off `f47905d28`, or the READY deployment SHA ≠ `0d8b141bc…`;
  - a FORGE live run is armed;
  - the Codex repair slot is in use;
  - the off-day release is mid-push or mid-build.
- **Check failures:**
  - `public.blsh_capture_control.enabled` is true, or jobs 404–407 differ from step 0 (ids, schedules, active);
  - the post-reset `outsideNarrowFingerprint` differs from the step-0 value;
  - any verdict that is not `ok`, any extra finding, or any probe failure;
  - a hosted install fingerprint mismatch (stop; never retry);
  - any route `sha` ≠ R′;
  - `nonSandboxOutbound` not empty, or any live row count above 0;
  - an ambiguous result.
- **A changed value means re-gating:** if any artifact hash differs from this file, do not run.

## 5. Slot: earliest safe hosted window, with the real conflicts

The clock read 17:51Z when this was drafted.

| Conflict | Window | Source |
|---|---|---|
| Codex repair slot (36 `team_id` rows) | **18:10–18:15Z** today | Chef diary (`2026-11-19-claude-forge-blsh-chef.md`); mailbox |
| FORGE | 0359 is published, terminal and cleaned (17:25–17:27Z; jobs 421–424 gone, 408 off, `forge_witness_api` unexposed at 17:26Z). No other FORGE live run is armed today, so FORGE's remaining exposure is the recovery run below. Daily FORGE jobs: 10:05 / 10:12 / 10:25Z. | `2026-11-21-claude-chef-offday-release.md` |
| Astra/Chef off-day release | Lane reports due **19:05Z**; TJ packet **19:30Z**; RC `096b78b62` wants its own production push and build. Recovery option B (a scoped `run-projection-v2` for 13 games, a FORGE production write) has a **latest safe start of 20:10Z**. 13 games start between 20:30Z and 03:00Z. | `2026-11-21-claude-chef-offday-release.md` |
| BLSH live pilot (re-dated) | Nov 22, 12:05–12:07Z capture window | proposal §4 B |
| Replay validity | Same real UTC day for both stages, context ≤ 23:50Z; last usable day **2026-11-26** | this file §1 |

**The real conflict is the single build.** The off-day RC `096b78b62` is checked to descend from `f47905d28` (parent `e2f8c6bc9`, 5 files). Its files do not overlap R′'s diff over `f47905d28`. Both need a production push of master, so whichever lands second is no longer a fast-forward. If the off-day release goes first, R′ is re-merged onto the new master. The merge is textually clean, but it gives a new SHA, so every gate in §2 is rerun (~25 min) and the hashes in this file are updated.

- **Earliest safe start: 18:20Z today**, only if TJ and Chef put BLSH **first**:
  - after the Codex slot closes (18:15Z);
  - with the off-day push held until BLSH cleanup is verified (~19:20Z).
  - This squeezes Chef's 19:05Z lane integration and 19:30Z packet.
- **Recommended: about 20:30Z today**, after the off-day release and any recovery run (latest start 20:10Z) are read back:
  - re-gate R′ on the new master if it moved;
  - arm no later than 23:20Z, so the context firing lands by 23:50Z.
- **Fallback:** any day through 2026-11-26, outside the Nov 22 11:45–13:00Z pilot window and the 10:00–10:30Z FORGE daily window.
  - TJ said not to wait for a game or re-date the pilot, and this needs neither.
- **One-build option** (Chef's call): fold R′ into the off-day release candidate, so one production build carries both. It needs a merge (a new SHA) and both lanes' gates rerun on it.

## 6. Residuals for TJ

1. **Reader seam:** see the scope note in §1. It is the minimum change that lets the reader pass on another day. The live default is unchanged.
2. **Context packet acceptance (carried over from R1):** the context reader accepts the replay's context packet as `request_context_readback_pending_review` with the real deployment ID and SHA. Three things contain it:
   - its native source fails stage 1 and the TLS rule;
   - its key lived only in memory;
   - it exists only in the private sandbox.

   R′ adds `replayCaptureDay` to the reader receipt, which marks a replay-day read whenever it differs from `sourceDate + 1`.
3. **Not proven locally:**
   - the Vercel runtime (Fluid, `/tmp`, bundling);
   - managed PostgREST and the Exposed-schemas reload;
   - real pg_net and Vault;
   - Supavisor;
   - latency.
