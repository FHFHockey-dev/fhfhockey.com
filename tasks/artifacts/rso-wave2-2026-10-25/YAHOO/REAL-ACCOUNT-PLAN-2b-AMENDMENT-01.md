# Window 2b plan, amendment 01 (2026-10-27)

REAL-ACCOUNT-PLAN-2b.md is unchanged. This note records what changed since it was written.

- **Code baseline.** Released master is now 598942a78 (#393), not 0b21422db. `RSO_YAHOO_DIET` is still off in production, and the D4 migration is still not applied.
- **D6 add timing.** 107673704 removed the diet gate, so timing is now inferred from Yahoo `weekly_deadline` with the flag **off as well as on**.
  - In §3, the "Add timing (D6)" row is no longer an expected difference. Off and on must now **agree**: the same inferred value and label, and a manager override wins in both.
  - In A3, step (1) applies only if Planning setup still shows the timing as unknown.
- **Missing FORGE lines.** Since eff1b377a, an identified player with no FORGE line counts as a labelled 0 (`skater:no_forge_line`), so one unlined rostered player can't blank the baseline. The A3 gain check uses that baseline as it is.
- **Week position.** Window dates of 2026-10-27 (d = 1) or 2026-10-28 (d = 2) keep S ≤ 66, as §1 requires.
