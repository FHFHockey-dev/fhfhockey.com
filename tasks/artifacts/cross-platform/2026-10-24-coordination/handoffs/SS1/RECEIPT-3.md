# SS1 ticket 3 receipt: C7 observations SS1-O1…O4 (cost and bounds)

- Lane: SS1 (Claude), ticket 3, same lease. Source: `handoffs/C7/RECEIPT-SS1.md`.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus `SS1.patch` (`33b1032a…`), plus `SS1-2.patch` (`6f6fabfe…`). Both are unchanged.
- Delta: **`SS1-3.patch`** (`b6dee9e2…`; full sha256 values in `HASHES-3.txt`). It touches 7 files, +208/−18.
  - The final version adds the pinned extra-card check to the e2e spec. It supersedes the pre-e2e `b15dd3aa…`.
  - Verified in scratch: HEAD + SS1 + SS1-2 + SS1-3 reproduces all 18 lease files byte-for-byte.
- No Git writes, no GIT_DIR, fixtures only.
  - No Supabase or NHL read was made. Unit tests mock the schedule and the team-rate loader, and `teamRates.test.ts` uses a fake anon client.
  - No live check was run; the first one still needs TJ's direct approval.
- **No change to any component, SCSS, page or client file.** Only the server, API, loader and tests changed.
- **E2E: 12/12 pass**, with the default grid **and both extra cards byte-identical** (asserted).
- **The :3110 slot is released.** No listener since 2026-10-24T17:13:04Z; :3000 (TJ's) was not touched.

## Fixes

| ID | Change | Where | Tests |
| --- | --- | --- | --- |
| **SS1-O1** cost | Successful **ready** editions get a bounded shared cache: `public, max-age=0, s-maxage=≤300, stale-while-revalidate=≤300` (details below). Everything else stays `no-store`: partial, stale or missing editions, blocked formats, any edition with less than 11 minutes of validity left, and every 4xx/5xx. | `server.ts` `shareCacheControl`; `pages/api/v1/social-share/[format].ts` sets it on 200 only. | `schedule.test.ts` "shared cache policy" (2 tests); API tests assert `s-maxage=60` on a ready edition with an unready opponent layer, and `no-store` on 503 and 400. |
| **SS1-O2** | The stats read now starts only **after** the schedule read succeeds; a schedule failure makes 0 stats reads. | `server.ts` `loadScheduleShareSnapshot` | "reads opponent rates only after the schedule read succeeds": 503 → loader not called; 200 → called once, after `getSchedule` (invocation order). |
| **SS1-O3** | `weekStart` must fall in the **previous, current or next** NHL season, relative to the request's New York week. Otherwise the API returns **400** `weekStart must fall in the 2024–25, 2025–26 or 2026–27 NHL season.` (the labels are computed). This also applies to blocked formats, before any read. | `server.ts` `assertSupportedSeason` | Accepted: 2024-08-05, 2026-01-05, 2027-07-26 (the season edges). Rejected: 2024-07-29, 2027-08-02, 2099-01-05 (also on `tuesday-trends`), all with 0 schedule or stats reads. API tests now pin the request date. |
| **SS1-O4** | Team rates now load through a new social-share loader that calls `fetchAllSupabasePages` with an **explicit `limit: 64`** (`pageSize: 64`). If the source holds more than 64 rows, it **fails closed**: the exact count no longer matches, the opponent layer becomes `missing`, and the schedule still serves. | New `lib/socialShare/teamRates.ts` | `teamRates.test.ts` (3): one range `[0,63]` only; 70 rows fail without a second page; null count, wrong season or situation, and duplicate team are rejected. |

### Why a new loader (SS1-O4)

- Game Grid's `loadCurrentSeasonStats` is a Codex contract with no `limit` parameter, and I may not edit it.
- The new loader copies its validation rules: exact count, one season, `situation = 'all'`, unique abbreviations. It reads only the **7 columns** the cards use, where Game Grid's loader reads 13.
- As a result, the server no longer imports the Game Grid hook module at runtime. Only type imports of `TeamStats` remain.
- If Codex prefers to add `limit` to Game Grid's loader instead, `server.ts` can switch back with a one-line change.

## SS1-O1: chosen TTL and why

The header is computed **per response** from the edition's own `expiresAt`.

- **Inputs:**
  - `usable = expiresAt − now − 600 s`. The 600 s margin is the minimum validity a cached copy must still give the viewer to prepare and download.
  - The ceiling is **300 s** when the opponent layer is ready, and **60 s** when it is not, so a transient stats failure clears quickly.
- **Policy:**
  - `s-maxage = min(ceiling, usable)`.
  - `stale-while-revalidate = min(300, usable − s-maxage)`, only when opponents are ready.
  - If `usable < 60`, the response is `no-store`.
  - `max-age=0` means browsers never cache.
- **Why 300 s:**
  - The edition's own freshness rule gives a normal 6 h validity, but only **15 minutes** within 6 h of a puck drop, and an edition never lasts past a puck drop.
  - With 300 s, a 15-minute edition is cached at most 300 s and still has at least 10 minutes left when served. A 6 h edition gets 300 s fresh plus 300 s stale.
  - Expiry and edition semantics hold: s-maxage plus stale never reach past `expiresAt − 600 s`, so the CDN cannot serve an expired edition. The client's existing expiry gate still disables export at `expiresAt`, and `generatedAt` and the check time stay honest on the card.
- **Cost bound:**
  - At most one schedule read plus one stats read per distinct URL, per 5 minutes, per edge cache. Before this change, every hit made both reads.
  - O3 bounds the distinct-URL space to 3 seasons × 2 formats × the `selectedDates` variants. Every 400 is `no-store` and costs no upstream read.
- **Trade-offs (not verified live; a preview or production check needs TJ's approval):**
  - "Refresh schedule" can return the same edition for up to 5 minutes (+5 minutes stale). The page shows that edition's check time.
  - Whether Vercel's edge honours `s-maxage` despite the browser's `fetch(…, {cache:"no-store"})` request headers is unverified here.

## Byte stability (verified)

- The pinned-edition e2e test now exports the default grid **and** both extra cards on one fixed edition (fixed fixture time and browser clock; fixture rates updated 4 h earlier).
- To get a true "before": with the server running, I took ticket 3 back out with `patch -R` (no Git), exported, then re-applied it. After re-applying, all 17 non-spec lease files matched `HASHES-3.txt` and no `.orig` or `.rej` files were left behind.

| Card | Before ticket 3 (SS1-2 code) | After ticket 3 | Asserted in final run |
| --- | --- | --- | --- |
| Default Best schedules grid | `7f4cf9c0110514618368fcc3ce87149651bdae5fd2ca20766dce4ea359cf8462` | same | `SOCIAL_SHARE_PINNED_GRID_SHA256` (same value as tickets 1 and 2) |
| Easiest Schedules | `d91622b66fc47bc3d34f00a53dd74f159fa4c2ecc1a48e79a778216a8a11811e` | same | `SOCIAL_SHARE_PINNED_EXTRA_SHA256` |
| Streaming Matchups | `2676d8b2d5e42a02f0de6978c5d4d9fcd4b87060dec1eb3b1414ab0d76c9abef` | same | `SOCIAL_SHARE_PINNED_EXTRA_SHA256` |

- The unpinned extra-card PNGs (`monday-easiest-schedules.png`, `monday-streaming-matchups.png`) differ between t2 and t3 only because their footers print the current check times. That is why the pinned anchors exist.
- Evidence: `t3/evidence/*.sha256` plus the pinned PNGs; `t3/pinned-before-ss1-3/` and `t3/pinned-after/` hold the before/after runs.

## Checks run

- Vitest `lib/socialShare/`: **45/45** (`t3/vitest.log`): schedule 28, matchups 8, mondayGrid 6, teamRates 3.
- ESLint on the lease directories, pages and spec: exit 0 (`t3/eslint.log`).
- Full `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (9 GB heap): only the 2 pre-existing out-of-lease Luna errors (`t3/tsc.log`).
  - My first run flagged a typing error in my new test; I fixed it and reran.
- CSS pure check: no SCSS change, so the ticket-2 PURE OK still applies.
- Playwright `e2e/social-share.spec.ts`: **12/12 pass**, 19.6 s (`t3/e2e-run.log`, `t3/results.json`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3110, under the deny preload.
  - All three pinned hashes were asserted. The deny log (`t3/node-network.jsonl`) holds only npm's own `registry.npmjs.org` checks (3 connects, 1 fetch); no Supabase or NHL host.
- Server stopped; **:3110 slot released** (0 listeners at 17:13:04Z).
- **Not run:** build, any remote build or deploy, any live or production read.
