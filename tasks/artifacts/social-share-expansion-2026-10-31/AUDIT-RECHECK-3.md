At **`8a20ff91a`**, the five open items are **3 Fixed, 2 Partly fixed**. All references below use that pin.

| Open item | Verdict | Evidence |
|---|---|---|
| **1 — Partial shifts delete valid PP rows** | **Partly fixed** | [Writer:63](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:63) now compares shifts with boxscore TOI. A 45-second fragment against 15:00 preserved the row with `keptUnproven:1`. The two-second tolerance still permits the deletion described below. |
| **4 — Receipts imply uninterrupted tracking** | **Partly fixed** | [postedWeek.ts:82](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/postedWeek.ts:82) excludes historical backfills and undated receipts from live-delivery evidence. Both probes returned `noRecord`. However, [line 114](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/postedWeek.ts:114) still treats a later live delivery as sufficient evidence for earlier ❌ marks. |
| **Stale PP rows without shifts cannot be removed** | **Fixed** | [Writer:64](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:64): absent-from-boxscore and zero-TOI/no-shift cases deleted their stale rows. Positive boxscore TOI without shifts preserved the row. |
| **Unresolved optional account rejects legitimate link** | **Fixed** | [Receiver:14](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sources/ifttt/FHFHockey-post.ts:14), [account check:55](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sources/ifttt/FHFHockey-post.ts:55): unresolved username/account fields with a named FHFHockey link returned **200**; explicit conflicting accounts returned **400**. |
| **All-undated table hides its count** | **Fixed** | [Reader:34](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/social-share/posted-week.ts:34) returned `{available:false,undated:1}`. The fetch adapter preserved it; [ShareLanding:155](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/ShareLanding.tsx:155) renders that count. |

Two concrete defects remain:

- **Medium — A missing two-second PP appearance deletes a valid stored row.** In a synthetic game with 18 skaters per team and consistent on-ice counts, player 103 had **14:02 total TOI**, including **2 seconds on the PP**. Complete input wrote `PPTOI:2`. Removing only that PP shift left **14:00** of shifts; [Writer:69](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:69) accepted the difference and [line 249](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:249) deleted the row. The response reported `keptUnproven:0`.

- **Medium — Resumed delivery still creates false ❌ marks.** With an October receipt already stored, posts missed during a Monday/Tuesday applet outage, and a Wednesday post delivered one minute after publication, the probe returned **Monday `missed`, Tuesday `missed`, Wednesday `done`**. The same false Tuesday result occurred when its post was retained as undated. [postedWeek.ts:114](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/postedWeek.ts:114) infers prior coverage from Wednesday’s delivery; [ShareLanding:12](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/ShareLanding.tsx:12) renders those misses as ❌.

Additional verification passed:

- Complete regulation, no-penalty, regular-season overtime **4-on-3**, and second playoff-overtime fixtures produced the expected rows and deletions. No TOI unit mismatch was reproduced.
- `keptUnproven` reached both responses: **1** for one game and **2** across two games.
- The repository’s recorded IFTTT body parsed **“August 23, 2010 at 11:01PM”** as **`2010-08-24T03:01:00.000Z`**, correctly marking **Monday, August 23** in New York. Literal, wrapped, HTML-escaped, and encoded-inside-wrapper forms passed. Unknown dates remained null; no false ✅ was reproduced in these cases.

Verification used pinned code transpiled in memory with mocked I/O. No files were written, network services used, builds run, or servers started. Browser and deployed behavior were not verified.

**Open severity counts: Blocker 0 · High 0 · Medium 2 · Low 0.**

Codex session ID: 01a19848-f085-7040-b31a-8015d83919b9
Resume in Codex: codex resume 01a19848-f085-7040-b31a-8015d83919b9
