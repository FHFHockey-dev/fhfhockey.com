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
| Vitest `lib/socialShare` + `components/SocialShare` | 228/228 (new: sparkline differences, gaps, dropped inconsistent series, game 1, mover series endpoints and gaps, tone = hero sign, SVG gap rendering) |
| E2E full spec, :3110, pins, genuine render | **33 passed** |
| Monday (9) / Wednesday (9) PNG pins | byte-identical (committed `OTT.png` served, as before) |
| Tuesday pins | changed by design: `tuesday-cards: 9c37e172b75b7d1c3630af19d13d928f9a1055816074f5fab5b435881414e286,c71f7f0256850f414eee9c56bbe12d9b2169d73936d28d833bc095f84b1e9507,cf0bec88b5bb23e3a5212e5475ed894566109bb61d97a2b54c972ed9540b82ee,48dde0201ee1c9908ad72e5d9e92a6e04ee0b0c3b96acd63d11b4f890a13bb3a` |
| Loader test | fixture equality holds; S1 ≤ 2 statements with `strength_state=eq.all` and a 35-day window; M2 is 1 statement; most listed rows carry series |
| ESLint / CSS pure / full `tsc --noEmit` | exit 0 / PURE OK / exit 0 |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trends.ts` | `b66e12aeb18b0daa852699340c918bceb1a5750c44ce5ca04338308577b4e335` |
| `web/lib/socialShare/trends.test.ts` | `8e74a57cf30ac1e5669ebeea9d29108218cddb077a7842463763e900aa248df8` |
| `web/lib/socialShare/trendsFixture.ts` | `38155ae610cebf6e9f82ef1bd52cdae9bac0733bc8f3959208177c9b2341965a` |
| `web/lib/socialShare/trendSources.ts` | `ec402e7f6401845ef7313e0f57fb0a5cd99fbb5f5701f997c8e89e4c0839dd02` |
| `web/lib/socialShare/trendSources.test.ts` | `7f1fd574a57328a991e368c0fb920920bd0ca2084b1c73a88d05ab8659ba0069` |
| `web/lib/socialShare/types.ts` | `a9235f1d8592229803d13870fd4d31045be98cb602e323b5eaf76c702b27874c` |
| `web/components/SocialShare/SocialShare.tsx` | `662f87c90897e76becbf3ac2c78c45fafdd0034847d80bd94f5e2fd5237c8053` |
| `web/components/SocialShare/SocialShare.module.scss` | `ebc98097abb8b8fc4c22570ddc6e3fbd7a96235f7a6c1792c3a76fcb5598a0c5` |
| `web/components/SocialShare/SocialShare.test.tsx` | `024c535a2e985e123c9aa15ae3e84d0db079ae096ad3045b6fcb3134c3d95361` |
| `web/e2e/social-share.spec.ts` | `53e16ec087f6ad0d13983c835dd78e8aeaeb9c9eac1d6ff7330b3e4541264aa7` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `118dfffb6fd0eb7e12d331635155eef83f08d13eb85d54d3498c2aea303f38f2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `5c213d9a6e6bc113d29a45f0a26be688ec66ba70e4808e19b6423dd97e39dbc8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-PLAN.md` | `29530526600004f33d68521f72687ae7b28ec30b68cf4ac9ea19419c1872480a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tuesday-pins.txt` | `c043dcdc71a724b8b4997c8c968f332bded71977e14dfc47919fb4066339710b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-4.log` | `c9ef34d4eba537d8befa9ec27198dda75a1146502f8f098549515d62fd8c8de9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `bd862782f1b754040362b8ce658aea097fd17cb50b137204c9b1b0c59fd61e1d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `ab07584f78f4fac2d4a8900ac0b2819c04d9716b0690443fabcb581819bfc129` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-4.jsonl` | `164e107959eb80e55252d2233b9bd5d873be5a0ac7c160305fd126c3822c49c9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-deployment.png` | `7db7c217304fd49cb6d949a82aa877e3187b0945eafe55fd2de0f79bb1e8d610` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-hot.png` | `5b7d51ae28007765f474f4fec8784aa9e5ff984cfc510028029c6cdd0382711d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-movers.png` | `7ab9f22f46531f9de5fe0a27c0a6e2ab2cd819c9e0241909ad5dae35c6f2864a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-phone-rates.png` | `f893988668a07ad27e59fbe6fdd9eeb0f8265c56f946f4c4cdcb7e61320012f0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-deployment.png` | `812421ef448eeadf55cc4db96dc9a9f2d335859514770f26ecc9649958cecb8c` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-hot.png` | `1bbd59cd1f53e727d1f1f5af214aa434f62db09f78aeccf229c6a17b4d705928` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-movers.png` | `e860ddba069d628b1c75fa51d8459f5a39f64f335daba458d247358cd5946a37` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/fixture/AFTER-OFFLINE-FIXTURE-png-rates.png` | `6e7fa920026cbee8f0533dad74542399fd6d3010984306be3fccda533be74585` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-deployment.png` | `2ff624f08d3c698632c31f56928ae2ca836b66dfe7451a49c79bf8eeeb02be61` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-hot.png` | `3d8930b906ed7350ce4edbc8044f5943cd53a32b9774427422a4c393557c86f7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-movers.png` | `b7931dee9894752ee9ffe694239a1719bb8e5dab965beb4b8e77bbdba18dcaf4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-desktop-rates.png` | `d3741e34938d3688f03c228c37f76eb23294641a72e6c3e007eeae4ec88e40b7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-export-tokens.json` | `991503bba8ed7921ab60575f1a51619994822c8687663da87dd4847747e8a72f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-deployment.png` | `9e4716c00e95e751c9824371d25d8291d3500e7f439ba35f51a3da94b88847e2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-hot.png` | `33ddf7fa64a7d599baf46c8e31f374719943a0df195f3ae5307083109a443c59` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-movers.png` | `25404f71a0e118c927a604eddc00d5d6b91f5e2ea20681ccad858de89c9106f0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-phone-rates.png` | `965da4b9df4887f32b5c67133c3e817ceb5478f48d756d0db472c800886a92f1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt4/after/genuine-run2/AFTER-GENUINE-DATA-png-deployment.png` | `aa01d9d915f81c86558456fdc0c64283b73435f2a64fcd92ac010bd68b57dccb` |
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
