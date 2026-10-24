# SS1 ticket 12 receipt: GP and off-night counts coloured per column (TJ's direct guidance)

- Lane: SS1 (Claude), ticket 12, same lease. TJ's rule, via the orchestrator: green, white, yellow, red applied separately to GP and off-nights.
- **Fixtures only; no live request.** The deny log (`t12/node-network.jsonl`) holds 1 entry, npm's own registry check.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 … SS1-11, all unchanged.
- Delta: **`SS1-12.patch`** `e7e5d22637aa7c1792a6fa8c4687311a9dc79c6c279558b44dbaee8b0655791c`. It touches 5 files, +112/−20; hashes for 40 files are in `HASHES-12.txt`.
  - Verified in scratch: HEAD + SS1…SS1-12 reproduces all 30 lease files byte-for-byte.
- No Git, no GIT_DIR. Codex's player-cards namespace and :3125 were not touched.
- **The :3110 slot is released.** 0 listeners at 2026-10-24T20:38:28Z.

## The rule (`lib/socialShare/mondayGrid.ts`: `countTiers`, `editionCountTiers`)

Applied **separately** to the GP column and the off-nights column, over every team row of the edition, for that edition's selected dates. On Wednesday that means Thu–Sun only.

| Distinct values, highest first | Colours |
| --- | --- |
| 4 / 3 / 2 / 1 | green / white / yellow / red |
| 4 / 3 / 2 | green / white / red |
| 5 / 4 / 3 / 2 / 1 | green / white / yellow / yellow / red |
| **Edge: two values** (e.g. 3 / 2) | green / red |
| **Edge: one value for everyone** | neutral (white), never red |
| **Edge: ties** | tied values share their tier |
| **Edge: an unranked (untrusted) edition** | neutral; no colours until the edition is trusted |

- Teams with 0 games or 0 off-nights take part like any other value, so 0 is usually the red (lowest) value.
- **Palette:** the same as the Week Score tiers. Green is `$success-color`, white `#ffffff`, yellow `#ffd43b`, red `#ff5c5c`.
- **Rendering:** the numbers are bold, on the existing dark tiles; in the grid they are 12 px inside the 10 px line.

## Where it applies

- **Best Schedules grid** (Monday; Wednesday Thu–Sun): the `GP · OFF` line under each score. Rows carry `data-gp-tier` and `data-off-tier`.
- **Top 3 schedules and team focus:** "N GAMES LEFT · N OFF-NIGHTS".
- **Easiest Schedules:** the GP column.
- **Pickup and Specialist tiles:** "N GP · N off-night".
- **Streaming Matchups:** the team's GP in the Defense line.
- **Tuesday trend rows:** "N GP this week" (GP column only; these rows have no off-night count). Ownership Movers shows no counts, so it is unchanged.
- **Legend:** "GP · OFF ● ● ● ● most → least" on the grid, leaders and Easiest footers.
- Every coloured number carries `data-count-tier` for tests.

## Tests

- **Unit** (`mondayGrid.test.ts`, +3):
  - each of TJ's three examples;
  - the two-value, single-value, tie and empty edges;
  - independence. On the fixture edition, `editionCountTiers` equals the per-column rule. A synthetic case has team A green on GP (4, most) and **red on off-nights** (0, fewest); B is white on GP and green on OFF; C is red on GP and white on OFF.
- **E2E #25:** for **both** the Monday and Wednesday (Thu–Sun) editions:
  - every grid row's `data-gp-tier` and `data-off-tier` equal `countTiers` over that edition's own counts;
  - at least one team's GP and OFF tiers differ;
  - green and red both occur;
  - the legend is present;
  - the pickups, Easiest and leaders cards render only real tiers.
- **Test 9:** its logo-fallback selector now excludes `[data-count-tier]`, because grid rows now hold `<b>` count elements.

## Pinned PNGs (all 18 asserted on the final code)

**17 changed**: every card that shows GP or off-night counts.

| Set | New pins |
| --- | --- |
| Monday grid | `5ec123ec…` |
| Monday Easiest / Streaming | `41ce859d…` / `f06658b8…` |
| Monday pickups 30–49 / 20–29 / under 20, specialists | `132331d4…` / `adf63fdf…` / `3e9c1f51…` / `ad39c501…` |
| Wednesday grid, Easiest, Streaming, pickups ×3, specialists | `66399bdd…`, `32e9df20…`, `16e5e072…`, `bc013807…`, `c24cee84…`, `5bdda265…`, `a90a19ba…` |
| Tuesday hot / deployment / rates | `8e445a43…` / `69fcec8c…` / `82db70ce…` |

**Unchanged:** Tuesday Movers `305daf54…` (no counts on that card).

The full values are in `t12/pinned-env.txt` and `t12/evidence/*.sha256`. They repeated identically (`t12/run-a` vs `t12/run-b`).

## Checks run

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **80/80** (`t12/vitest.log`).
- **Playwright (mocked)** `e2e/social-share.spec.ts`: **25/25**, 53.6 s (`t12/e2e-run.log`, `t12/results.json`). Run in skip-server mode on my own isolated :3110 server under the deny preload, with all 18 pins asserted.
- **CSS pure check:** PURE OK (`t12/css-pure-check.log`). **ESLint:** exit 0.
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t12/tsc.log`).
- **Not run:** any live request, build or deploy.

**Evidence:** `t12/evidence/counts-game-grid-grid.png` and `counts-remaining-week-grid.png`. On Thu–Sun, GP 4/3/2/1 shows green/white/yellow/red and OFF 2/1/0 shows green/white/red.
