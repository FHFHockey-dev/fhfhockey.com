# Q1 receipt — Scout V50 forearm-to-fist flow and cannon length (2026-10-24)

Status: **V50 saved and verified from V49; NOT accepted.** V49 stays TJ's working candidate until TJ decides. Earlier receipts are unedited, and V40–V49 are byte-identical. No Git, Unity, textures or scale choice. Full detail is in `SCOUT_V50_REVIEW_PACKET.md`.

## Changes

- **Fist arm:** a lofted forearm gauntlet widens the forearm's top, bottom and outer faces into the fist's cross-section at the cuff. White plates, a gunmetal strap and a black rib complete it. Fist, mount (LAT 0.17), height and hinges are unchanged.
- **Cannon arm:**
  - **Barrel stack:** +0.16 m along its own axis, in a ribbed black jacket.
  - **Muzzle:** collar, stepped brake and three gunmetal barrel tips with bores sit at the new end.
  - **Outer flare:** an outer-only gauntlet flare is added; nothing on the knee side.
- **Cannon length choice:** +0.16 m is the only probed length that is clean on both the 250-pose grid and the legacy V45-clean pose 1:X:25. Shorter lengths clip the shin guard; +0.19 m and longer hit the ankle.
  - **Attempt 1 (+0.22 m, retained):** dropped for that contact; kept in `task-3/attempt1_v50/`.
- **Mount trade-off (probed, not built):** moving the fist 8 cm inboard to the concept centre makes it fully in line with the forearm.
  - **Cost:** 3 fist-arm poses at the combined aim-down edge (2×shoulder + elbow = 20°) hit the knee, so combined aim-down on the right arm drops from 20° to 15° (−5°).
  - **Status:** not moved; asked TJ.

## Difference checklist

| Status | Items |
|---|---|
| Fixed | F2, F3, F4, F5, F7, C2, C3, C4, and now **C1** (cannon length) |
| Partial | **F1** (one longer column, still ~8 cm outboard); **F6** (sleeve bridges forearm to cuff, but from the front the fist still sits beside the forearm); **X1** (gauntlet and flare, subtle at whole-mech scale) |

**Whole-mech read:** the longer cannon reads at full scale. The fist gauntlet mostly reads in side view and close-up.

## Checks (V50_VERIFIED)

| Check | V49 | V50 |
|---|---:|---:|
| Approved-limit grid (250 poses) | 0 failing | **0 failing** |
| Legacy 20-pose pairs (V45: 93) | 107 | 113 |
| New at V45-clean poses | 0 | **0** |
| Rest contacts new / lost | — | 0 / 0 |
| Required mounts | 13/13 | 13/13 |
| Three-petal open within limits | 1/22 failing | 1/22 failing, same pose (swap rule inward ≤ 5°) |
| Export meshes / tris | 164 / 72,718 | 182 / 73,654 |
| Height | 4.013017 m | 4.013017 m |

Also checked:
- **Preserved objects:** 2,866 exact.
- **New meshes:** 65, closed and facing outward.
- **Relief plane:** respected.
- **Export:** limits in the GLB extras; no leaks.

**IoU** (legacy method; front / side / back / ¾ legacy / ¾ corrected):

| Version | Front | Side | Back | ¾ legacy | ¾ corrected |
|---|---:|---:|---:|---:|---:|
| V49 | 0.776 | 0.545 | 0.773 | 0.615 | 0.713 |
| V50 | 0.777 | **0.493** | 0.775 | 0.597 | **0.690** |

**Feet-anchored diagnostic:**

| View | V49 | V50 |
|---|---:|---:|
| Side | 0.661 | 0.654 |
| ¾ corrected | 0.624 | 0.627 |

The legacy method centres on the bounding box, and the longer cannon shifts it forward. Most of the legacy drop is that shift.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_forearm_flow_v50.blend (3,096,225 B) | 81066716fe46df3ce13f5e25e8857ac8768972247243f2a792a35406a63f7090 |
| scout_v50_forearm_flow_unscaled.glb (2,591,964 B) | bd1b5cc4ebc0fd06f7dbc968dcc37a0e4017581c4e90cf94a5ca3547a2969d3d |
| scout_v50_build_report.json | 046567d93c43ede3285edf9f3dc4f2207510ac5a6dece53e844f147b3a9aecb4 |
| scout_v50_verified.json | b8ad37be04b83d143e9b6dab2695a317b95629ad141f76eae602a68cad4823a6 |
| SCOUT_V50_REVIEW_PACKET.md | 95bd6e15b15f3ed47296e6c7f68ce8b1513399486d11881520575b44a9b67210 |
| review_v50/v50_hashes.txt (scripts, logs, boards, probes, attempt 1) | c86d3fbe63101d67d5ddc49d64ec195db8639195b50a7d0ee11f181eb8ef2df7 |

**Boards** (task-3/review_v50/):

| Board | Shows |
|---|---|
| scout_v50_fist_closeups.png | Fist, four angles, V49 vs V50, beside the references |
| scout_v50_cannon_closeups.png | Cannon, same layout |
| scout_v50_whole_mech_before_after.png | Whole mech, V49 vs V50 |
| scout_v50_difference_checklist.png | Checklist |
| scout_v50_mechanism_study.png | Three-petal study |
| scout_v50_articulation_limits.png | Arms at the approved limit edges |
| scout_v50_iou_and_limits.png | IoU and limits, including the mount trade-off |
| scout_concept_vs_v50_iou.png | Concept overlay |

**Preserved, rechecked:**

| Version | Hash |
|---|---|
| V49 blend | 4f23f596…441e |
| V49 GLB | 5de51b95…b06d |
| V48 | c6e8414e…b04c |
| V47 | 431ded43…02c1 |
| V46 | 442410dd…ca4d |
| V45 | 5cf68612…56cd |
| V44 | 7b8df201…fd80 |
| V43 | 5bd9730c…e063 |
| V42 | d6a6b701…f149 |
| V41 trial03 | cecd2411…6b53 |
| V40 | 1c56f5d0…0983 |

## Open gates

- **Shape:**
  - TJ's verdict on V50.
  - Whether to move the fist mount 8 cm inboard (−5° combined aim-down, right arm).
  - Roof gun, rear pods, claws vs boots.
- **Mechanism:** swap only with inward ≤ 5°; carousel internals and animation.
- **Rig and other:** limits are engine data; leg chain; normals; scale/collision; Unity/Quest.
- **Handoff:** the rolling handoff is not edited. No shape or headset acceptance is claimed.
