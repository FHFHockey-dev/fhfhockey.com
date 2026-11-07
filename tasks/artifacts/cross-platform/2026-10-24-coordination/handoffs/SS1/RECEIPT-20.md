# SS1 ticket 20 receipt: exact-page-multiple reads no longer fail closed

- Lane: SS1, canonical checkout. Base: the committed SS1 17–19. Offline fixtures only, no live reads, no Git, no commit.

## What I fixed, and why it ranked highest

**The bug**
- `bounded()` in `web/lib/socialShare/playerSources.ts` backs every player read: Yahoo ownership, skater and goalie season totals, and the L5 recent reads. It pages at 1,000 rows.
- When a result is an **exact multiple of the page size** (e.g. exactly 1,000 rows), the shared paging loop requests one more page starting past the last row. PostgREST answers that with **416 Range Not Satisfiable (PGRST103)**.
- `bounded()` treated that as a failed read, so the source **failed closed**: every tile went to "Recent form unavailable", or the player cards went unavailable.
- This is a real, data-dependent failure in the live read path. It is a plausible contributor to TJ's still-unexplained "Recent form unavailable" (ticket 17).

**The fix:** once the first page has given the exact count, `bounded()` returns an empty page for any range at or past that count, without making a request. Pages, limits and the exact-count consistency checks are otherwise unchanged.

## Test

- **Mock change:** the mocked client in `playerSources.test.ts` now behaves like PostgREST and returns PGRST103 for a range that starts past the last row.
- **New regression test:** 1,000 rows for a 50-skater pool read in exactly **one** request (`[0, 999]`), returning all 1,000 rows with no failure logged. With 1,001 rows it pages normally (`[0, 999]`, `[1000, 1099]`).
- **Negative control:** with the guard removed, the new test **fails**. The guard was restored afterwards.

## Files (sha256)

| File | sha256 |
| --- | --- |
| web/lib/socialShare/playerSources.ts | 53f6384be958aa6a7698b2855a84ebfdce768c1eb993080c21f3636cd93cb4bc |
| web/lib/socialShare/playerSources.test.ts | d09075c57d195cc43daec67a9a1b1724862abe077bdca915cdc6f2078ea73799 |

## Checks

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **176/176** (`t20/vitest.log`).
- **ESLint** on both files: exit 0 (`t20/eslint.log`).
- **Scoped tsc:** no errors in `lib/socialShare`.
- **CSS:** no `.module.scss` touched, so no pure check was needed.
- **Not run:** e2e (no UI or rendering change), any live request, Git.

## Left open (unchanged)

- The ticket-17 root cause still needs the `[social-share] … unavailable:` server log after deploy.
- Live L5 hits and blocks are null.
- TJ's "relative TOI" meaning.
- The low-contrast L4 chip on white team bands.
- The access-gate boundary request.
