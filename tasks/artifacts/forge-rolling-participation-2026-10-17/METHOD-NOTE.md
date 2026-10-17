# Rolling 14-day participation method: note for TJ

Approved 2026-10-17 (PRD `tasks/prd-forge-daily-pipeline.md`, "v2 decisions", item 2). Built 2026-10-17. Nothing is published, applied to frozen files, or committed.

## What it is

Three new method versions. Each one runs the roster-observation method unchanged except for the history window.

| Event | Method version | Input version | Bundle dataset | Release env key |
|---|---|---|---|---|
| Skater appearance | `skater-rolling-14d-appearance-frequency-v1` | `skater-rolling-14d-participation-input-v1` | `skater-rolling-14d-participation-bundle-v1` | `PLAYER_FORECAST_ROLLING_14D_SKATER_PARTICIPATION_RELEASES` |
| Goalie appearance | `goalie-rolling-14d-appearance-frequency-v1` | `goalie-rolling-14d-participation-input-v1` | `goalie-rolling-14d-participation-bundle-v1` | `PLAYER_FORECAST_ROLLING_14D_GOALIE_PARTICIPATION_RELEASES` |
| Goalie official start | `goalie-rolling-14d-start-frequency-v1` | `goalie-rolling-14d-start-input-v1` | `goalie-rolling-14d-start-bundle-v1` | `PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES` |

- **Window.** The 14 America/New_York calendar days before the cutoff's local date. It runs from local midnight to local midnight and excludes the end.
  - A cutoff at any time on Oct 13 ET gives [2026-09-29T04:00Z, 2026-10-13T04:00Z), which is exactly the frozen frame.
  - A window that spans a daylight-saving change is still 14 local days: 337 h across Nov 1 2026 and 335 h across Mar 8 2027.
  - Games on the cutoff's own local date are never in the window.
- **Unchanged.**
  - The estimator: at most 20 eligible games, positive-minute frequency, uncalibrated.
  - Game-instant listed eligibility and explicit labels (`positive_toi` / `explicit_zero_toi`).
  - Staleness rules: scope evidence older than 24 h and a latest eligible game older than 14 days.
  - The target roster-observation proxy and its known-conflict withhold.
  - Evidence identity and clock checks, and goalie relief versus start.
- **Labels from original receipts** (`rollingParticipationFrame.ts`).
  - Weekly `/v1/schedule/{date}` bodies define each club's regular-season games in the window. Every window date must be observed, and every receipt must be at most 24 h old at cutoff.
  - Final `/gamecenter/{id}/boxscore` bodies supply the labels:
    - listed with positive TOI → `positive_toi`
    - listed with zero TOI → `explicit_zero_toi`
    - not listed → unknown eligibility, never a negative
    - goalie starter flags come from `deriveNativeGoalieStarterLabel`.
  - The 8 walk-forward games of Oct 14–15 (2026020106, 108, 109, 110, 111, 114, 116, 117) are ordinary inputs. They are requested and labeled like any other game.
- **Existing versions untouched.** Frozen and roster-observation methods, their bundles and their release keys are unchanged. The new datasets have their own default-denied allowlists and never inherit roster-observation approval.

## Evidence it is the same method

- **Direct inputs.** For three cutoffs on Oct 13 ET (00:00, 07:00, 23:59:59.999999), the rolling methods match the frozen roster-observation methods exactly on probability, reasons, numerator, denominator, selected games and evidence hashes. This holds for 14 label and staleness variants across skater appearance, goalie appearance and start (84 cases).
- **Through original receipts.** Synthetic schedule and boxscore receipts produce the same match for:
  - positive, zero-TOI and unlisted skaters
  - a starter who is pulled (relief appearance, nonstart)
  - a backup with explicit zero TOI.
- **After the staged kernel-export patch (01).** The rolling methods call the frozen methods' own kernels, and the same tests pass.

## Consequences you should know before issuing

1. **Handover from v1.** The frozen v1 method accepts cutoffs only through 2026-10-27T04:00Z, so the Oct 26 07:00 ET run is the last v1 run. Rolling issuance can start with the Oct 27 run.
2. **An unknown label withholds the whole club.** Under the unchanged rules, one unknown game in a club's window (a missing boxscore, or a game not final in the schedule) withholds every player on that club until the window passes it.
3. **Any unlisted game withholds the player**, as it does today: a scratch, an injury or a new arrival. Under the rolling window that player returns 14 days after their last unlisted club game, instead of never.
4. **Schedule receipts must be fresh.** The frame builder fails closed on a weekly schedule receipt older than 24 h at cutoff, on a missing window date, on conflicting overlapping weeks, and on an unexpected or duplicate boxscore.
   - A game that is not final in the schedule (live or postponed) stays unknown until the window passes it.

## Decisions

- **Taken: walk-forward games released.** On 2026-10-17, after the Oct 15 issuance was scored, you released all 8 games that were still sealed.
  - Record: `FHFH-private/forge-walk-forward-20261014-v1/protocol/closure-amendment-20261017-v1.json`, sha256 `e2c5f491660f0004360d8eeb3a88d0414aac639300dc2322683d6816f323b364`. It sets `stillSealedGameIds: []`.
  - Rolling issuance from Oct 27 has no sealed-game nulls.
- **Still yours: approve the three method versions for issuance.** They are new methods and have never been issued, so the standing approval does not cover them. The first issuance needs your sign-off.

## Policy evidence text (first issuance)

> Rolling 14-day participation, methods skater-rolling-14d-appearance-frequency-v1, goalie-rolling-14d-appearance-frequency-v1 and goalie-rolling-14d-start-frequency-v1 (approved TJ 2026-10-17, PRD v2 decision 2). Same estimator, label, eligibility, staleness, evidence and conflict rules as the roster-observation methods. History is the 14 America/New_York calendar days before the cutoff's local date, half-open at local midnight. Labels come from original weekly schedule and final boxscore receipts: listed positive TOI, listed zero TOI, unlisted is unknown and never negative. The 8 walk-forward games of 2026-10-14/15 were released by TJ on 2026-10-17 (closure amendment v1, sha256 e2c5f491…) and are ordinary inputs. Equivalence with the frozen roster-observation methods for an Oct 13 ET cutoff is verified by tests. Uncalibrated; not a lineup or start confirmation.
