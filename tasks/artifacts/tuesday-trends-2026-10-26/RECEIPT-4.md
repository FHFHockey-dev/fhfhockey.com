# RECEIPT-4 — TT-4 visual pass: Monday tiles, green/red accents, sparklines (lane TT, offline)

- **Ticket:** TT-4 from the chef. TJ asked for "social punch": sparklines, logos, Monday styling and green/red accents.
- **Branch:** octoberBranch (synced with released master `19890a8cb` by the chef at `42688ceae`). The commit SHA is reported in the chat message.
- **Offline only.** No production read, write, push or deploy. E2E ran on :3110 with the network-deny preload; `run/node-network-4.jsonl` holds only Next's npm registry check.

## ⚠ Read change that needs TJ's approval before deploy (READ-PLAN v2)

The sparklines need **two new read-only statements** on already-approved tables:
- **S1:** `rolling_player_game_metrics`, strength all, listed skaters only (≤ 27 ids, 20 per chunk), last 35 days, **9 new columns** (season-to-date averages and per-60 numerator/TOI components). Cap ≤ 720 rows per chunk, 1–2 statements.
- **M2:** `yahoo_player_ownership_history`, the 10 listed movers' keys, dates P..D. Cap ≤ 150 rows, 1 statement.

**New totals:** typical ≈ 14 statements, worst ≈ 21 (ceiling 40); pages ≤ 1,000; concurrency 2 (asserted). Without approval, the deployed code must not run these reads.
- **Deploy options:**
  - (a) Approve S1/M2.
  - (b) Hold this commit.
  - (c) I can gate S1/M2 behind a flag so the cards render without sparklines.
- **Status:** not done; this needs a decision.

## What changed

- **Tiles** reuse Monday's components and classes unchanged:
  - `TeamBanner` (sm): team colours and stripes, logo, name, team · position. The **absolute** value sits in its right slot, using Monday's `playerOwn` styling.
  - Neon hero number.
  - `roleChips` colours for deployment chips.
  - A direction badge in the `.streak` flame-badge pattern (new `.trendBadge`), worded RISING/FALLING, MORE ICE/LESS ICE, PROMOTED/DEMOTED, ABOVE SEASON. The words are descriptive; no streak claim.
- **Accents:** the hero is the **change** on every card. Tile border, glow, hero, sparkline and badge are green when it is positive, red when negative, neutral when zero or unknown (`toneOf`). Vitest and E2E assert that every tile's tone equals its hero's sign. Role-only deployment heroes ("▲ LINE + PP") take the role direction and a smaller font.
- **Label kinds kept:**
  - absolute: right slot;
  - Δ / change: hero;
  - pct pts: movers;
  - the source and freshness footer.
- **Sparklines** (inline SVG, drawn into the PNG):
  - Recent Form: points in each of the last 10 appearances, with a divider before the last 5.
  - Deployment: TOI per game for the last 10 games, dashed season TOI/GP.
  - Rates: per-game rate for the last 10 games, dashed season rate.
  - Movers: daily rostered % from P to D.
- **How the series are derived:**
  - **Observed values only:** contiguous-row differences of season-to-date values.
  - **Gaps:** a gap is a hollow tick, never interpolated.
  - **Dropped series:** a series that disagrees with the row's own L5/L10 window is dropped.
  - **Failure:** a failed read drops sparklines only, never a section.
- **Fixture:** rebuilt from per-game values (12 games per skater), so windows, season averages and per-60 components agree the way the writer's do.
- **Monday/Wednesday:** no shared component or class was edited. The new SCSS is all `.trend*`, plus `grid-template-rows` on `.trendColumns`.

## Evidence (`tt4/`)

| Set | Files |
|---|---|
| Before (TT-3 tree `8e755dab8`) | `before/BEFORE-OFFLINE-FIXTURE-{png,phone}-*.png`, `before/BEFORE-GENUINE-run2-{png,phone}-*.png` |
| After, fixture (**with sparklines**) | `after/fixture/AFTER-OFFLINE-FIXTURE-{png,phone}-*.png` |
| After, genuine run-2 (**no sparklines**: the TT-3 capture predates the series columns) | `after/genuine-run2/AFTER-GENUINE-DATA-{png,phone,desktop}-*.png`, plus export tokens (all four match the snapshot) |

