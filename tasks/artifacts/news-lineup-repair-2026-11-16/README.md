# News lineup binding repair: Ducks Flames and Islanders cards (dry run)

Script: `web/scripts/repair-news-lineup-binding.ts`. The planner is tested in `repair-news-lineup-binding.test.ts`. The dry
run was rerun after TJ's F3 decision (read-only selects only, no writes).

| Card | Post | Game | Plan |
| --- | --- | --- | --- |
| `4de7ff1b-a49f-491b-8371-1989e8fae69b` | 2122126809533923555 (11/15 vs CGY) | 2026020328 | Repairable: F1–F4, D1–D3. F3 shows Ian Moore as "D listed at F" (reported). |
| `efe79d76-343b-47d3-add2-ae6054238cd8` | 2121794333800349973 (11/14 vs NYI) | 2026020324 | Repairable: F1–F4, D1–D3. |

- **Matching:** each card matched retained `line_source_snapshots` rows by original tweet and team. The rows agree on units
  and name one game, and that game involves ANA on the post's Eastern date. Full output: `DRY-RUN.json`.
- **Not shown on either card:** goalies and scratches. The retained interpretations have no goalie or scratch units, because
  the interpreter does not read `A | B` goalie lines. Changing that would change Lines, DRM and forecast inputs, so it needs
  its own approval.
- **Other affected cards:** read-only discovery (`--find --team=24`) listed 12 more Ducks cards with bad stored goalie tiles
  ("FlyTogether", "Power Play units", a PP line). The render-only change already makes them source-only. No repair is
  planned for them.
- **Apply:** `--apply` writes `metadata.newsLineup` to exactly the named ids. It has not been run and needs TJ's approval.

## F3 (CGY): why it was held back, and TJ's decision
- **What happened:** Moore, Washe and Killorn all resolved (8482178, 8485512, 8473986, all ANA). The interpreter rejected
  the row (`invalid_extraction`) because Ian Moore is rostered D and a forward row needs rostered forwards
  (`tweetInterpretation.ts:404`).
- **TJ's decision (2026-11-16):** for News cards only, show the row as a reported warm-up line, with "D listed at F" on
  Moore's tile.
  - The row must have exactly one rostered D, the other two players must be the team's forwards, and the D must appear in
    no defense pair. The row's only flag must be that position rejection.
  - Roster position, Lines, FORGE, RSO and forecasts are unchanged.
  - An ambiguous row (also in a D pair, two D, a goalie, an unresolved name, a short row) stays out and makes the card partial.
