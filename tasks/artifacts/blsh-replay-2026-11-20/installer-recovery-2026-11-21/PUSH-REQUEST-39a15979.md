# BLSH R2b step 4: exact push request (draft; becomes final only after the step 2–3 probes pass)

**Not approved. Nothing has been pushed.** TJ approves this exact request separately (TJ, 1:35 pm CT).

## The one action

```bash
git -C /Users/tim/Code/fhfhockey.com push origin 39a15979651e004dad235fe70d86089595ec1092:refs/heads/master
```

- **What it is:** a fast-forward of `master` from `096b78b622a72a8378b8f60c0c7704fc4e2fee41` to R″ `39a15979651e004dad235fe70d86089595ec1092`, stored at `refs/rc/blsh-replay-ctxgate-20261121-onoffday`. No force, and no other ref.
- **What it adds over current master:** 50 files, namely `cda345c4f`'s BLSH content plus R′'s 9 files. These are the replay routes (default-off), the request-context date-gate seam, the held-reader pin, the official-pilot re-date code with its migration file (not applied), and the cron audit inventory.
- **FORGE:** the producer closure stays `0446100e…`, as the verifier receipt for R″ shows. FORGE's live code is unchanged.

## Preconditions, checked just before the push (any miss means no push)

1. `git ls-remote origin refs/heads/master` = `096b78b622a72a8378b8f60c0c7704fc4e2fee41`.
2. Production is READY on `096b78b62` (`dpl_2psc7uGM4UhXgEFHwmhrVx8GA3G1`), and no other build is in progress on any linked project.
3. The sandbox is installed, with a fingerprint equal to the reference `4399436c…` and nothing lingering. `blsh_replay_api` is exposed with exactly `public, storage, graphql_public, analytics, blsh_replay_api`.
4. `BLSH_REPLAY_API_TOKEN` exists in Vercel `fhfhockey` production; its value is never read.
5. `probes.jsonl` reports `failures: 0`, `pgsodium-probes.jsonl` has 4 lines with `ok: true`, and Chef has verified both.
6. The time is before 22:20Z, so the cron pair can be armed by 23:20Z.
7. A mailbox push-hold note is posted.

## Expected footprint

- **Builds:** 1 fhfhockey production build. functions and cms are canceled or ignored, as in today's 18:3xZ off-day push. Chef inventories the linked projects right after the push and reports any surprise.
- **After READY:** Chef checks that the deployment SHA is `39a15979…`. The R2b packet then continues at step 5 (cron pair), which needs its own go-ahead per TJ: "No push, build, or cron arming yet".
- **If the build fails:** no second build. Clean up per the packet: disarm (nothing armed), unexpose, `reset.sql`, `vercel env rm`.
