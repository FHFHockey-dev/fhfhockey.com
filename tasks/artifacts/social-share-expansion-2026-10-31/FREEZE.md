# Candidate freeze (SS 13.6), second freeze

Frozen 2026-11-01 for independent audit. Replaces the earlier pin 066d80608, whose audit never ran (the job stopped on a sandbox write error). **Code pin: `a398781fd34721632206d3136129620be98b1fe3`** on `octoberBranch`, local only. Not pushed, not deployed. Includes Last Nights Standouts, the panel and kicker seams, and the `powerPlayCombinations` writer fix. The landing page is later work with its own check.

## Tree hashes at the pin

| Path | Git tree |
| --- | --- |
| `web/lib/socialShare` | `160b55cb544252baa103b75b7a749884b240ba9e` |
| `web/components/SocialShare` | `f2b83f4ad4b4fec05d0ee964024574ab48658bd5` |
| `web/utils/getPowerPlayBlocks.ts` | `6b345228c289ec683b723bf5427962a9b89c2204` |
| `web/pages/api/v1/db/update-power-play-combinations` | `89616d833f3932852067af79992d139efff740b4` |
| `web/e2e/social-share-comparison.spec.ts` | `779c35db48e453e09d9bf60d96176f0b0bd96f17` |
| `web/e2e/social-share-crease-category.spec.ts` | `a1e137a2748ddaeda059fd327ffaf261b7dc3348` |
| `web/e2e/social-share-goalie-workload.spec.ts` | `efa3d0ba37a03f80a143e9e8e488a241e6b1c89e` |
| `web/e2e/social-share-inventory.spec.ts` | `75f35eccc4ac2dd65f9bde1db2bae5c452f421c0` |
| `web/e2e/social-share-last-nights-standouts.spec.ts` | `7f4b30fbc1108629a622cf272d5a61c9ebb9aa68` |
| `web/e2e/social-share-multi-cat-stars.spec.ts` | `28e8427fecf9fb636a83a325ed58eb2255ac7ac1` |
| `web/e2e/social-share-schedule.spec.ts` | `08933006150f3ce4b54ea9f06d6dedb861b46cb5` |
| `web/e2e/social-share-skater-boards.spec.ts` | `75cc4810719baa5fca295809794f8b0c1e054886` |
| `web/e2e/social-share-trends.spec.ts` | `00689f04e76e18aeb0927ac5f4ca248259a563ef` |
| `web/e2e/social-share.spec.ts` | `f60b00789a3206a3663183768c8794766d3e15bf` |

## Checks at the pin

| Check | Result |
| --- | --- |
| Vitest, `lib/socialShare components/SocialShare` and the PP route test | 45 files, 965 passed |
| `tsc --noEmit`, whole project | Exit 0 |
| eslint on post code, specs and PP writer | Exit 0 |
| CSS Modules pure check, post SCSS | 20 files clean |
| Playwright `e2e/social-share*`, serial, isolated :3110 | 90 passed, 1 skipped (env-gated); log `integration/e2e-final2-20261101.txt` |
| Real render | `integration/real-gate2-20261101/`, 30 cards at the pin, no clipping, phone width 375. Under and No limit built by clicking the sidebar's top 8 |

Other owners' uncommitted work sits in the checkout (Codex's NST and Player Cards files); not part of this candidate, though present during these runs.

Not run: local `next build`, whole-repo Vitest, any remote build or production request. The PP backfill has not run, so stored PP data is still wrong; Standouts prints "PP —" on clear contradictions.

## Known limits

Busy and Quiet minimum label font 10px; Team Games has about 187px empty (not reviewed, per TJ); PNG capture measured on Chromium only. See REQUIREMENTS.md for source gates and TJ's overrides.

## Evidence PNG SHA-256

