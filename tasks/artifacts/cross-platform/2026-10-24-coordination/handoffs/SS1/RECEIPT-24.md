# SS1 ticket 24 receipt: recent-form reads chunked (production 57014 statement timeout)

- Lane: SS1, canonical checkout. Base: `e74d6060e` (release `b84ff5b51` synced); the social-share files were clean at start.
- **Code only:** no DB, index or migration changes. Offline fixtures only, no live reads, no Git, no commit.
- Isolated :3110, released at 2026-10-25T20:37:59Z. The Node deny log has 0 entries besides npm's registry check.

## Root cause (confirmed live by TJ's refresh)

- Production logged `[social-share] Skater recent games unavailable: 57014 canceling statement due to statement timeout`. That was the ticket-17 server log line doing its job.
- The cause was one `rolling_player_game_metrics` statement covering the whole ranking pool (up to 186 ids in one `IN`, with an exact count). It ran past the anon role's statement timeout.

## Fix (`web/lib/socialShare/playerSources.ts`)

**Chunked reads**
- `RECENT_ID_CHUNK = 20` ids per statement, `RECENT_CHUNK_CONCURRENCY = 2` statements at a time.
- Ids are de-duplicated and sorted ascending before chunking. **Both** recent reads are chunked: skaters (`rolling_player_game_metrics`) and goalies (`wgo_goalie_stats`, same shape).

**Per-chunk safety**
- Each chunk keeps the existing fail-closed `bounded()` read: exact count, consistency across pages, limit = chunk size × 22 rows per player, and the SS1-20 exact-page-multiple guard.
- **Index order:** each chunk orders by `player_id asc, game_date desc` (`goalie_id asc, date desc`). That matches `idx_rpgm_player_date (player_id, game_date DESC)` and the goalie primary key, and stays unique for paging (C7 SS1-15-F2).
- **Deterministic merge:** rows merge in chunk order, so the result is id ascending, newest first, whatever order the chunks finish in.

**Isolation (`ChunkedRows` with `failedIds`)**
- A failed chunk logs `[social-share] Skater recent games unavailable for N players (chunk i of n): <code> <message>`. **Only its players** lose recent form.
- They fall back to season rates in the ranking, and their tiles say "Recent form unavailable"; everyone else keeps their L5.
- If every chunk fails, the source is unavailable as before (`null`). Skaters and goalies stay isolated from each other (SS1-17).

**Per-player state:**
- `attachRecent` takes `failedIds` and sets `recentState: "partial"` plus a new `recentUnavailableIds`.
- `recentLine` checks it per player.
- `trimEditionPlayers` keeps only the **shown** players' ids in `recentUnavailableIds`, so the "only shown players leave the server" rule holds.
- `TRIMMED_PLAYERS_MAX` and the other caps are unchanged.
- **Cache:** "partial" keeps the short cache, as before.

## Tests

**`playerSources.test.ts`** (14)
- The mock now honours each chunk's `IN` list and (id asc, date desc) order like PostgREST, returns 416 past the end, and tracks in-flight requests.
- **Chunk boundaries:** 0, 1, 20, 21 and 84 ids give 0, 1, 1, 2 and 5 chunks of ≤ 20. Each chunk's limit is chunk size × 22, with **max 2 in flight**.
- **Stable merged order** from shuffled input across two chunks.
- **Isolated chunk failure:** ids 21–40 time out with 57014. Only those 20 are in `failedIds`, the other 25 skaters' rows come back, goalies are unaffected, and the logged reason is exact. If every chunk fails, the source is `null`.
- **Per-chunk over-limit** fails closed with its logged reason.
- **Per-chunk exact fill:** 20 × 22 = 440 rows needs exactly one request, with no 416.
- The index-order chain and the no-read-without-ids case are also covered.

**Other suites**
- **`players.test.ts`:** `failedIds` marks only that player (partial, `recentUnavailableIds`); the others keep their L5.
- **`schedule.test.ts`** (real handler, mocked sources): the first 20 pool skaters' chunk fails. The response is partial, `recentUnavailableIds` holds only shown players, and each skater's `recent` is null exactly when its id is in that list.
- **E2E #24 extended** with a "chunk-failed" edition: each tile says "Recent form unavailable" exactly when **its own** player's chunk failed (both states present).

**Totals**
- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **199/199**.
- **E2E behind the real gate** (fictional `.invalid` editor, deny preload): **30/30** in run A, run B and the final pinned run.
- **PNG pins:** all 22 asserted and **byte-identical to ticket 23** (no visual change).
- **CSS pure check:** PURE OK (no SCSS change). **ESLint** on the social lib, components and spec: exit 0. **Scoped tsc:** no social-share errors.

## Files and sha256 (`HASHES-24.txt`)

```
5ce2913a331d3d5ad509f9789f2dc90d4c261116542574096c1a7ee4342405ff  web/components/SocialShare/SocialShare.tsx
c22934f9eb9c3415ec8c1ceddba7fb2c88daf3788373499dab4c288a24c9965e  web/e2e/social-share.spec.ts
d904fbbfd899f5062769e3cce70e7ce0669476ed20359e9ca1017f922325b944  web/lib/socialShare/playerSources.test.ts
2f1b6e7094f32207a165e82a2c9a14aa7378129cfb454b6bf96a569be93d0b2b  web/lib/socialShare/playerSources.ts
4252b975781207abd8c22657b79c2b8b859ac82ff048a7e2a34e6db713041604  web/lib/socialShare/players.test.ts
9e82dae003f387f216b1e69f04637d057c548f5fc040f386b8bb86bd2a095248  web/lib/socialShare/players.ts
89b2e9c1976c57ed6c5d913380bd2ddd4f1ebe4731ad84dfa6a11165bb0ca42c  web/lib/socialShare/schedule.test.ts
fdfe5f00c2c0a0f8d3278f095fe34728f0fa6477b949e6b19f148722e4e7f71c  web/lib/socialShare/tiers.ts
baefec0532640893ea864af7bd993bd41f2905299d6b57194f65eaba739c7a0b  web/lib/socialShare/types.ts
```

## After deploy

- TJ's next refresh should show L5 lines instead of "Recent form unavailable".
- If a chunk still times out, the log names its size and position (e.g. "chunk 2 of 10"). `RECENT_ID_CHUNK` can then drop, e.g. to 10, with no other change.
