# RECEIPT-11: TT-11 neon logos in team colours (lane TT, offline)

## What changed
- **Colours (`web/lib/socialShare/teamNeon.ts`, new):**
  - **Stroke:** `lightColor`, or `primaryColor` when absent.
  - **Halo:** `secondaryColor`.
  - **Floor:** each is lifted to WCAG 4.5:1 against the card `#15191f` by raising HSL lightness only.
  - **Fallback:** all 32 teams have a `lightColor`, so the `primaryColor` fallback is not used today. A unit test covers it. The ticket expected one team without `lightColor`; there is none.
- **Tint:** the existing canvas-tint path (`teamOutlineDataUrl`, inline data URL) now runs once per team in its stroke colour instead of once per tone.
- **Halo:** the tone halo rules became one rule using `--neon-halo`, the team halo at 55% set inline per tile. TT-7's white glow, dark edge and 2 px halo are unchanged.
- **Unchanged:** green/red on the border, hero, sparkline and fill, badge, vertical labels and chips. Neutral tiles also use team colours.
- **Reads:** none.
- **Stress cases from the ticket:** Toronto's navy `#00205B` is its `primaryColor`; its `lightColor` `#3478f6` lifts to `#397cf6`. Anaheim's `lightColor` is orange `#ec623c`, not black. The black cases are the `secondaryColor` halos of CHI, NYI and SJS, which become grey `#818181`.

## Contact sheet
`tt11/contact-sheet-team-colours.png` shows all 32 teams at the 120 px tile size on green and red frames. Per-team colours and contrasts are in `tt11/colours.json`, and the generator is `tt11/contact-sheet-team-colours.mjs`.

## Teams that read poorly, with a proposed fix (not applied; TJ to choose)

| Team(s) | Issue | Proposed fix |
|---|---|---|
| VGK | The grey stroke `#7c8286` looks dull, not neon. | Use the gold `secondaryColor` `#b4975a` as the stroke. |
| CHI, NYI, SJS | The black `secondaryColor` becomes a grey halo. | Use `accent` for the halo: CHI gold `#CC8A00`, NYI white, SJS orange `#EA7200`. |
| MIN, VAN | Dark greens only just clear the floor; they look dim and sit close to the green rise tone. | MIN: stroke in cream `#ddcba4`. VAN: raise the floor for these two to 6:1. |
| CAR, CGY, CHI, DET, FLA, NJD, OTT, WSH-halo; DAL | Red marks merge with the red fall tile and clash on green; DAL's green does the same on green tiles. | Keep, since it's team identity and the border and hero still carry the tone. Or tint on-tone matches toward the halo colour. |
| BUF, CBJ, COL, EDM, MTL, NYR, STL, TBL, TOR, WPG, WSH | Navy-family blues sit at the floor and read dimmer than TT-7's neon; TOR, TBL, COL and STL become the same `#397cf6`. | Raise the global floor to 6:1 for a stronger glow. |

## Checks

| Check | Result |
|---|---|
| E2E full spec, :3110, deny preload, Monday/Wednesday pins asserted against v2 (two passes) | **34 passed** (33 + 1) |
| Logo assertion | Now team colour: each neon tile's `data-stroke` and `data-halo` equal `teamNeon(team)`. It no longer checks the tile tone. |
| Collision guard (stress mode and genuine) | Passed |
| Monday (9) / Wednesday (9) PNG pins | **byte-identical to v2** |
| Tuesday pins | changed by design: be551afc3ed62e7a7543dd06034883c86df74849560793cf5834393adb8b34c0, 6fd9ec6a8252b0b3f99caaeedb5412ccc292f74ec6c53630f47f4a77262c9571, df330d8612c831c189a99a81b9219e45862bc2580b88aaa06462b49c7db8c3c5, bd4cf525e93f8e337caf954a15560a45907e0090f7d1af000cd4eb4cf0e251d2 |
| Vitest (lib/socialShare + components/SocialShare) | 239/239 |
| ESLint / full `tsc --noEmit` / CSS pure | exit 0 / exit 0 / PURE OK |
| Network | denied Next.js version check only; no egress |
| Renders | `tt11/fixture` and `tt11/genuine-run2` (desktop, phone, PNG); genuine export tokens match |

## Files and sha256

