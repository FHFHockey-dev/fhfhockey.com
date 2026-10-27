# RECEIPT-17: real sparkline gaps diagnosed from run-3 and fixed (lane TT)

## Run-3 capture (READ-APPROVAL addendum 4, run once)

**Run**
- **Code:** current (TT-16), `loadTrendLayer` with series (S1/M2).
- **Process:** a local Vitest runner, not :3000, using the anon key from `web/.env.local`.
- **Guard:** GET only to the Supabase REST host, at most 22 statements, no retries, no writes.
- **First attempt:** refused by the Claude Code permission classifier before any request was made. TJ then allowed the command, and it ran exactly once.

**Result**
- **Statements:** 15.
- **Errors:** 0.
- **Concurrency:** at most 2 in flight.
- **Rows:** at most 1000 in one statement, within the 1,000 page cap.
- **Sections:** all four ready.

That's within READ-PLAN v3 (about 15 typical, about 22 worst).

**Saved to `genuine/run-3/`**
- `layer.json` (shown players only), `statements.jsonl` (in-lists reduced to counts) and `facts.json`.
- `series-diagnosis.json`: each shown skater's S1 rows (date, season games played, season points and TOI totals) and the reason for each missing appearance. These are public game stats, with no keys or account data.
- `capture.run.ts` and `vitest.capture.config.mts`.

## Cause: early-season game rows are absent from `rolling_player_game_metrics`

**What the data shows**
- The 35-day S1 window starts Sep 21, before opening night (Sep 29/30).
- But for several players the table has no strength-all row for some early games. Their later rows' season games played still counts those games, so they are appearances whose rows were never written.
- Examples: Michkov's first stored row is game 4 (Oct 5); Necas's and Perfetti's first is game 3; Ryan Greene has rows for games 3 and 5 but not 4.

**Why that left gaps**
- A point used to be the difference of two contiguous rows, so the first stored game after a missing row had no value.

**Ruled out:** null totals, duplicate or same-date rows, preseason or prior-season rows, a first game differenced against last season, scratches, and the window boundary. None occurred for any shown tile.

**Upstream:** the missing rows are an ingestion gap in the rolling table, which belongs to another lane (ETL). Backfilling those games would be a production write and needs its own approval; it would fill every remaining gap.

## Fix (`gameSeries` in `lib/socialShare/trends.ts`; no read change)

**How a value is solved**
- Each game is solved exactly from sums the read already holds:
  - every stored row's season-to-date total (games 1..n);
  - the last-5 and last-10 points, and the last-5 TOI, on the rolling read's own rows (R1: the last week's rows, already read for the shortlists).
- Nested sums sharing an end are subtracted into new sums, and a sum with exactly one unknown game solves it.
- For points, which can't be negative, a sum of 0 makes each game in it 0.
- Solved values must be valid: points are whole and at least 0; TOI is above 0.
- The existing last-5 and last-10 checks still reject any series that disagrees with the row's own windows.
- Nothing is interpolated, and a sum of two or more unknown games is never split.

**Rates:** have no window totals in the read (only per-60 ratios), so their gaps are left as they are.

### Hot/Cold on run-3 (before → after; · = gap)

| Tile | TT-16 series | TT-17 series | Games with no row in the table |
|---|---|---|---|
| Matvei Michkov | [·, 1, 0, 0, 0, 1, 2, 2, 1, 2] | [0, 1, 0, 0, 0, 1, 2, 2, 1, 2] | 1, 2, 3 |
| Martin Necas | [·, 0, 1, 2, 0, 3, 1, 0, 3, 2] | [0, 0, 1, 2, 0, 3, 1, 0, 3, 2] | 1, 2 |
| Artturi Lehkonen | [0, 0, 0, 1, 1, 2, 1, 2, 2, 1] | [0, 0, 0, 1, 1, 2, 1, 2, 2, 1] | none |
| Trevor Zegras | [·, 1, 0, 0, 1, 0, 1, 3, 1, 2] | [0, 1, 0, 0, 1, 0, 1, 3, 1, 2] | 1, 2, 3 |
| Arseny Gritsyuk | [·, ·, 1, 1, 0, 1, 2, 1, 1, 2] | [0, 0, 1, 1, 0, 1, 2, 1, 1, 2] | 1, 2 |
| Andrei Svechnikov | [·, 2, 0, 2, 3, 0, 0, 0, 0, 1] | [1, 2, 0, 2, 3, 0, 0, 0, 0, 1] | 1, 2, 3 |
| Auston Matthews | [4, 1, 4, 2, 1, 0, 3, 2, 0, 1] | [4, 1, 4, 2, 1, 0, 3, 2, 0, 1] | none |
| Kyle Connor | [3, 0, 2, 1, 2, 1, 0, 0, 1, 0] | [3, 0, 2, 1, 2, 1, 0, 0, 1, 0] | none |
| Mikael Granlund | [1, 1, 1, 2, 2, 1, 0, 0, 0, 0] | [1, 1, 1, 2, 2, 1, 0, 0, 0, 0] | none |
| Cole Perfetti | [·, ·, 1, 0, 2, 0, 0, 1, 0, 0] | [·, ·, 1, 0, 2, 0, 0, 1, 0, 0] | 1, 2 |

