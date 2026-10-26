# RECEIPT-1 — Tuesday Trends offline build (lane TT)

- Lane TT; worker session; canonical checkout `/Users/tim/Code/fhfhockey.com` on `octoberBranch`; base `cd73cbd69`.
- **Offline only.** No production reads or writes, no migrations, no pushes, no deploys. All E2E traffic stayed on :3110 behind the SS1 network-deny preload. `run/node-network.jsonl` has one entry: Next's own npm registry check at server start, which was denied.
- The commit SHA is reported in the chat message. It cannot be written into the commit that contains this file.

## Checks (this tree)

| Check | Result |
|---|---|
| Vitest `lib/socialShare` + `components/SocialShare` |  Test Files  17 passed (17) ·       Tests  215 passed (215) · vitest exit 0 |
| Full `npx tsc --noEmit` (web/) | exit 0 on this lane's final code (run at ~15:58Z, before the last concurrency-only loader change). The re-run at ~16:10Z: `tsc exit 2`, with 2 errors, **both in another lane's uncommitted FORGE work** (`__tests__/pages/api/v1/forge/players.test.ts`, `lib/projections/apiHelpers.runAdmission.test.ts`: missing `requireLatestExternalInputProvenRunId` in the dirty `apiHelpers.ts`). 0 errors in social-share files |
| ESLint (social lib, components, spec, API route) | eslint exit 0 |
| CSS Modules pure check (`SocialShare.module.scss`) | PURE OK components/SocialShare/SocialShare.module.scss (34961 bytes css) |
| E2E `e2e/social-share.spec.ts`, isolated :3110, real access gate (fictional `.invalid` editor) | 31 passed (1.4m) (the E2E mocks the edition API, so the later loader-only concurrency change does not affect it) |

## PNG pins

- **Monday and Wednesday.** All 9 Monday and all 9 Wednesday pins asserted byte-identical to SS1 t24 (`pinned-env.txt`). The final run served the **committed** `OTT.png` through `SOCIAL_SHARE_LOGO_OVERRIDE_DIR`, a harness-only option.
  - The working-tree `web/public/teamLogos/OTT.png` is dirty and not ours. Served as-is, it changes only the Ottawa logo cells of `monday-grid`, `monday-easiest` and `wednesday-grid` (pixel diff confined to those cells).