- `integration/real-gate2-20261101/all.png` `d7ab971b07970e54cbaaf5fc7a35655d9fc8b4282eae1496ab273b493ab8a281`
- `integration/real-gate2-20261101/bsh-board.png` `1be0e860f2127c7dd7519949eede8d78e8e61865ef69b1cdee4e29f994dae379`
- `integration/real-gate2-20261101/bsh-risers.png` `7182ab7f55b7d6a73ddbd2762c98abe22be7bbd88bcfda25b0a44d9bfb36c361`
- `integration/real-gate2-20261101/busy-quiet.png` `81ad875a6091ea7e99733a45f632cff166d25a5b68eaf365cedc247e7ea6f269`
- `integration/real-gate2-20261101/cardio-masters.png` `86fe8f9cb9e26298c90303ba5fa261dbb49d3b1877fd7d2353d6d364841c2476`
- `integration/real-gate2-20261101/crease-shift.png` `04503481b85609666d8438015abac73463aa7f8fd711a9413f1c8b0196eb9d3f`
- `integration/real-gate2-20261101/defensemen.png` `db928300f011999bf42e234a0f237d2d5e8cb0357c6cc423b8fdc69ce252b98b`
- `integration/real-gate2-20261101/forwards.png` `33d048e4cc0f31bd0290ea7f1d59738a8a09df913bea3985161a9613bede599b`
- `integration/real-gate2-20261101/goalie-gsax.png` `e2fa0bffd64493f12374fafc1aa949f2a2e50dbdb6512cd4cf9ab3ba8bbeb39e`
- `integration/real-gate2-20261101/goalie-month-oct.png` `36a1388dc739ddaa413748801f13b7fe06d5e8764dc293665c4360d732cb3af7`
- `integration/real-gate2-20261101/goalie-rescue.png` `58f653b368e9ba3a94077c1d3b7a5ebb3f8d58eb8db711f92cf0ca6c6d94c7db`
- `integration/real-gate2-20261101/goalie-week4.png` `ebb6487ad9a387ffd45c9d3a2442cc2e49939c64ac8ce669115295c775b8af8a`
- `integration/real-gate2-20261101/goalies.png` `c1d812ec8e908b7e1c22accb53971417bdc337fb324d5961be251d40e2980c0e`
- `integration/real-gate2-20261101/mcm-points-first.png` `01c85b76547272fdc184ed90f99ff02b6eda4c88f2d1d85d0ec2c00b032fc339`
- `integration/real-gate2-20261101/mcm.png` `49c3d06a3b2aa97ac28b870073d18cc304157057cae0abfea5ac893df4f52586`
- `integration/real-gate2-20261101/nightly-floor.png` `ccf190d7c5a430e7be68a8fa648441356c904cd6dbced55f59dc4c6300ba53f2`
- `integration/real-gate2-20261101/off-night-rest.png` `a9fa2098d10042da8c5b152bbc9b68d5ff8193ec1d4fbf35482995ea70fe8899`
- `integration/real-gate2-20261101/off-night-weekly.png` `e660f7ad0d6b394ba696827b63a024b20218c2242f3b0a6d2b65f9776fa3f342`
- `integration/real-gate2-20261101/player-vs-player.png` `38f8493d0ec5b49d174715038e50d5fd72e22bf95f4758a33cd9c5fbe247b566`
- `integration/real-gate2-20261101/ratio-impact.png` `77982dffe4e6dc5df2fb67c55b7c9f764366cde62eb588e77b0e78d5a83763de`
- `integration/real-gate2-20261101/risky-starts.png` `c535ca374c8f68fd63e00994af66b983534ed74023e67c53b9bf46db884edc3b`
- `integration/real-gate2-20261101/role-watch.png` `208f89a82c2415dee1f682269ab105b6e101c6bef679e8dd5d829bf089ae9d38`
- `integration/real-gate2-20261101/stars-pergame-pf.png` `63051af3be74720450aab5ea8934b3e81f23b4c26f49c13e982b1ab5d60c7763`
- `integration/real-gate2-20261101/stars-pergame.png` `f69e9f7e03c9d5996c144871f696b0401318407f2bf9323ef990d3168f39c4ae`
- `integration/real-gate2-20261101/stars-total-pf.png` `6519f7a5bd44dce167ebf2cec6da6843b63d5670e05872bfc102d6924156c183`
- `integration/real-gate2-20261101/stars-total.png` `b282f8d6b6018dc77aaef4b51b979a993dec176a045661417fe3bb1c64b1be2e`
- `integration/real-gate2-20261101/start-sit.png` `27ae6a69ecda2ccc2d93e2d47a74dcb8370dede5335e4520aab3655edc60305e`
- `integration/real-gate2-20261101/team-games.png` `d9db73ec1353b0ea1dcc2147ebd3b05fff3d1c1976b7bde46fb608ac66e859d7`
- `integration/real-gate2-20261101/under.png` `2cb1f7105c480e44e4237a7b20141719b20db2a31a510032b68482fb7f376523`
- `integration/real-gate2-20261101/what-changed.png` `a967a658bdf444e539e75999b790b043a417762babb1e58931c34234bd74a217`