**Hot/Cold result**
- 9 of 10 tiles are complete. Michkov, Necas, Zegras and Svechnikov are pinned by the latest row's last-10 total. Gritsyuk's season total through game 3 is 0, so games 2 and 3 are 0.
- **Perfetti** keeps 2 gaps: games 2 and 3 are known only as a sum (4 points), which can't be split. They show the gap marker and "2 games no data".

### Remaining gaps on the other cards (genuinely missing rows; no sum isolates them)

| Card | Tile | Series games still gaps | Games with no row in the table |
|---|---|---|---|
| deployment | Charle-Edouard D'Astous | 1, 2, 3 | 1, 2 |
| deployment | Ryan Greene | 2, 3, 4, 5 | 1, 2, 4 |
| deployment | Igor Chernyshov | 2, 3 | 1, 2 |
| deployment | Morgan Frost | 1, 2, 3, 4 | 1, 2, 3 |
| deployment | Yegor Sharangovich | 1, 2, 3, 4 | 1, 2, 3 |
| rates | Logan Stankoven | 4 | 1, 2, 3 |
| rates | Logan Stankoven | 4 | 1, 2, 3 |
| rates | James Hagens | 3, 4 | 1, 2, 3 |
| rates | Braden Schneider | 4, 5 | 1, 2, 3, 4 |

- **Why they stay gaps:** these are early-season games, older than any last-5 window on the last week's rows. Deployment's TOI has only last-5 windows in the read; Rates have none.
- **Options (not done, need approval):**
  - (a) backfill the missing rows upstream;
  - (b) a READ-PLAN v4 adding last-N window totals (`points_total_last5`, `toi_seconds_total_last5` and the rate numerator windows) to S1's columns. That is the same statements and row caps, but new columns, so it goes beyond v3.

### Renders
- **Genuine:** run-3's layer was built by the TT-16 code, so `tt17/rederive-run3.mjs` re-derives its Hot/Cold series offline with the fixed solver. The inputs are run-3's captured rows and the latest last-5 / last-10 totals; the result is `genuine/run-3/layer-tt17.json`, and before/after is in `tt17/rederive-changes.json`.
  - For these tiles that matches what the fixed code would produce from the same read: the earlier R1 rows' windows don't reach these games.
  - Deployment and Rates keep run-3's own series.
- **Files:** `tt17/genuine-run3` (the first genuine renders with series) and `tt17/fixture`, each desktop, phone and PNG.

## Tests

**Regression tests (`trends.test.ts`), one per cause or behaviour**
- a missing early row, pinned by the last-10 total (Michkov);
- a zero season total through missing games (Gritsyuk);
- two missing games known only as a sum stay gaps (Perfetti);
- a missing middle row, pinned by a later last-5 window (Greene pattern);
- rows that disagree on one game count give no sum.

