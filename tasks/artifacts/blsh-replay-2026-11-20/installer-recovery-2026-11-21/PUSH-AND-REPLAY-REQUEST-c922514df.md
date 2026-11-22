# BLSH R2c: exact push-and-replay request (Nov 21, 20:5xZ; 2:5x pm CT). NOT approved.

The governing batch is `recut-ctxgate-20261121/APPROVAL-BATCH-R2c.md` (`96566418…`), which incorporates R2 §3 steps 4–9 unchanged. This is a PARTIAL-fixture hosted replay. It is not live acceptance.

## Rechecked 20:50Z (read-only)

| Check | Result |
|---|---|
| `git ls-remote origin master` | `b37a0180d106412ede28cf7b6e5d73c89ffdae7e` |
| READY production (`fhfhockey.com`) | `dpl_7zstWTyQLKT3ff66vSoxmw1TKGBB` on `b37a0180`, READY |
| Candidate | R‴ `c922514df647ca30ae5b64dfa0f0fd32a754aeb1` = `refs/rc/blsh-replay-ctxgate-20261121-final`; fast-forward of `b37a0180`; all gates passed (R2c §2) |
| Sandbox | installed: 2/2/2, 13 tables, 39 functions, fingerprint `4399436c…` = reference, 0 lingering |
| Step-0 baseline | `outsideNarrowFingerprint` `4eebb963…`; capture off; jobs 404–407 unchanged; 0 replay or FORGE live jobs; no open transaction older than 1 h; Vault `cron_secret` 1 |
| Exposure | exactly `public, storage, graphql_public, analytics, blsh_replay_api` |
| Token | `BLSH_REPLAY_API_TOKEN` in Vercel production ×1 |
| Step-3 receipts (`receipts/hosted-r2c2-20261121/step3b/`) | 13/13 probes ok, exit 0, no JWT in any file |

## The request (approve as one packet; nothing runs before approval)

| # | Action | Pass condition | On failure |
|---|---|---|---|
| 4 | `git -C /Users/tim/Code/fhfhockey.com push origin c922514df647ca30ae5b64dfa0f0fd32a754aeb1:refs/heads/master` (fast-forward only; refused unless master is still `b37a0180`) | Exactly one `fhfhockey` production build reaches READY with SHA `c922514df…`. The other projects are canceled or ignored, 3 entries as for News. | No second build. Go to cleanup. |
| 5 | Arm the one-shot pair: `arm-replay-get-dated.sql` (`fb52ffb7…`), `-v run_date=2026-11-21`, native at minute M, context at M+2, M at least 3 min ahead | Both jobs fire once and unschedule | Rerun rule (one same-build rerun, transient only), else cleanup |
| 6 | Readback: `readback-replay-get.sql` (`b718049b…`) | **Native:** 200, `sha` `c922514df…`, `packet_complete_pending_review`, 20 objects, outbound `*.supabase.co` only.<br>**Context:** 200, `logicalIngressDay` 2026-11-20; tampered and unapproved grants 403; mismatched-date grant `outside_approved_date`; valid grant complete with 8 objects; context reader ok.<br>**Counts:** 28/2/1/1/20/8, PARTIAL labels. | Rerun rule or cleanup |
| 7 | Duplicate trigger: `arm-replay-get-repeat-dated.sql` (`7d98f348…`), new minutes, then readback | `already_claimed` ×2, `receiptWritten:false` ×2, counts identical | Report, then cleanup |
| 8 | Offline readers: `export_v1('2026-11-19')`, then `readback_export_dated.py` (`4d1cd538…`) with the deployment ID, `c922514df…` and `2026-11-21`, then `readback.ts` and `tls_rule_check.mjs` | Stage 1 refuses `capture_ingress_window_unconfirmed`; TLS rule refuses `tls_peer_unauthorized`; context reader ok | Report |
| 9 | Cleanup, in order: `disarm-replay-get.sql` (`5d201e3c…`) → **TJ unexposes only `blsh_replay_api`** → `reset.sql` (`8a763406…`) → `vercel env rm BLSH_REPLAY_API_TOKEN production --yes` → verify → mailbox slot release to RSO | 0 roles, schemas, memberships and replay jobs; `outsideNarrowFingerprint` = `4eebb963…`; exposure back to the four; token entries 0 | Report the exact residue |

## Timing (cutoffs: arm by 23:20Z = 5:20 pm CT; context by 23:50Z)

At an approval around 21:00Z (3:00 pm CT):

| Event | Time |
|---|---|
| Push | 21:00Z |
| READY (News took ~8 min) | about 21:10Z |
| Arm | ~21:12Z, firing ~21:15/21:17Z |
| Readback | 21:18Z |
| Duplicate | ~21:21/21:23Z |
| Readers | ~21:30Z |
| Cleanup verified (needs TJ to unexpose) | about 21:40Z (3:40 pm CT) |

That leaves about 2 h of slack before the arm cutoff. A rerun would add about 20 min. **The window works.**

## What stays after cleanup

The `c922514df` deployment stays live as production. Its replay routes refuse without the token (default-off). Its official-pilot code still carries the Nov 21-slate literals, which are inert: the migration is not applied and nothing is armed. The live pilot is the separate candidate `16f5c4603` (Nov 22 slate), with its own approvals.
