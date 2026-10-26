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

(pending: not yet received)
