# Proposal: one narrow hosted replay of the BLSH sandbox install (not approved; nothing has run)

## Scope

This proposal covers exactly one guarded hosted run of the pinned `install.sql` (`766aec3b…519b`) into the sandbox, followed by the read-only checks and then `reset.sql`.

It does not include any of the following:
- a build or deploy;
- a token or Vercel env change;
- exposing `blsh_replay_api`;
- cron or pg_net;
- arming;
- touching public, storage, cron, or BLSH production jobs 404–407.

It answers the single question that blocked Nov 20: whether this exact install can commit on hosted, and whether the guard classifies the outcome correctly there.

## Steps

All steps run as `postgres` through the session pooler, from this Mac with keep-awake on, at a slot TJ picks that avoids FORGE 0359 (close 18:01Z) and the Codex repair slot (18:10–18:15Z).

1. **Preflight (read-only).**
   - `state-probe.sql` must report 0 roles, 0 schemas, 0 memberships and 0 lingering backends.
   - There must be no open transaction older than 1 h.
   - The install.sql hash must match.
2. **Guarded install, exactly once.**

   ```bash
   HOSTED=1 MAX_ATTEMPTS=1 LINGER_WAIT_S=180 FULL=off INSTALL_DB=<pooler, from web/.env.local, never printed> PROBE_DB=<same> EXPECTED=receipts/fault-tests/EXPECTED.json OUT=<new dir> bash install-guarded.sh
   ```

   - **MAX_ATTEMPTS=1:** there is no automatic retry, even after `rolled_back_clean`. A further attempt needs its own approval.
   - **HOSTED=1:** the script refuses the test-only hook.
3. **Act on the verdict.**
   - **`committed_verified` (exit 0):** run `isolation-check.sql`, `denial-check.sql` and `reachability.sql`, all read-only. The first two must say ok; `reachability.sql` must report no BLSH-role reach to the two inherited grants.
   - **`rolled_back_clean` (exit 3):** stop and report the new attempt's `cause.json` separately from Nov 20's cause.
   - **Any STOP (exit 4):** do nothing further: no reset and no retry. Report `post.json` and `verdict.json` to TJ. If a lingering backend is listed, terminating it needs its own approval.
   - **`ambiguous_state` caused only by fingerprint parity:** for example, psql exited 0 but `functions` or `relations` differ from the local reference. Treat it as a STOP as well, and include the hosted `parts` for review. It is not a retry trigger.
4. **Cleanup in the same session, only after a `committed_verified` verdict.**
   - Run `reset.sql` (`8a763406…916e`): one transaction that drops both schemas and both roles and revokes the two memberships.
   - Re-run `state-probe.sql`. It must return to the step 1 values: 0/0/0, with `outsideNarrowFingerprint` equal to step 1's value.
5. **Receipts.** Save the probe JSONs, `cause.json`, `verdict.json`, the check outputs and the post-reset probe under `receipts/hosted-install-<date>/`. Update the BLSH diary and Master Task List.

## Footprint and cost

- **Database:** for a few minutes, 2 NOLOGIN roles, 2 private schemas (13 tables, 39 functions, about 377 KB of fixture rows) and 2 memberships (`authenticator` ⊃ `blsh_replay_api`, `postgres` ⊃ `blsh_replay_owner`). Nothing is exposed, so no Data API path exists. Then everything is reset.
- **Cost:** no Vercel build or function invocation, and no new paid resource. About 1,320 statements on the session pooler (about 40 s at the logged pace), plus read-only probes.
- **Stop conditions:**
  - any preflight failure;
  - any verdict other than `committed_verified`;
  - any check not ok;
  - a post-reset probe that doesn't match step 1.

## What it does not do

It does not deploy `cda345c4f` or run the BLSH native→context replay. Those still need the original batch's build, token and cron window, under a fresh approval. They should be proposed only after this install replay returns `committed_verified` and the reset is verified.
