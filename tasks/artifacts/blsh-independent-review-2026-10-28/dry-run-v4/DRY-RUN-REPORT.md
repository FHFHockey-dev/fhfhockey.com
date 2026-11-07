# BLSH current-season dry run v4 (explanation v3.2; exploratory)

**What changed from v3:** only the explanation layer and how the assembler validates games. The score is unchanged. This run applies Codex's three v3.1 re-review findings (`CODEX-BLSH-EXPLANATION-V31-REVIEW-20261029`); the dispositions are in `../EXPLANATION-REVIEW.md` (v3.2 section).

**Run:**
- 2026-10-29, local, under the heavy lock, 139 s.
- **Runner status: 1 test passed, no unhandled errors, exit code 0.**
  - Earlier dry runs exited 1 with an unhandled Vitest error. The assembler now yields between players, and that error is gone.
  - The first v4 attempt, made before that change, is kept in `../dry-run-v4-failed-runner-error/` with its log. It also exited 1.
- Inputs: the same pins as v3, checked in code when each file is read.
- Versions: `blsh-current-windows-dry-run-v4`, explanation `support-gap-explanation-v3.2`.

## Checks

- **Score unchanged:** all 2,900 results (4 arms × 725 players) have identical score fields to dry run v3. As before, only the four declared axis additions are ignored in that comparison.
- **Real-window integrity (all 4 arms):**
  - 1,850 numeric scores.
  - Worst track reconciliation residual 2.4e-15; worst normalized residual 0.
  - No non-finite numbers.
  - No windows withheld for identity, mismatch, disagreement or invalid values. 392 reference windows are not supplied because no reference exists, as in v3.
- **No invalid per-game values in the real inputs.** No slot has a negative or non-finite count or exposure, and no window has ES or PP seconds above the total. So the per-game validation and the per-component exposure check change nothing on this data. They protect against bad inputs.

## What the explanations show differently

**36 of 2,900 profiles change, all in arm B with the official-receipt overlay.** That is the only arm whose current window can mix overlay and raw on-ice goals game by game.

| Delta withheld for `current_reference_mixed_revision_composition` | v3 | v4 |
|---|---:|---:|
| Assists per teammate on-ice goal | 0 | 35 |
| On-ice goals minus xGF per 60 | 0 | 6 |

In v3 these 41 deltas were shown with only a "revision unverified" flag. A window's `mixed:` label hid which of its games came from which source, so the two sides could have opposite compositions. v4 withholds them instead, and the window's per-game revisions are kept in its provenance. The "revision unverified" flags fall from 79 to 44 (assist rate) and from 37 to 31 (on-ice finishing) for that reason.

**Unchanged:** every score, list, tier and coverage reason except those 41 deltas.

**Status:** research-only and exploratory. It is not a trusted list, a forecast or trade advice. The history process gate is still the disclosed simplification, not the sealed v1 transport.