## Checks

| Check | Result |
|---|---|
| Vitest `lib/socialShare` + `components/SocialShare` | 229/229 (incl. PP add-on); 228/228 before it (new: sparkline differences, gaps, dropped inconsistent series, game 1, mover series endpoints and gaps, tone = hero sign, SVG gap rendering) |
| E2E full spec, :3110, pins, genuine render | **33 passed** |
| Monday (9) / Wednesday (9) PNG pins | byte-identical (committed `OTT.png` served, as before) |
| Tuesday pins | changed by design: `tuesday-cards: 9c37e172b75b7d1c3630af19d13d928f9a1055816074f5fab5b435881414e286,c71f7f0256850f414eee9c56bbe12d9b2169d73936d28d833bc095f84b1e9507,cf0bec88b5bb23e3a5212e5475ed894566109bb61d97a2b54c972ed9540b82ee,48dde0201ee1c9908ad72e5d9e92a6e04ee0b0c3b96acd63d11b4f890a13bb3a` |
| Loader test | fixture equality holds; S1 ≤ 2 statements with `strength_state=eq.all` and a 35-day window; M2 is 1 statement; most listed rows carry series |
| ESLint / CSS pure / full `tsc --noEmit` | exit 0 / PURE OK / exit 0 |

## Add-on: only two PP units (TJ, direct, relayed by the chef)

- **Cause, confirmed:** `pages/api/v1/db/update-power-play-combinations/[gameId].ts:129-131` slices skaters by PP TOI: top 5 → unit 1, next 5 → unit 2, and **everyone else with PP time → unit 3**. Unit 3 is incidental PP time, not a unit. The writer and the data are unchanged; only display and change detection change.
- **Tuesday** (`trends.ts` `ppEvidence`, `PP_UNITS = 2`):
  - **Off PP:** a game row with unit ≥ 3, or a game with PP rows that doesn't list the player → **off PP**.
  - **No PP rows:** the rolling row's `pp_unit` counts only when it is 1 or 2; anything else stays **PP ?**.
  - **Change order:** PP1 < PP2 < off PP. So PP2 → 3 is "▼ PP2 → off PP", and 3 → absent / absent → 3 is **no change**, so it is dropped (Vitest).
  - **Display:** `ppChip(≥ 3)` reads "off PP" and `deploymentBadges` skips a change whose two sides read the same. This guards stored layers computed earlier, such as the TT-3 run-2 capture used for the genuine render.
- **Monday** (lease extension, `roleChipList` and its test only):
  - **Chips:** PP1 and PP2 chips only; the writer's unit 3 gets no chip.
  - **Unchanged:** `score.ts` stays as it was (PP3 was already ×1.0).