**E2E:** the genuine test now handles a capture with series. On Hot/Cold, each tile's drawn series must equal the layer's exactly, with gaps where null.

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, v2 pins, genuine = run-3 (two passes) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: 10c68bfb66453d67929490d86d7a6e7c6a2791f2c3b156d0d5caa26e2f8218f7, 56d5b8507655fd360848408ea9e8a90d93131b012a9f1f81211910896f4b65d0, 9e847985e37b46ac840a2788bd5e43a0d2650733bafb5cf253f92626ff691184, 68c5bf2a7e3e8b71e59d1a2fb43bfd50af80e09fe373bfb34e0fe44dcd55bdc0 |
| Vitest | 245/245 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |
| Network (E2E) | denied Next.js version check only |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trends.ts` | `04278c81e17c2ce42e28d1ed8c7d7ee2e379b5237d88dcc7dd507eb8041b4c72` |
| `web/lib/socialShare/trends.test.ts` | `44101907c491caf37acbbd8f05e8ed2be0a9a7769ed2dfc0d39a692395deaaa5` |
| `web/e2e/social-share.spec.ts` | `d14fab3b7563c750f2c98645e4c65c41268bea63e8689b52bec0e3511d5e0566` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `cb8053cfbde4711b922c5d96e23b263af0726b5ce1519476a7ff9c135a4f5490` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/capture.run.ts` | `8bff93a5c89b02528b71a268ce9ebaf7d89f020e1ae5340d02b93abf32630863` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/vitest.capture.config.mts` | `ec871a9d2b84f3e2e8b30bc1ba34c5190b8f478277d63a4643338e3764e03434` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/capture-run.log` | `c51e78bc2c1d808e145ddead92adde37e20888cbca5b7f84ff98d3ab3fc234f4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/layer.json` | `e3f8217ff15003128d9118a7f6afd589f4a890f58ea6556bef7188ab9594e724` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/statements.jsonl` | `0390fb35bf7def0330a3d5cc7f58826f08adece7c9abc2c57a35243faf3f90b1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/facts.json` | `eb097ef29f5d0f5dcc4656074c5e67afa339e2c369efb437a0ee86537170f497` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/series-diagnosis.json` | `10c40cab01e735db8f5da62166b50c7299d4bd4585fa0b724ec70bd8d69c6a91` |
| `tasks/artifacts/tuesday-trends-2026-10-26/genuine/run-3/layer-tt17.json` | `0b400181b1cafb7f06b172c05af4a3fead0df098e69939469adaac10257469e7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-32a.log` | `4a10d9332c781b7ae3145bab4a035eb4db24ac3472f6bdef482edfda196fa75a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-32b.log` | `90bf74b57fe9c2b341f553fb12ccdcc9cde9519e54f319c49d1ed320af475327` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `f730a8c1ed07eaeac1d999ba93e3978682436824fcc1dc86f4cbe868f263027a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `9fa072d00ca3572dfcdfd095233709675777edf686cf72bb6300f03b2586d172` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-32.jsonl` | `764f0096839e8b1d7c8fb356afdf6cc3e26a944ecbf55d68cb99b1a852591a6d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-32/tuesday-cards-pinned.sha256` | `743898eeea05303ecd701e623132582413edd6fcc28790fd3bc069c4a9e7e150` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-desktop-deployment.png` | `ea3d6759ff038229d66b799c2f282cbcfff716a4f5d695b1df6d911c1beca145` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-desktop-hot.png` | `e422bc5cb5446cded1a60a082d633135dab2efee0fccd4df3c45c2b743f472e5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-desktop-movers.png` | `a131b4277948bdc88309c1ed8d11bf23f3d7aa902ee5b7636ba601bdda189229` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-desktop-rates.png` | `d646198066151fa0ad1a98ad6ebade137a44b618371e56b1599e600725aaa044` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-phone-deployment.png` | `eb43215ce8badc35125d6f60265e2a4d567ae1754b6d231888f2111204cf6931` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-phone-hot.png` | `507606b2ed5e2990c5434bafb76c399b8af0e48f4122dab6213c44d54c8900a3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-phone-movers.png` | `b7764e88404cee0ceca08198f921433ac94cc5c275e95fe7e07c76e9b090547a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-phone-rates.png` | `9a63b572baf939f040be511dbc4490691095aed07c8b33d4e536bda01e6677ba` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-png-deployment.png` | `cfde79de9e2c754e6bed2e6a43df7b2b68a5e3df22246fa8edb548c67dd2b0d0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-png-hot.png` | `9b71f7ea02ac37b01c7444df36991cdf1071495929ccec2ec285ff973ba380b3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-png-movers.png` | `74b2a016ffc7f291b8466f71901fdcfc2a068f416e72122b2fb1d00ea594eb8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/fixture/TT17-OFFLINE-FIXTURE-png-rates.png` | `b134c91300102f48a9f35714b3f6bcbc61f11c4b3704003b2bc20d55d2b08d7e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-desktop-deployment.png` | `076408c14526f728f67f2f7f7f5222ed4049b3c554544c2cbf066f5df6c5fe80` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-desktop-hot.png` | `e38e812a62b9f108e462868f3870ec4478a228f68dde469bc0e1c4a3186c7b42` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-desktop-movers.png` | `e93acbd7012c63f9ea2f272ebae421649d72b87afbc53b2bcf4c66c41c67ebe7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-desktop-rates.png` | `5f3e267792a178ed886a0e9313e6c60df05f3a6c4065205a3bf3f490b8f96870` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-export-tokens.json` | `383e597a84521705d9c036f6db17101a99611785ea3ae6d1225e231ae5293a55` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-phone-deployment.png` | `ee2fec76124bcfb7ca79f7843f852de2eca94ef3f41ab301db9e62cb1988ef5c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-phone-hot.png` | `41fe5315ad28a63ec8f58d6f2249ee03ce9f207ddca7c316a66a51bd81508808` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-phone-movers.png` | `4bcea6996bb02ecbf2d01fcc7607bbac2dee59ff992406f733a0222240cfd36c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-phone-rates.png` | `6acc3e9cb9c5f802a8b009cb0a6b3e73958fa5a6d5caab8274a1a5c501389e7d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-png-deployment.png` | `68765271ef6d5d5a28c3933dfa6745806bd196491618d02486fe7006d649be8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-png-hot.png` | `6524e41b069d0a6e264d160ec55f71c29ed07f6813a21228d71f4e7549ddb342` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-png-movers.png` | `b75ba76f630583c222ab0585e0d76769ea52c774a945ca928a71d9f0f7448be1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/genuine-run3/TT17-GENUINE-DATA-png-rates.png` | `bce1f34eea356b2382bbd40a18a83b0deb51fe45e72a46922c97713cc9044e2c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/rederive-changes.json` | `74c2f2855027f8f93960e5d6bd19bbd68fe5644a6d153e3d1178cab272119cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt17/rederive-run3.mjs` | `cfbc0326321047009b892b1f12bc1e945c2eaad0349b4ee32ebe07ca4c363adc` |
