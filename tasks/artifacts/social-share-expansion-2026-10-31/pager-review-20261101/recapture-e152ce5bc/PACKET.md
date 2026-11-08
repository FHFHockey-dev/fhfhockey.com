# Pager packet at e152ce5bc (2026-11-03)

This packet is from the Social Share owner (session `local_c4fd32c8`, transcript `799e2b6c`) to the pager reviewer, thread `01a198a0-979b-71c9-a442-3d0218479035`.

## Pin

The fix candidate is `e152ce5bca1aa77e29a43acd33eb7e9ae0d0ac62`. It includes F2 `f56ba565cd89cf9345e61fbaae8839f5ac6c7246` and F3 `e152ce5bc`. Against merged `295b384da`, exactly these 10 application files differ (SHA-256 of each blob at the pin):

```
43077bb8684a6528d6935848f0d2ec6a07d01b28e30763a90706f20b41298f96  web/components/SocialShare/PeriodControl.tsx
c9b4cb5ece9dfecd6bf7cf02d7404b8fcd928b5dd94000344bba7c40204a0e18  web/components/SocialShare/PostStudio.test.tsx
26abfbb6fe8297ae5724115115a5a896bfa945f520f9a286b4df8efe274f500f  web/components/SocialShare/modules/LastNightsStandoutsCard.tsx
2121fa9e68d6ae6cf2ea1e1c61573dd28200bbf07a85992a7d92a23a661ec859  web/components/SocialShare/modules/LastNightsStandoutsPanel.tsx
94320e77852c2b1f4cb8652db7bb002177593399246947b4a143a5440cd31d58  web/e2e/social-share-last-nights-standouts.spec.ts
ac5b1ba8669e1d7e4eda329065b4b6265c3fb52d8648487179eacf03a6133b1a  web/lib/socialShare/modules/lastNightsStandouts.sources.ts
211e319475ceb4920ec3906f6a5e767abdea3bdc1e75ae6d84b84a843a654187  web/lib/socialShare/modules/lastNightsStandouts.test.ts
45ebb649df273d66149b85bfaefe7b861d0e779b844f513623f2ea4ad708db77  web/lib/socialShare/modules/lastNightsStandouts.ts
34733840df209564fdf20b9b904f1cf78a047da7a002a724a67e9af067ee4461  web/lib/socialShare/modules/shared/periodWindow.test.ts
1601313b43db7652b348f7f78329934cd69e47a353b34c1db913bb884ba80105  web/lib/socialShare/modules/shared/periodWindow.ts
```

## Lane receipts since 295b384da

- **F2 (owner):** `cc263466a` and `f56ba565c`, in PeriodControl, periodWindow and PostStudio.test.
- **F3 (lane B):** `e152ce5bc`, in the Standouts sources, card, panel, test and e2e spec.
- **Lanes D, F, G and H:** no application change since `295b384da`. Their period work is as merged there. Lane F's legend and layout ship with the Busy/Quiet and Rescue cards in that tree, so the regenerated captures below show it.

## Real-calendar recapture

The 13 "Weeks unavailable" renders were a capture gap, now replaced:

- **Clean clone at the pin:** `run31.sh`. The only dirty file is `web/next-env.d.ts`, which the Next dev server rewrote. It ran on port 3125 with a fictional `.invalid` Supabase env, so no other server was reused.
- **Calendar bytes:** the route's own loader, `loadMatchupWeeks`, made one request, read at 2026-11-03T16:37:44Z. It went to `yahoo_matchup_weeks` with status 200, content-range `0-26/27`, 27 rows.
  - The body is `calendar-response.json`, SHA-256 `96f7e60a7932a59e8ea727b8b1637e400b50f9befba5169ff886278091f193c1`.
  - Its provenance and the request log are in `calendar-provenance.json`.
- **Replay:** `rr31.spec.ts` replays the 17 retained real editions (`inputs/`, made 2026-11-01 14:45 ET). `/api/v1/social-share/matchup-weeks` sits behind a Bearer check (no Bearer → 401) and serves those rows with each edition's own cutoff.
- **Pager results** (`render-report.json`):
  - 13 of 13 pager posts show real labels.
  - 0 show "Weeks unavailable", the "could not be read" alert or the refresh-failed alert.
  - Every matchup-weeks call returned 200.
  - Each post stepped once and came back:
    - Week 6 · Nov 2 to Nov 8 → Prior → Week 5 · Oct 26 to Nov 1 → Next → Week 6 (Off-Night Edge, Risky Starts and Start/Sit next weeks);
    - Week 4 · Oct 19 to Oct 25 → Prior → Week 3 · Oct 12 to Oct 18 → Next → Week 4 (the other nine).
  - The URL `week` followed the label each time.
- **PNGs:** 14 of 17 exported from the retained editions.
  - `risky-past`: disabled by design. A past week has 0 upcoming starts, so the pool is empty. It was the same in the original run.
  - `busy-custom` and `rescue-w4`: disabled in replay because their retained editions predate `adba00bba`'s min-starts setting, so the card printed "Min undefined". I regenerated both at the pin with 14 bounded reads (6 and 8) through the public client (`rr32.test.ts`, `run32.sh`, `inputs-regenerated/`). Both are ready, and both exported (`*-regenerated.png`, `render-report-regenerated.json`). Rescue's pager also stepped Week 4 → Week 3 → Week 4.
- **Hashes:** `SHA256SUMS` covers the inputs, calendar body and provenance, both reports and the scripts.

## Not claimed

- **F2:** not exercised in the browser across a midnight rollover. Evidence is the PostStudio.test.tsx cases at the pin and your own replay.
- **F3:** the Standouts replay uses a retained edition made before `e152ce5bc`'s loader change. Evidence is the unit and e2e tests at the pin.

## Batch status: the integrated pin is not frozen

TJ's 2026-11-03 card notes joined the same release batch, and they touch both finding surfaces:

- `387a6df7f`: a shared late-feed helper (`completeThrough`), plus `pageNotes` in contract, server and PostStudio.
- In flight:
  - PeriodControl and PostStudio refresh on their own, and the "Refresh post" button is removed. This is the F2 surface.
  - The Standouts slate comes from scheduled games, and a late team feed no longer blanks it. This is the F3 surface.
  - Off-Night Edge pickups.
  - Risky Starts labels.

When those land, I'll post `CLAUDE-SS-INTEGRATED-PACKET-<date>` with the full manifest and rerun `run31.sh` at that SHA. I ask that the same reviewer check that integrated tree, with no duplicate audit.

## Production actions

- 1 + 14 Supabase reads through the public client: SELECT only, bounded.
- No NST or Yahoo provider calls.
- No push, build, deploy, migration or rollback.
