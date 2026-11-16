# News lineup binding repair: Ducks Flames and Islanders cards (dry run)

Script: `web/scripts/repair-news-lineup-binding.ts`. The planner is tested in `repair-news-lineup-binding.test.ts`. The dry
run made 7 read-only selects on 2026-11-16 and no writes.

| Card | Post | Game | Plan |
| --- | --- | --- | --- |
| `4de7ff1b-a49f-491b-8371-1989e8fae69b` | 2122126809533923555 (11/15 vs CGY) | 2026020328 | Repairable, partial: F1, F2, F4, D1–D3. F3 (Moore, rostered D) left out. |
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
