# Q1 receipt — Scout V49 gun-hand refinement (2026-10-24)

Status: **V49 saved and verified from V48; NOT accepted.** V48 stays TJ's working candidate until TJ decides. Earlier receipts are not edited, and V40–V48 are byte-identical. No Git, Unity, textures or scale choice.

## Changes (detail: SCOUT_V49_REVIEW_PACKET.md)

- **Fist / hand-gun (mech's right).** Rebuilt inside V48's footprint (x 1.016–1.399 m, previously 1.016–1.404) at the same mount and height.
  - **Wrist:** heavy chamfered cuff with a 0.20 m round port.
  - **Plates:** layered, tapering white plates over chamfered blue bases.
  - **Fingers:** three, each a knuckle block, a front segment and a curled tip.
  - **Hand-gun:** barrel housing and bore in the outer knuckle slot.
  - **Mechanism:** three-petal hinges rebuilt.
- **Automatic cannon (mech's left).**
  - **Body:** receiver, two shrouds, a collar and a stepped black muzzle brake.
  - **Layering:** white receiver cover, blue side armour, top rail and feed chute.
  - **Barrel stack:** the brake stops short of the carried V40 barrel tips, so the stack stays visible and V48's reach (s = 0.609 m) is unchanged.
- **Retained attempt 1:** its brake ran to s = 0.635 (3 cm longer than V48) and hid the bores. Kept unedited in `task-3/attempt1_v49/`.
- **Relief:** V48's lower-inner relief plane is enforced on all new weapon meshes.

## Difference checklist

| Status | Items |
|---|---|
| Fixed | F2 plates, F3 knuckles/fingers, F4 wrist cuff and port, F5 hand-gun barrel, F7 chamfers, C2 brake and visible bores, C3 cover/rail layering, C4 chamfers |
| Partial | F1 fist proportion (still outboard of the forearm); C1 cannon is stepped but not lengthened |
| Remaining | F6 forearm-to-fist transition (compromise mount); X1 forearm armour flow |

**Whole-mech read:** the fist change reads at full scale. The cannon change is mainly visible in close-up.

## Checks (V49_VERIFIED)

| Check | V48 | V49 |
|---|---:|---:|
| Approved-limit grid (250 poses) | 0 failing | **0 failing** |
| Legacy 20-pose pairs (V45: 93) | 121 | **107** |
| New at V45-clean poses | 0 | 0 |
| Rest contacts new / lost vs V48 | — | 0 / 0 |
| Required mounts | 13/13 | 13/13 |
| Three-petal open within limits | 1/22 | 1/22, same inward-10° pose; swap rule inward ≤ 5° stands |
| Export meshes / tris | 180 / 73,262 | 164 / 72,718; limits in GLB extras on 5 nodes; no leaks |
| Height | 4.013017 m | 4.013017 m |

- **Preserved:** 2,657 retained objects exact; 154 carried from V48 exact.
- **New geometry:** 47 new meshes, closed and facing outward.

**IoU** (front / side / back / ¾ legacy / ¾ corrected):

| Version | Front | Side | Back | ¾ legacy | ¾ corrected |
|---|---:|---:|---:|---:|---:|
| V48 | 0.774 | 0.545 | 0.772 | 0.615 | 0.711 |
| V49 | 0.776 | 0.545 | 0.773 | 0.615 | 0.713 |

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_gun_hands_v49.blend (2,974,776 B) | 4f23f596c7c2bc39f854ae9d18a31909c8ca18e1b3398727be2592778e7c441e |
| scout_v49_gun_hands_unscaled.glb (2,531,728 B) | 5de51b955cda759d9b230fdef70ffd109f123bb76e21c79b0e88c0be579ab06d |
| scout_v49_build_report.json | 9395288690d34869ca27217c9f80d698af8f3c420513d0660cb01460e0dc709f |
| scout_v49_verified.json | 1b3019bc3cf3357fc97863db2de1b7745397e2651d15f6da63b0976ea5a5163e |
| SCOUT_V49_REVIEW_PACKET.md | 8f8ee96f9dddd1ba429ef5b1fd6c1e74e0c74b224563223a3de5a3381792144c |
| review_v49/v49_hashes.txt (V49 scripts, logs, boards, JSONs, attempt 1) | e69428a09e1f8b75e0f3df93946ca729de1519db8ba5b7e5f67f86551bd78e09 |

**Boards** (task-3/review_v49/):
- scout_v49_fist_closeups.png and scout_v49_cannon_closeups.png: four angles each, V48 vs V49, beside the reference crop and Scout.png.
- scout_v49_whole_mech_before_after.png
- scout_v49_difference_checklist.png
- scout_v49_mechanism_study.png
- scout_v49_articulation_limits.png
- scout_v49_iou_and_limits.png
- scout_concept_vs_v49_iou.png

**Preserved, rechecked:**
- V48 c6e8414e…b04c (GLB 8e11fd54…7183)
- V47 431ded43…02c1
- V46 442410dd…ca4d
- V45 5cf68612…56cd
- V44 7b8df201…fd80
- V43 5bd9730c…e063
- V42 d6a6b701…f149
- V41 trial03 cecd2411…6b53
- V40 1c56f5d0…0983

## Open gates

- **Shape:**
  - TJ's verdict on V49.
  - F6/X1: the forearm-to-fist flow is bound by the knee-clearance mount.
  - C1: cannon length.
  - Also open: roof gun, rear pods, claws vs boots.
- **Mechanism:** swap only with inward ≤ 5°; carousel internals and animation are still to do.
- **Rig and other:** limits are engine data, not constraints. Also open: the leg chain, normals, scale/collision and Unity/Quest.
- **Handoff:** the rolling handoff is not edited. There is no shape or headset acceptance claim.
