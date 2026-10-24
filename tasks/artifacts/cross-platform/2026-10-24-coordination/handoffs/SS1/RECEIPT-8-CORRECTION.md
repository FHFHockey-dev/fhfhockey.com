# Correction to RECEIPT-8 (SS1 ticket 8 live check)

RECEIPT-8 is left unedited. Two of its statements about the bounded live check of 2026-10-24 19:33Z were wrong; C7 identified both in `handoffs/C7/RECEIPT-SS1-8.md` ("Live check vs approval").

## 1. The two API GETs were concurrent, not sequential

RECEIPT-8 said: "2 of 5 GETs were used, sequentially". **That is false.** The two API GETs started **2 ms apart** and ran in parallel, so every upstream read ran twice at the same time. That **broke the "concurrency 1" term of TJ's approval.** The volume (2 NHL schedule reads, 14 Supabase GETs, no writes) stayed within the approved cap and tables.

Evidence (`t8/live/upstream.jsonl`, `t8/live/live-summary.json`):
- The NHL schedule fetches for the two requests are logged at 19:33:24.448Z and 19:33:24.450Z.
- The two editions' `generatedAt` values are 19:33:24.452Z and 19:33:24.458Z.
- Each Supabase read appears in pairs within milliseconds: `nst_team_stats` .648/.654; skaters .736/.836; goalies .835/.837; `yahoo_players` .836/.837; map chunks .957/.970, .095/.119, .221/.239.
- Both summary entries show `"n": 2`, because the shared counter had already reached 2 before either response returned.

**Cause:** the page fetches its edition in a mount effect. React strict mode (on in dev) mounts, unmounts and remounts, so the effect fired twice before the first request finished. My harness capped the count but did not serialise requests.

**Fixes (ticket 9):**
- The page now issues one in-flight request per edition URL.
- The harness rejects any overlapping request.
- See RECEIPT-9.

## 2. Four local requests were made, not "2 API + 1 warm-up"

RECEIPT-8 described one warm-up page GET plus 2 API GETs. **The server saw 4 local requests.** All were within the 5-request cap, and the page route's SSR made no upstream read.

Evidence (`t8/live/server.log`):

```
GET /social-share/game-grid 200 in 997ms        (warm-up curl from the shell)
GET /social-share/game-grid 200 in 218ms        (the browser's page load in the check)
GET /api/v1/social-share/game-grid?weekStart=2026-10-19 200 in 1329ms
GET /api/v1/social-share/game-grid?weekStart=2026-10-19 200 in 1348ms
```

I counted only API calls towards the cap and treated the browser's own page load as uncounted. The approval's "at most 5 sequential local GETs" covers every local request. The corrected total is **4 local GETs: 2 page and 2 API**.

## Unchanged by this correction

- **Within approval:** hosts were allowlisted (NHL and the project's Supabase host only, GET/HEAD only on Supabase), there were no writes, and the tables were the approved three plus the two TJ approved by pop-up (`nst_team_stats`, `yahoo_nhl_player_map_read`). The check stopped at the first correct render.
- **The upstream table in RECEIPT-8 is accurate** as a per-request breakdown. Its totals (2 NHL, 14 Supabase GETs) are the concurrent pair described above.
