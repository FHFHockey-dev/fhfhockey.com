# SS1 ticket 11 receipt: C7 SS1-10 findings F1 (honest recent form) and F2 (top-10-first copy)

- Lane: SS1 (Claude), ticket 11, same lease. Source: `handoffs/C7/RECEIPT-SS1-9-10.md`.
- **Mocks only; no live request.** The deny log (`t11/node-network.jsonl`) holds 1 entry, npm's own registry check.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 … SS1-10, all unchanged.
- Delta: **`SS1-11.patch`** `c614d89176232c229038d642356750af638718df8bd9c9d7f6c6802c3a7d7eff`. It touches 8 files, +79/−18; hashes for 39 files are in `HASHES-11.txt`.
  - Verified in scratch: HEAD + SS1…SS1-11 reproduces all 30 lease files byte-for-byte.
- No Git, no GIT_DIR. Codex's player-cards namespace and :3125 were not touched.
- **The :3110 slot is released.** 0 listeners at 2026-10-24T20:28:50Z.

## F1 (medium): a failed recent read no longer claims "No game in the last two weeks"

- **New field `SharePlayerLayer.recentState`:**
  - `"ready"`: the last-five-games source answered, even if it returned no rows for a player.
  - `"unavailable"`: the read threw, including an over-limit result from `bounded()`.
  - Absent: no read was attempted (an unready or empty player layer).
- `attachRecent(layer, null)` sets `"unavailable"`; any answered read sets `"ready"`.
- **Tile text:**
  - `recent: null` with `recentState: "ready"` prints **"No game in the last two weeks"**, which is now true.
  - Anything else prints **"Recent form unavailable"**.
- **Cache:** `shareCacheControl` treats `recentState: "unavailable"` as an unready layer. Such an edition is capped at the **60 s** ceiling with no stale window, instead of 300 + 300 s.
- **No leak:** the failure text (e.g. "over its N-row limit") never appears in the API response.

**Regressions**
- `schedule.test.ts`: a new server-level test covers three outcomes.
  - **(a) Empty but successful:** `recentState: "ready"`, all `recent: null`, `s-maxage=300, swr=300`.
  - **(b) Rejected** (`Error("offline")`) and **(c) over-limit** (`…over its 420-row limit`):
    - the schedule stays `ready` and players stay `ready`, but `recentState` is `"unavailable"`;
    - the error text is absent from the JSON;
    - `Cache-Control: public, max-age=0, s-maxage=60`.
- `playerSources.test.ts`: the **real** `loadSharePlayerRecent` fails closed when rows exceed `players × 14` ("over its 28-row limit").
- `players.test.ts`: `attachRecent(null)` gives `"unavailable"`; answered reads, including empty ones, give `"ready"`.
- **E2E #24:** with a failed recent read, all 9 tiles on the under-20% card say "Recent form unavailable" and none says "No game in the last two weeks". After an empty-but-successful refresh, it is the reverse.

## F2 (low): "top-10 first" copy matches what the cards hold

- **Eyebrow:** "Pickups on top-10 schedules" now reads **"Pickups · top-10 schedules first"**. The footer already said "Top-10 Week Score teams first, wider pool fills to three".
- **Alt text** for pickups and specialists now opens with "Top-10 Week Score teams first; a list short of three fills from teams ranked 11 and lower, marked wider pool." Each wider-pool player is described with ", wider pool".
- The old phrases ("Players on top-10 Week Score teams", "Skaters under 50% rostered on top-10 Week Score teams") are gone, and the e2e eyebrow assertion was updated to match.

## Pinned PNGs (all 18 asserted on the final code)

| Set | Status |
| --- | --- |
| Monday grid, Easiest, Streaming; Tuesday 4 | **unchanged** |
| Monday Specialists; Wednesday grid, Easiest, Streaming, Specialists | **unchanged** |
| **Monday pickups 30–49 / 20–29 / under 20** | **new: eyebrow text only.** `32b8371b…`, `a2e3731e…`, `1ac0d604…` (was `1aad7f73…`, `17b94d32…`, `c88acdaa…`) |
| **Wednesday pickups 30–49 / 20–29 / under 20** | **new: eyebrow text only.** `44795ceb…`, `b6d06010…`, `c8659d94…` (was `f68fbff8…`, `0a9deabb…`, `7ecc2caa…`) |

- Only those 6 hashes changed; a diff against the ticket-10 run shows the other 12 identical.
- The new set repeated identically (`t11/run-a` vs `t11/run-b`).
- The full values are in `t11/pinned-env.txt` and `t11/evidence/*.sha256`.
- F1 changes no pixel in these images, because the pinned fixture has a successful recent read.

## Checks run

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **77/77** (`t11/vitest.log`).
- **Playwright (mocked)** `e2e/social-share.spec.ts`: **24/24**, 48.7 s (`t11/e2e-run.log`, `t11/results.json`). Run in skip-server mode on my own isolated :3110 server under the deny preload, with all 18 pinned hashes asserted.
- **CSS pure check:** PURE OK; the SCSS is unchanged (`t11/css-pure-check.log`). **ESLint:** exit 0.
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t11/tsc.log`).
- **Not run:** any live request, build or deploy.