- **Tuesday.** The Tuesday pins change by design. The new values are in `run/tuesday-pins.txt`; a second pinned run reproduced them byte for byte.

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/trends.ts` | `88583eb8406ad5e199919d9e0b520a171223ff43d442b2b1a8065c4a7f6fca0b` |
| `web/lib/socialShare/trends.test.ts` | `028e654ae88918de319ecd23dbd6d260ebb5732fec0b9c9e77394f9317e31cee` |
| `web/lib/socialShare/trendsFixture.ts` | `755bc767d36dcbd6820fbe111869a9beedd77848494ef296eb49a8bf75056bba` |
| `web/lib/socialShare/trendSources.ts` | `b58025819a32f7b31bc3eff4a31eab95940d80ce38070f106caab91766d43763` |
| `web/lib/socialShare/trendSources.test.ts` | `64a4bd31cff6df5085d0c7bad110de1d52e79a3007d2d3ad20d144699ee757f2` |
| `web/lib/socialShare/server.ts` | `fb376699db41c60b8a47213c92fc1b3ff6b829e63991fe3ff68a60af70384b9f` |
| `web/lib/socialShare/types.ts` | `53902f3d51901bf593d65c2e5ed1fd5f4c6231170f7430ce75d08ffd696b47d4` |
| `web/lib/socialShare/export.ts` | `c05e295f9be16d679c5b6ecf37098d8c63f699e76321174196632f2a95f1fdaa` |
| `web/lib/socialShare/schedule.test.ts` | `3b251d7e46a5f5b3420a5ff692a4b7668171b93aa92348c63c668e3628a74a55` |
| `web/components/SocialShare/SocialShare.tsx` | `8831d6a72fa97fc6faae43dcf8d6635b11d551f3f531edea28f7f42c682f26a9` |
| `web/components/SocialShare/SocialShare.module.scss` | `73e1c6f3c5db4373b79d3e4b5adab4cd0970eb5a4d60962ada586f483d53b903` |
| `web/components/SocialShare/SocialShare.test.tsx` | `1e5ad4ba6424d379c254c9ebfa9d21098bce534cc655351cd475f22b2686655e` |
| `web/e2e/social-share.spec.ts` | `5828db5bc69f3bbc1adf1c8093d435a3e90b3abd8bd765817705d10c6492a069` |
| `tasks/diaries/2026-10-26-claude-tuesday-trends-worker.md` | `818350124c3f8f6f34e4f896e4ea5fac435b761e493c6c12362b10f2e2a49905` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `8d1f94c8cd300a023d3de3ba03fbd88863065543c12f8b7bec69fc469e724762` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-APPROVAL.md` | `54c4953836314ce2ad8e1fcb2f3fb5ff961f8b14674c73bb0539ecef7a5e8675` |
| `tasks/artifacts/tuesday-trends-2026-10-26/READ-PLAN.md` | `0758098203c6975652982a4f4cf156cf73d4e9f78a78a97b46cea64f7e9f1c00` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `63136cbe346d775532a26ac2443350684cd5a8acfb291745f81b302686726ab3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final.log` | `090e1df5830f129822e5f16189739074b4d40eea47c500e66acdc5f85796ca61` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/monday-extra-cards-pinned.sha256` | `82184cdc637b03796946a8d73e330afd3d8b5b67741954360620e7776f1b6dcc` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/monday-grid-pinned.sha256` | `06cc5d470d3c2b9235335fa087666ab509ab22a10a01543ee8870bb647e57ad4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/monday-player-cards-pinned.sha256` | `b201d2ab7a656b2affe6361770b1abde1898afc66045a46367ca67a0eb8ac58b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/monday-tier-cards-pinned.sha256` | `c057222b3ca739f99b4401c7f854a91fd70a8caf39a39dfbe8671f65e4499a66` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-cards-pinned.sha256` | `15132717dd8d5e3c7c74b32a81cef9d3756e84d13f428125f0499080c54f4343` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-deployment-pinned.png` | `cc716a700471c01abd7103c85f8590a9333b0c99a343d844bfbf9b09476d96b2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-deployment.png` | `91d1bdde3f4c7400fa948678c8c88004ca00df02dc5b433a6b2ab6a2a697491e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-hot-pinned.png` | `e6791fa78eef5670d97bbf0047cd0f8fa16e69fcb7ee3d6387302aafdf8e3ff7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-hot.png` | `61ca079c437c43cc205f0c9b5ba99e30fa9fdbcb41e852d5e1eb6172c9b9cd81` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-movers-pinned.png` | `0d7e169e78ad7fec53b6fd4e498e639b1b931270a826b5dccde0734e30d01845` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-movers-stale-preview.png` | `d83aff6229a033fb4310d89115fdd4d2155593bf2e9147fc761071fa0a6e964b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-movers.png` | `7b45512db25a888c1f1c63f5e5eec73449266366571609cdbed5d0f981eb4ec5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-rates-pinned.png` | `1e190b14e467deb1a488577905cd9e7ab7ccacff54f2919de9cc692841da1c56` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-rates.png` | `ebfa66efeafcfe689384b2289c8d3f5e155c259bdee57c63cace1eb3ed9e1164` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/tuesday-sources-unavailable-preview.png` | `6888ecdbea80f8e765f661c0342cdd860b0971b51379339281740197253c217e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence/wednesday-cards-pinned.sha256` | `f33f24248d5d37351db4fb8b315a36d523791315f46ca0e01a253c6efdaaacf2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/final.json` | `7721f5039b37ce3eb4a026a247023e658e3421591f8fb34162264e0b6f68dd18` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network.jsonl` | `32823037aad0dcd78a3846fae46c3df436f0605fa009f29c23a34809da770122` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/run-e2e.sh` | `66e9b1fdebf9b1baab199a0618428560fd522ca361a0eb6023f27096201d1f12` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/server.log` | `b8bba916f74c560468699825582cc4b5a32bcbfd443fb150dc190265e1759f1a` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `ac4136d83d057012a37dbe6db039fdef30fd48a0a2c80fb2f4c27475af628755` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tuesday-pins.txt` | `c6cf1b63b3bd5c5ff7de52f0df9e6a97152bd33c9317fb5229cf7c8245a89777` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `5f1ce418f704b187e9e6cdf4511a18277fb9565bfecafed504028f5d16a40dd4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-deployment.png` | `cdad9a820a0d3b077970ca4e08c4bbe946893d6e31fb12c91934f36fabb0eed2` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-hot.png` | `1109493b7d7816c79878b8d65af63bc2d001cba87b46f0591f90094ad7107341` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-movers.png` | `319621f5f415cdd7a7f86e2b239c5514b11a9d46fa9c79007cfd35fbadf67851` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-desktop-rates.png` | `bb8940362a5d9c3132d694d35749a88562f1caf40df227f3fd534e500834a14b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-deployment.png` | `0a58742a4da483902aaf3d4572fd5e77e6b34232f5f4f7d8b7fda3555a5d141d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-hot.png` | `e573245d380b644cf177959d57982efdf5c381df339f52e5f8377adb770a4ba7` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-movers.png` | `85bb72d1b8553f0bda1886c194ea333f207ae830ae71b676fc4b098e9c428590` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-phone-rates.png` | `5da1831d928692b4cbb9393ca2a38cc78a1c7c7a1050f69b6357fab5dd58731e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-deployment.png` | `7b8108613b92da6fa832453428455c33ea216d4b6b22c557009ee0917bb868ce` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-hot.png` | `61ca079c437c43cc205f0c9b5ba99e30fa9fdbcb41e852d5e1eb6172c9b9cd81` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-movers.png` | `7a39746dc703a63115853ea578d70de21ed3d1322baf1cb428580882e1b25941` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/OFFLINE-FIXTURE-png-rates.png` | `ebfa66efeafcfe689384b2289c8d3f5e155c259bdee57c63cace1eb3ed9e1164` |
| `tasks/artifacts/tuesday-trends-2026-10-26/screens/README.md` | `1836d47a94d27f5c9d6899481372dfe691aac8b2949f81bef71c7933008fb84a` |

## Not in the commit

- Bulk evidence PNGs from the other 27 E2E tests, the repeat run and Playwright `test-results`. These were moved to the worker's scratchpad.
- Other lanes' dirty files are untouched: `OTT.png`, `next-env.d.ts`, `cardEvidenceVerdict.ts`, the forge/projections API, and the coordination files.