| File | sha256 |
|---|---|
| `web/lib/socialShare/teamNeon.ts` | `206fac21218e8790a69d4f570a9feb384ab242464cb8a17f1eb58ff223c00c1a` |
| `web/lib/socialShare/teamNeon.test.ts` | `691c73aa51ff4bd8a42c5c1ccc16106c52cf1047b7dadd650a679540654c554b` |
| `web/components/SocialShare/SocialShare.tsx` | `3886487c78783477af46af1db301b86cd0c0248bef0299fae0e873a38b42574c` |
| `web/components/SocialShare/SocialShare.module.scss` | `0f581738bba60e21e3af52201d26e5c267d4ddd5af086885ae548206dd30a921` |
| `web/e2e/social-share.spec.ts` | `eaa6721d85775a1321e278fe7dbd5136ea145b8fa27c5293cc7d50f76bf443ef` |
| `tasks/artifacts/tuesday-trends-2026-10-26/CONTRACT.md` | `f623cfeb73e2fa8ab9f27f8d4a86af28ff576c25a9062faad9fa5da790d0e743` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-24a.log` | `485dc6a14f4f3ca2f3b262b53a0de5b2f1424993e0e5355001a09a100cd81c15` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/e2e-final-24b.log` | `645fef04ea5c02084148c4c0c3be0f90ab008bc9ddeae6224e0d8a9d64b8c2fb` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/vitest.log` | `e1868dece21b3861d1dba530f3ad8f0704343ce02bb3aa2ed1761e2fa79fa435` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/tsc.log` | `cbf7de6a7ab22aa8f3b63eed31368677222a5389d4a0bcaa112a952910051cec` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/eslint.log` | `a6b49f7a0b519016701eccb4efc2de2d77010ed919b35fdad1e3abacbe9dcfd8` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/css-pure-check.log` | `a3ee9bb03237ee0ecb1f6e4f3f06bf53fe9beac44bb0a7514301dccb2780460f` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/node-network-24.jsonl` | `600ba6a0dc8b344cc138d38a32fc54e09cfeb1d48733a9fa039d3c147a806fa0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/run/evidence-24/tuesday-cards-pinned.sha256` | `c57d4da4be814659af03214e6551ccd493db11f661c17f869477163c878645c0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/colours.json` | `0022d810e6ba441e4b5a19ba62a9645a10cc6f39a8fb5328b703f9494fa7d188` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/contact-sheet-team-colours.mjs` | `1de70d333bee68005cebe14b5dd05f9cd4d0800285cf93d8db83564891f10fd5` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/contact-sheet-team-colours.png` | `2069331c58cca0187e43765e1b2923da807a81bb6f7286924a1a6c97abef098b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-desktop-deployment.png` | `592ca197ef28e5e187f641f0e06a062cea43545183a7a119393dcef12dc2dd72` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-desktop-hot.png` | `9c508f68845ebb2793f334ad80a1fc65a0c10c86054e0f6b8410018e6e32d0e9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-desktop-movers.png` | `c526c4ae597364137b1cd152d43bbabd07a283b2965b79f0bc1d112d162af866` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-desktop-rates.png` | `3cca10186fa195fb469f3e91f9a9079f67eedb9d7edcf07a6eb24bee978525a0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-phone-deployment.png` | `50aea1210b21ea72627f77c13294769ca1a7990b50d2358ec145637d0f8b9cb0` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-phone-hot.png` | `03e183ce03cde4e296222ddc34f7b50cb7d8c0ba7370ded90b17455cddd4f050` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-phone-movers.png` | `f7d456b6735e787e6fef3e0b6382fbd9c652b2e04a74a7cda9e459c66e544e56` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-phone-rates.png` | `5210d1327a9159a7cdb754450733447861516574e96621a2a691b7ccb52b7b00` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-png-deployment.png` | `665069e0ca7b77c9abfe42eeedff99b5a2f8548342aa19b79bbd87bb33a0331b` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-png-hot.png` | `3a06537a0d6b863fdcee31196bd92f24a596639321d8afab950c5136327d5376` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-png-movers.png` | `dd43221257a36b2ed80eafa27e9a2844351d4c488e848bd6adb14367b72ea2dd` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/fixture/TT11-OFFLINE-FIXTURE-png-rates.png` | `d999ef082409cf00752539662032baa770447cd78784613429d98d15ec45bcd3` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-desktop-deployment.png` | `52c32201efdcc46f508b074ed7ae50d8a3fa83ec61ab8ffeb4122d19877167bf` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-desktop-hot.png` | `7b794c50d0da07f4fb3bd3e19e6a0b40f775389a8f520b44216a76b244b6c806` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-desktop-movers.png` | `17e231af4d885fb80b04af17398f81834ba1f2a1ac625209c6f624aab23de681` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-desktop-rates.png` | `e0a7ca3cf7d2afd3c594f9194438e52d08f7808cd22ac89ea775961cbacd04ab` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-export-tokens.json` | `c1ae74f61a08683bf41dd2c7af285c19689e48292ffedf8405f62262f80604c9` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-phone-deployment.png` | `ccb809f0af1e5ac075d9f8743aace68f3739c5beca7ef2f74424bd85f82a0d42` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-phone-hot.png` | `821c719493294f93a1c9705706ab881be81839a4d284124fdd37685f8a7d7862` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-phone-movers.png` | `23383564a173e307a443d4615e01e48a879b275edd7bb40c1404fa8c7fa0b4b6` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-phone-rates.png` | `0c4f0e6996d944f8f23bb9206269001f5a9defa75f032dec9da69ab644f9442e` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-png-deployment.png` | `cc7e1dc49cc1996c1b54b3d24724d1bfddcc7a9d9a07e04ff4ae0524af43a2d4` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-png-hot.png` | `50800a2af97039dff2e126d1ba749837d089a45c63b7550d6bb03e67b31e5b0d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-png-movers.png` | `9d2de220d9e712cf0870ce27b22413814d04f7615ad24184738a32f41bfd036d` |
| `tasks/artifacts/tuesday-trends-2026-10-26/tt11/genuine-run2/TT11-GENUINE-DATA-png-rates.png` | `844ec87ffd62dbb0fd3fc7bdfc526b33ebfd6e6fc0fafccfef3daac648762e4e` |
