# RECEIPT-10 — TT-10 (lane TT, offline)

## Part 1/2: layout

**Hot/Cold**
- `Sparkline` gains an optional area fill drawn per observed run, so gaps stay unfilled. Hot/Cold uses 50% in the tile's tone.

**Deployment**
- **Mini table:** L5 | EV / PP / TOI | Season, with an "L5 … Season" header row. It replaces "EV a / b · PP c / d", "L5 / season · season x", "TOI/GP L5" and "TOI/GP VS SEASON" (all four are still in the alt text).
- **Hero row:** holds the sparkline and the change. **The absolute L5 TOI beside the hero is dropped**, because it duplicated the table's TOI row and the extra row pushed names out of 185 px tiles (caught by the guard).
- **Games:** "N GP this week" sits directly under the name.

**Rate Standouts** (TJ's mockup)
- **Top:** name and badge, top right, clear of the logo.
- **Middle:** the Δ/60 large and centred, with "Δ/60 VS SEASON" under it. Below that, a large sparkline (176 × 50) with the **season rate at its left end** (labelled SEASON) and the **L5 rate at its right end** (labelled "L5 SOG/60" etc.).
- **Bottom:** "N L5 min · N GP this week", centred. The season rate left the meta line because the sparkline's left end now shows it.
- **Clipping fixed:** "GP this wee" no longer clips.

**All cards**
- **Stripes:** the neon edge lines now have a **subtle band fill** between them (the home page's bands at 18% opacity), as TJ requested.
- **Logo:** a white drop shadow (3 px at .5) first, then TT-7's dark edge and light tone halo.
- **Mirroring (2-column cards: Hot/Cold, Movers, Deployment):** the right column is mirrored, with logo and stripes on the right, the stripe angle inverted (−65°), text, hero row, table and chips left-aligned, and the team tag bottom-right. Its vertical group label moves to the column's right edge, reading top to bottom. Rates (3 columns) are unchanged.

**Guard**
- **Coverage:** every part is tagged `data-part` (name, week, hero, absolute, kind, details, table, chips, rate ends, rate sparkline, team tag), and the collision guard checks all of them pairwise, inside the tile.
- **Clipping:** it now **flags text clipped inside its own box** (scrollWidth > clientWidth), which would have caught "GP this wee".
- **Already caught:** the guard caught the deployment overflow and the rates meta line running under the team tag before they shipped.

**Evidence:** `tt10/after/{fixture, genuine-run2}`, all four cards, desktop, phone and PNG. All four genuine export tokens match.

| Check | Result |
|---|---|
| E2E full spec, :3110, Monday/Wednesday pins asserted against v2, collision guard (two passes) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: 2fae63f9d5c90039b66896f08a8b5e7dc3b77dc20dfffa5867dd40b18e18410d, f9ad26e0a349153c7923043b7cfc6b92e3dbbed245b68747274025fe504fbafc, 74b4adfb2077178ae6b6fd54faa39499cdbddbcda0a80b6dc79dcef27c6f669f, 899090fd30173896ddc0aac21efc3a783d919246660edec0db6078a5f179ca2f |
| Vitest | 231/231 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK (tsc checked before committing) |

### Part 1 files and sha256

| File | sha256 |
|---|---|
| `web/components/SocialShare/SocialShare.tsx` | `2252bbdc7cb2247e6657ca209193b3a2de9cfef0c9d6392cade42541bd261253` |
| `web/components/SocialShare/SocialShare.module.scss` | `ab9c70ca8b00ee972db73a334a758214ad00812a61edc99657b80f1aa2a42596` |
| `web/e2e/social-share.spec.ts` | `93e37388e6f32355dd94dbdc3cd36389ee50c97b334fe665a2254bc3725fdfb0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `609e280b75b797f61cc62c9987da3a00828833595ab144bb7f654aeddc6d36f8` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `e527eb91ade669061de226c74f9d9ed9ee76d213097837bb6b6896a7c2b8c0b7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-22a.log` | `551cb4852841db6d60a73e951c6b8e315e8c3c385cb2ab9db534afb1b700cd62` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-22b.log` | `c54c4afed3b63610c66e762eb670091b0ed5c52cba191902c28954e3f1d3f935` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `475567c2aee8d183a0a739ececd00b176e2a7a4052fe730af269aeee3bde31db` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `dbd716da8354254d3d18656b597c3630a447bba0ac21e8485b5fd647cfd3a39a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-22/tuesday-cards-pinned.sha256` | `fbe589b8b4ddf190dd6591c82a534049a281c8ec3afe99ef594abbec64742361` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-desktop-deployment.png` | `220c91b676c5abd60d4b246edc048a36ead85c206ba1098fb82cba4510d386ac` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-desktop-hot.png` | `bc8e75e34bb673ec26164463c468d364cce714817f9a5bf480997b61a43745c5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-desktop-movers.png` | `d11444e4c8ee6a56e265fc0f8339f3c05474b689a95bf334ed55cf8e339bee81` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-desktop-rates.png` | `bd487beb87caa5d69176c236b17311493c52c96edc3836b70cc43477ff9bd575` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-phone-deployment.png` | `64903637f57922109b94939eb57d5467469eb838ea095e5b943bd93581b7de0b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-phone-hot.png` | `47cabac10266614979226f17b2f92ca92a211ad9eac9056240428cddbbc62345` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-phone-movers.png` | `ab26f97adf134e7750d6f4a10dbd4cf9c2697ef850013824963aade3e58fe854` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-phone-rates.png` | `55251b9fd26b24565a8aceb55b29075eb8f062f1d47739437ca6adf96f07ecb9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-png-deployment.png` | `e213af1e35e66612f74f961e12607ff2e5b3fee11c0f859ec798b0976ab4bab1` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-png-hot.png` | `4ed1bedd9e0326b953d042b59d916df000c547f68406acb8002eb5e144aceaff` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-png-movers.png` | `b80bfdd3af09dbf7c4430fbcab4f345a84b555ca3b49746a419f4d0e4f5cb465` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/fixture/TT10-OFFLINE-FIXTURE-png-rates.png` | `975e1ef904aef1aaec7649bd964ca97e1c7fac40c54962c0476aca402b82b6db` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-desktop-deployment.png` | `a73867cfaeb31aa00a0f99d9e5ccb865bf93c8abfa78827367409c449d3a4d43` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-desktop-hot.png` | `8be7262c20f408779fe498bee9078acd0f0db4b0eebf58f8222e5aec959bfc4e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-desktop-movers.png` | `6e9b7c2808cf1b9a6679303e6d73933916bdb0ad15e218e57f8f07f2116f0247` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-desktop-rates.png` | `f3edd81877d16f719d9fcf95ba7449a0f2a9231d942f70d224a6b6664b1517e4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-export-tokens.json` | `1665aad626bb0104cd6fba4faf6b20067816597521e8f9be854cfc5dceacee9e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-phone-deployment.png` | `028ab8ecdfa0fea35f8267b392bbea7f07ac27570400ffdb3268e2041c19122b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-phone-hot.png` | `bfd172b9f2316cf894638e64ae06fc3d2401997282b6bb4a5ef2c8a4a3dd228f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-phone-movers.png` | `a23e6f23a6c53cbf0bc1796243904513ead07bacba7e33af4a60f7021617ca0a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-phone-rates.png` | `5c9ef92ba1f2a9d5a00bf18ec23d1f1ecec3cba5731b2d3ae13d1a1349c36952` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-png-deployment.png` | `7c966df0022a8362d5bf00607d916c81b33779b94fd1171dd16c2bc2348d08e5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-png-hot.png` | `e1a3d7d251a595c1d90aaf4af6a97cbcce5da904b9d4acf3a6ef7cbb3e31ab6a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-png-movers.png` | `de8c8b687b1c8a3864e2d7f6c7bf1d7e645c57eede5957627ab8cf6ab25c0ec3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after/genuine-run2/TT10-GENUINE-DATA-png-rates.png` | `dfc20c3569563a5aedb116e07cb0c2cf35dd591523843253a9206e31cff819b8` |

Note: `*.log` files are gitignored; their hashes cover the local copies.

## Part 2/2: data

**Rostered % on every tile**
- The team tag reads "TEAM · POS · 45% ROST" on all four cards. Missing shows "— ROST", never 0%.
- **Source:** Yahoo rostered % at the latest ownership date D, from the O3 rows already read, through the new **M3** NHL → Yahoo map read (`yahoo_nhl_player_map_read`, `nhl_player_id in (≤ 27 shown ids)`, cap ids × 4, after N1). Movers use their own D value.
- **When it shows "—" (`trends.ts`):** no observation, a null value, no mapping, a failed map read, or mapped ids that disagree.
- **Stale D:** no tile shows a %, and the footer date is omitted.
- **Footer (metric cards):** "… · Yahoo rostered % as of D · not projections". It now wraps to two lines and still fits (the geometry check passes).
- **Rates:** the tag moved top-left. The collision guard caught it overlapping the centred "L5 min · GP" line.

**Line/PP chips (Hot/Cold, Rates, Movers)**
- They follow the badge and come from the latest game, with no new read.
- **Line chip:** only when the line is known.
- **PP chip:** PP1 or PP2; "off PP" for unit 3 or higher, or when the game's PP rows omit the player; "PP ?" when the game has no PP rows.
- **Deployment:** keeps its change chips (▲ L3 → L1), which already show the current line and PP when nothing changed, so no extra chip is added.

**READ-PLAN v3 (M3):**
- **Statements:** about 15 typical and about 22 worst case, against the 40 ceiling.
- **Tables and columns:** none new.
- **Approval:** pending TJ via the chef. No RC is built before it.

**Genuine run-2:**
- The captured layer predates TT-10, so it has no `rostered`, `role` or `rosteredAsOf` field and no M3 mapping for non-movers.
- Its tiles render without the % and without the new chips. That is correct for that capture. The fixture renders show the new fields.

**Tests**
- **`trends.test.ts`:**
  - rostered present, including a bare Yahoo id;
  - rostered missing (no observation, null, no mapping, failed map, conflicting ids);
  - stale ownership;
  - role: L1/PP1, unit 3 → off PP, absent from the game's PP rows → off PP, no PP rows → PP ?, failed PPC → PP ?.
- **`SocialShare.test.tsx`:** `rosteredTag` (45%, 3.4%, —, absent) and `tileRoleChips`.
- **`trendSources.test.ts`:** M3 is one statement for ≤ 27 ids, and `rosteredAsOf` is set.
- **E2E:**
  - every tag matches "% ROST" or "— ROST";
  - Hot/Cold, Rates and Movers tiles carry exactly one PP chip;
  - the footer regex includes "Yahoo rostered % as of D".
- **Stress mode:** the long-name tile carries "100% ROST · L4 · off PP" and the next tile "— ROST". The collision guard covers every data-part, including the tag and chips, across mirrored columns and tile edges.

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, Monday/Wednesday pins asserted against v2 (two passes) | **34 passed** (33 + 1) |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: 49cd0b7d1bb9855a92836808061b8cb4e7c759dc6f5a471a788a8c9c6a32f029, 6b24bcb594958633610dc7190b828b20a6ad9e5440554e4901c4aa03fdeee61d, 74ddd1e659077050245f2a5adb64b9de5c29d6ddf178de74054c2dfbe38a8ce0, 4591b223f3291cdb2b394d6e904907bdae06e379d47dd8f1fbc778ced7a42c1a |
| Vitest (lib/socialShare + components/SocialShare) | 236/236 |
| ESLint / CSS pure | exit 0 / PURE OK |
| Full `tsc --noEmit` | exit 2. Both errors are in `web/lib/player-cards/currentNhl.server.test.ts`, untracked work from another lane (player-cards, outside lane TT). No TT file has an error. |
| Network | 1 denied Next.js version check; no egress |

### Part 2 files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/types.ts` | `1831ff0bcf344332dcebe07bc42db4e1d0f6d69aa00e15a1a847b95f4fd95a68` |
| `web/lib/socialShare/trends.ts` | `13a35e725ce92cc330029c541b8b6eb1df247b35b945f92e728022d84ab16881` |
| `web/lib/socialShare/trends.test.ts` | `f0a9733c9d6d73c971dc0921afe56158712fee5297f5733bed25e9dce6005db5` |
| `web/lib/socialShare/trendSources.ts` | `fdb6575175bc1eafaf107b0a028b12c1fff6130a6ff501ea1a9f683c4482eaab` |
| `web/lib/socialShare/trendSources.test.ts` | `45bd3f3b1c89c2c272621133897b85020a604910637a7518d302e465db1ee0e5` |
| `web/lib/socialShare/trendsFixture.ts` | `6885ed106aea9688649f85fea80d73dc590566b5f0a980b88be9938c6b46703b` |
| `web/components/SocialShare/SocialShare.tsx` | `586463ab9e1906e48033db5761bc95cf8e926bfcc6d75941455bbf4bcc6145cd` |
| `web/components/SocialShare/SocialShare.module.scss` | `e91344a6f6f2f230bea2b845fe31159c7c89a8b2bf4ed9ce46b5e02e8d5a4f90` |
| `web/components/SocialShare/SocialShare.test.tsx` | `89c18ba8a217ca51de1e32419f6dd92061ef438e73658248a32296b9f992d90a` |
| `web/e2e/social-share.spec.ts` | `d6c86b96e25516dc1d5dd2450e21ef062486790097e75625f2487f212b98b3ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-PLAN.md` | `bd66bb4534c99b79b93ec70fb593dc2f1ed7608d28c358a8b8928388f913bb05` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `26368c59a0b6a891b82d72f50911ce2e1796678eb4bba5eaa3047b5d312bcabc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-23a.log` | `45ec09fb4620e647bb76b1abc65fed4eeb6220f8dc2f39fa283405d96fdb6fe8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-23b.log` | `aa643fea7457c88dd36e335f818d13fc88fe772dd978af2d9f00c68b9f8b3a5d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `ca2ff334d54d31e47d8236b4837cc3c5c3238975890f417f1942e81409c5a7f5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `7d6918dd6c71fefc7582afdf92f932deb9f532a1c0c19bcba6e9c9fd8ec769aa` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `f55ba75b76b6d35f464eb6d9ae6eb3d02103174fc61cef19319f1d52920a92fc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-23.jsonl` | `6c4479489c29d5e07f58c2bd7f7c9c539bba3939d062176e5d137b7e04787aad` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-23/tuesday-cards-pinned.sha256` | `6a571b68a27007e7926e0e8961348b85a2c6c709d40c253ee7d2f8e380370f8b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-desktop-deployment.png` | `0f537afe4f6fb69c8e3633dc28d41acc98340be2cdd9212b25ba1dd5d7465206` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-desktop-hot.png` | `9b912768366d578a3c51a5471f33bb5e6fd3d50977778bcc3c51c2b341d9a217` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-desktop-movers.png` | `b411bba37cd6cbf41e02cc4f895a2ac564f0dd82922bedd73f73b66d6b12693a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-desktop-rates.png` | `233c603fbca41e9bc100d42a38b1c7042cf1a3e1e32605c827919ffb0cb3d54d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-phone-deployment.png` | `950e42c371b7abc9cca77dfd6db7fb3e45b224744e50aaeefae53a0f7b3585eb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-phone-hot.png` | `56188ff37fe870ebc44b2c81481319fb63ed0364facac1a0cbdec53d618e36fc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-phone-movers.png` | `dabae86292454f19bcfcbdcbbdd7384f1a4014ca4d3b0c285a0f62cb4162042a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-phone-rates.png` | `8b8f1531ee8d70fe514a8e59683ce6922c9c302fafc749b33b4217bc4ff65fd7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-png-deployment.png` | `761b5fba9442f900c6f807a0cfae141ef474afa88c8d1c4fa2c5941fa1430f5b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-png-hot.png` | `20141c2259e1a2685595f904f74455a94d1251a1c8ddba4410f255b5d6071316` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-png-movers.png` | `e17ba51ec82e07b55475cae3c5135cfbaf47a3724ef2cc3d9d56fe95cce208dd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/fixture/TT10P2-OFFLINE-FIXTURE-png-rates.png` | `9b24a6e949ba41edbffa3f442ec99d25073edd8364acc90d61709f4b31f72e3e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-desktop-deployment.png` | `596b287f761e24ad9ccafb6162370795581effe149e565e90c40a137f8e17037` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-desktop-hot.png` | `354a444fa7d763bf77e1d80755bd501a2cd250dba3265f96617bbd5902aea12d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-desktop-movers.png` | `046dd1756016e47f6ae833685fba84f8be9072207fde54c5c035a6bdb4c289b9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-desktop-rates.png` | `fe7a1d50ca970e0cae415c8f6aa5374c57dc25fb698a8c5010bba9f9808deb9f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-export-tokens.json` | `6820a2e8ad0b7ff52bb779db70bff89d76b3547d02fed773cbeea68af5f724bf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-phone-deployment.png` | `3a36cc4536620f299bdb9bdeef6bd913360759c333648834d27da77073b060bf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-phone-hot.png` | `ad4d254f92355624456bea2391aa3ba301f8ed9f2e55d7c9d8cb954fc77732b7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-phone-movers.png` | `0034ee5754d7acf0f199e35847bc4748cd6bf5e048ee1419c360dee64f28d723` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-phone-rates.png` | `8e7abc3594746949785bf30a8a6034787b020bef68257fea5065ce83e9db6494` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-png-deployment.png` | `7c966df0022a8362d5bf00607d916c81b33779b94fd1171dd16c2bc2348d08e5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-png-hot.png` | `e1a3d7d251a595c1d90aaf4af6a97cbcce5da904b9d4acf3a6ef7cbb3e31ab6a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-png-movers.png` | `de8c8b687b1c8a3864e2d7f6c7bf1d7e645c57eede5957627ab8cf6ab25c0ec3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt10/after2/genuine-run2/TT10P2-GENUINE-DATA-png-rates.png` | `db135e3a7b8e725f9eabfa9003df4239f60d77df8a1f8653f265fde562c87f93` |
