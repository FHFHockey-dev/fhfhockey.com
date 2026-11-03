# C7 ticket 27 — review of `80fa80b5c` (SS1-24: chunked recent-form reads for the live 57014 timeout)

**Verdict: accept.**

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads, no `tsc`.
- Unit tests ran under the outbound network-deny preload, against a clean `git archive HEAD` snapshot at `/private/tmp/c7-r27` (HEAD `80fa80b5c`).
- Evidence is in `r27-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **HEAD** (`lib/socialShare/**`, `components/SocialShare/**`, plus my `c7/r27Chunks.test.ts`) | **203/203**: SS1's 199 plus my 4 |
| **Parent mirror** (sources reverted to `80fa80b5c^`, HEAD tests kept) | **189/199**. The 10 failures are all chunk-related: `playerSources` ×8 (chunk splitting for 0/1/20/21/84 ids, failed-chunk isolation, per-chunk limit and order), `players` ×1, and `schedule` ×1 ("tells a failed last-five-games read apart from an empty one…") |

## Requirements

**The change** (`web/lib/socialShare/playerSources.ts:50-96`): `chunkedRead` deduplicates and sorts the ids, splits them into chunks of `RECENT_ID_CHUNK = 20`, and runs at most `RECENT_CHUNK_CONCURRENCY = 2` workers per source. Each chunk is its own `bounded()` read: exact count, limit `chunk.length × 22`, order `player_id`/`goalie_id` asc then date desc.

| Requirement | Evidence | Result |
| --- | --- | --- |
| **No row loss or duplication across chunk boundaries** | The chunks are disjoint id sets, so a player's rows can only come from one chunk, and within a chunk the order `(player_id, game_date)` is unique: the PK is `(player_id, game_date, strength_state)` filtered to `all`, and goalies use `(goalie_id, date)`. **My C1** used the real loader on a 186-player pool (170 skaters, one repeated id, and 16 goalies): **1,190 rows, 1,190 unique**, every chunk ≤ 20 ids, strictly ascending and disjoint, covering all 170 ids once. The goalie rows were complete too. | Holds |
| **416 exact-multiple behaviour per chunk** | `bounded()` keeps its `from >= expected` guard. **My C3:** a chunk of 20 ids × 22 rows equals its full 440-row limit, and it makes **one** statement (`[0,439]`) with no page requested past the end. | Holds |
| **A failed chunk is isolated** | Each chunk has its own `try/catch` and logs `[social-share] … unavailable for N players (chunk i of n): <code> <message>`, with no ids. **My C2:** with 100 skaters and one chunk returning 57014, `failedIds` is **exactly that chunk's 20 ids** and the other 80 players keep their rows (560). When every chunk fails, the source is `null` and `failedIds` lists all 100. | Holds |
| **`recentUnavailableIds` never carries unshown ids** | `attachRecent` keeps only failed ids that are in the layer (`players.ts`, the `failedIds` filter). `trimEditionPlayers` then filters them to `keep`, the shown set (`tiers.ts:122-123`), and overrides whatever `trimmed` carried. SS1's `schedule.test` asserts this on the real handler. | Holds |
| **Total requests bounded** | Recent reads cover the server's **ranking pool**, not only the shown players. The pool is capped at `RANK_POOL_MAX` = 72 + 60 + 54 = **186** players; shown players are capped at `TRIMMED_PLAYERS_MAX` = **84**. Worst case over any skater/goalie split, as `⌈s/20⌉ + ⌈g/20⌉` (**my C4**): **11 statements for the 186-player pool**, and **6 if only the 84 shown players were read**. Each statement is one page (≤ 440 rows), with ≤ 2 in flight per source, so ≤ 4 at once. C1's realistic 170 + 16 split took 10. Before, the same read was one skater statement of up to 186 × 22 = 4,092 rows (5 pages at 1,000), the one that timed out, plus 1 goalie statement. | Bounded |
| **Nothing else changed behaviour** | The skater and goalie sources are still isolated: `chunkedRead` never rejects, and the server's `.catch(() => null)` is unchanged. An empty id list still gives `[]`, not `null`. The client change only adds `recentUnavailableIds` to the "Recent form unavailable" condition. Cache, trim, exposure caps, columns and filters are unchanged. | Holds |

## Observations (info)

- **O1, defence in depth:** `trimPlayerLayer`'s not-ready path returns `{ ...layer, players: [] }` (`players.ts:179`), and `trimEditionPlayers` returns it as-is when it isn't ready. If a not-ready layer ever carried `recentUnavailableIds`, those unfiltered ids would pass through. That is **unreachable today**: the server calls `attachRecent` only on a ready, non-empty pool, and `attachRecent` keeps the layer's state. A one-line `recentUnavailableIds: undefined` on that path would make it explicit.
- **O2:** the fix trades one large statement for up to 11 small ones per uncached editor load, which is still bounded and role-gated. The receipt's "84 players" framing understates the pool the read actually covers (186); the statement counts above use the correct cap.
- **O3:** whether 20 ids per statement fits under the anon `statement_timeout` in production isn't verified offline. The per-chunk log line will name any chunk that still times out.
