# Master Task List delta · FORGE live run, 2026-11-21 (paste-ready for Scout)

## Done

- **FORGE live acceptance passed on a real game, 2026020359 (EDM @ CAR, 18:00Z):**
  - capture qualified at 16:20Z, claim `f55203dc…`;
  - the independent signed witness accepted it at 16:30Z (key `469bc6093b6ffc11`), before the T−60 deadline;
  - exactly one publication at 17:25:05Z (revision `365d0704…`), 35 minutes before puck drop.
  - Both RSO readers trace to the same claim: Daily has McDavid at C#1 with 3.812, and Detailed reports missing_participation. Every stage ran on release `f47905d28`.
  - Readback receipt: `tasks/artifacts/forge-live-release-2026-11-19/live-0359-20261121/READBACK-0359.json` (sha256 `30f6e72b…`).
  - Cleanup verified: 0 live jobs, job 408 off, and `forge_witness_api` unexposed (PGRST106).
- **Writer guard clean on production data:** Nov 19 rolling rerun, 2,160 rows (432 players, 12 games). No identity refusals and 0 null game_id.
- **Pre-arm gates all passed:**
  - production equals master `f47905d28`, READY;
  - read-only capture rehearsal: 227 reads, 0 refusals;
  - the Edge verifier idle smoke passed.

## Found / follow-ups

- **Off-day blocker:** an NHL off-day (Nov 20) stopped the daily pipeline at `update-nst-gamelog`, so the rolling writer never ran. The fix is commit `37a43ad9a`, local on octoberBranch and not released. It needs TJ's release decision.
- **0358 verdict side effect:** the first Edge smoke after exposure recorded a signed "rejected, artifact_missing" verdict for the Nov 20 failed claim of game 0358 (`33a516aa`). It is accurate and harmless.
- **Detailed reader:** it still reports missing_participation for 0359 (identity_conflict game exclusion), the same as the sealed replay. It is known and not a gate.
- **Score difference:** McDavid's 3.812 differs from the sealed baseline's 3.8285 because the live inputs now include the Nov 19 rolling rows. This was expected.

## BLSH

The BLSH lane owns BLSH: the "11/21 || BLSH Lane" session.
- **Installer recovery:** the pinned `install.sql` `766aec3b…` was recovered and verified, and the disconnect fault tests passed 9/9 (`tasks/artifacts/blsh-replay-2026-11-20/installer-recovery-2026-11-21/`).
- **Original cause:** the cause of the Nov 20 hosted disconnect couldn't be determined from the retained logs.
- **Hosted install:** HELD at 17:32Z under TJ's newer BLSH instruction (proposal only).
- **Blocker per the BLSH lane:** `cda345c4f`'s context stage passes only on UTC 2026-11-20, so a new candidate is needed.