- **Other "PP3" places checked** across `lib/socialShare` and `components/SocialShare`: `roleChipList`, `chipTone` (PP3 orange removed) and `ppChip`/`deploymentBadges`, all fixed. `score.ts` `OPPORTUNITY.pp` has only PP1/PP2 (neutral for PP3, unchanged). `players.ts` `normalizePpDeploymentBucket` still stores "PP3" in `recent.ppUnit` (data, not rendered after the chip fix). Outside the lease: `lib/rankings/skaterDeploymentAggregation.ts` defines the PP3 bucket and is used beyond social-share; not changed, reported only.
- **Pins:** **all 9 Monday and all 9 Wednesday pins are byte-identical**. Each was compared card by card against SS1 t24 run-a in a pin-free run, then asserted in the final run. No pinned fixture edition contains a unit-3 skater (the pickups fixture uses units 1/2), so no pin changed. The Monday change is covered by the updated `roleChipList` Vitest. The Tuesday pins are also byte-identical to TT-4: the Tuesday fixture has no unit 3.
- **Genuine render** (`tt4/after/genuine-run2`): re-rendered. Carrier, Liljegren and W. Carrier now show a plain "off PP" chip instead of "▼ PP3 → off PP", and Frost shows "▼ PP1 → off PP". Their columns are unchanged, because all of them are driven by a TOI change of 1:00 or more.
- **Checks after the add-on:**
  - Vitest 229/229.
  - E2E 33/33 with every Monday, Wednesday and Tuesday pin asserted.
  - tsc 0, eslint 0, CSS pure OK.

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trends.ts` | `a591fd14eee08d59f63cef381d4dafe9d5084c8f892c8a70e58f89f2894fb61a` |
| `web/lib/socialShare/trends.test.ts` | `4cc6450911cd012104a45886bfee19c2db058504c606f8e380b238fb29c35989` |
| `web/lib/socialShare/trendsFixture.ts` | `38155ae610cebf6e9f82ef1bd52cdae9bac0733bc8f3959208177c9b2341965a` |
| `web/lib/socialShare/trendSources.ts` | `ec402e7f6401845ef7313e0f57fb0a5cd99fbb5f5701f997c8e89e4c0839dd02` |
| `web/lib/socialShare/trendSources.test.ts` | `7f1fd574a57328a991e368c0fb920920bd0ca2084b1c73a88d05ab8659ba0069` |
| `web/lib/socialShare/types.ts` | `a9235f1d8592229803d13870fd4d31045be98cb602e323b5eaf76c702b27874c` |
| `web/components/SocialShare/SocialShare.tsx` | `91268731d855e2673069e156b0e5bb0de9ad6eab69bfa90e9f80c37a5b28bff0` |
| `web/components/SocialShare/SocialShare.module.scss` | `ebc98097abb8b8fc4c22570ddc6e3fbd7a96235f7a6c1792c3a76fcb5598a0c5` |
| `web/components/SocialShare/SocialShare.test.tsx` | `135e1d41434d0f17d4de3ced5c7742c0b255406ad2c83094881d01a548a0c2fd` |
| `web/e2e/social-share.spec.ts` | `53e16ec087f6ad0d13983c835dd78e8aeaeb9c9eac1d6ff7330b3e4541264aa7` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `118dfffb6fd0eb7e12d331635155eef83f08d13eb85d54d3498c2aea303f38f2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `544b3742997851e4978e331e29f426ec637b013814aaed5a92f4a24b27015949` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-PLAN.md` | `29530526600004f33d68521f72687ae7b28ec30b68cf4ac9ea19419c1872480a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tuesday-pins.txt` | `c043dcdc71a724b8b4997c8c968f332bded71977e14dfc47919fb4066339710b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-5.log` | `6c2d011946b8b2249ab5a688afe0e7feeced665af22bf1a41429039a858d6aa1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `5f4f73b32924f3accfabc9df78b885f39febbe3afb1552de46faa327937761ff` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `ab07584f78f4fac2d4a8900ac0b2819c04d9716b0690443fabcb581819bfc129` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-4.jsonl` | `164e107959eb80e55252d2233b9bd5d873be5a0ac7c160305fd126c3822c49c9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-5.jsonl` | `a109b4efb29a14cdaa58692942c825d330b2bd23600ac5c9bb8fe06c2dd624c2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-deployment.png` | `7db7c217304fd49cb6d949a82aa877e3187b0945eafe55fd2de0f79bb1e8d610` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-hot.png` | `5b7d51ae28007765f474f4fec8784aa9e5ff984cfc510028029c6cdd0382711d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-movers.png` | `7ab9f22f46531f9de5fe0a27c0a6e2ab2cd819c9e0241909ad5dae35c6f2864a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-rates.png` | `f893988668a07ad27e59fbe6fdd9eeb0f8265c56f946f4c4cdcb7e61320012f0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-deployment.png` | `812421ef448eeadf55cc4db96dc9a9f2d335859514770f26ecc9649958cecb8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-hot.png` | `1bbd59cd1f53e727d1f1f5af214aa434f62db09f78aeccf229c6a17b4d705928` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-movers.png` | `e860ddba069d628b1c75fa51d8459f5a39f64f335daba458d247358cd5946a37` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-rates.png` | `6e7fa920026cbee8f0533dad74542399fd6d3010984306be3fccda533be74585` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-deployment.png` | `455d988d222dc2776b9f1a76f095b2939713d5468cb94505d0b0b99d909467ba` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-hot.png` | `e7a6e4b2fc4d64479a62f6bb60aa55189b199cbb018427841feda8799a2dc8e2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-movers.png` | `9f51cb120a23956c73833ebff3a8bc63c78451f2984a241c434d93626a2d373b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-rates.png` | `d8617b3c6905870331d657706b76881962d80b83c90b6365a5934ecc9225ccbc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-export-tokens.json` | `e14684049ef358d5ad7875307efd5a4906bd03af4228eb1d227a96eed930a5b1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-deployment.png` | `413951416bdfcf6af9e0abf20eb082664e8380a5864e7525299ebb3558b74ec6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-hot.png` | `7fe7b4c3edb229f04613b440da4ebd3d9aae5fa6cd03fca670ef398d6780409d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-movers.png` | `52b22fe97c0fb6346f44cfec5c81cc3f575d23d37aa167549a7222160c14ee51` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-rates.png` | `70d4513dc1c216e1e53eedd3cb4eff2322fb413b9a554771026fb7158b783cd1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-png-deployment.png` | `5b0f125aaa328c97cf404acc679e7b99df028ccca0ccf8be43fa9e6abcd81900` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-png-hot.png` | `b417f827810b03ef16b9bc30028756a93060069605faa88251ee81afbeb3fbfe` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-png-movers.png` | `7c1920377db657def4a92448b7ecb1ee343e68b79a1b63d2161c81c970f08225` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-png-rates.png` | `bbbe2dc463626650969be93b5adaac60e6e541c41870faa86909a589d308bbcd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-phone-deployment.png` | `85d3f26df5bb1728b9e7bbdfffc49325c88703ee356ad42e986c3ed734c95798` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-phone-hot.png` | `3e71d1f1cb01daf3708a5516fb31a3ce97ac9eafcb8c0948d755a35b325098c7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-phone-movers.png` | `53ca87634f3d8fb2c1601a88d4138945c0357e42beebfd33dd3420130247fc4d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-phone-rates.png` | `d8bed60c8a66af42e59cc560aaeec54a49dda6291065682ea5f5b2744d8b906b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-png-deployment.png` | `efd88856818459eb9bc30e36fcf35987076df123387ca0d79aa95fb178170179` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-png-hot.png` | `08b64feb44364ab5848806b0337dc30c77ba418da5fe6966503c15d388cec4e9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-png-movers.png` | `8f2a2c992967c11d03e8b3fb068eaa528586a0606336a5c2a3eccdd802c42904` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-GENUINE-run2-png-rates.png` | `934edf02d6cfb93d13224b9849d9e815d7bf7529eb5e0bb2cc227455370d05fc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-phone-deployment.png` | `fe42c3ea59cf6187d93aede4273a8b7c80268fcf6a88f1a80b56854247271db9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-phone-hot.png` | `1e9df4358d715c7f6cc405b9f680069daf7133e2bf6b0c88183bd231b837fba3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-phone-movers.png` | `3af592da213a624bf0fd22929d78777a3c82da82607b33a5fb5f9d2386df8de2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-phone-rates.png` | `b5c4d9c3a8ee35e84d8753e453177d5b7ae45c94ddb632afdfd09196e1987f0d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-png-deployment.png` | `5c166f224ec8c996b6a71ee4434faac31c5c4f2cd2b326c0a35e4a071a241904` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-png-hot.png` | `4481be7cd4f73bee54ce4f67b98f1c3bd6ae296c00018dc0441694f393b7db5f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-png-movers.png` | `5229f51500a858fbb68ce56e04d9c964302097ff9df27ad7a40690801077b280` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/before/BEFORE-OFFLINE-FIXTURE-png-rates.png` | `6f1a9668994b8220b121fd0f7c8fae778223ad7682176577429f46b7b47e48bc` |

Note: `*.log` files are gitignored; their hashes cover the local copies.
