# Q1 receipt — Scout V47 weapon detail (2026-10-24)

Status: **V47 saved and verified from V46; NOT accepted.** V46 remains TJ's working candidate until TJ decides. No textures, Unity, scale choice, integration or Git. Earlier receipts not edited (the keep-V46 instruction is in RECEIPT-V46-KEEP-REFINE.md). V40–V46 byte-identical.

## Fist height

Matched-view measurement (front, Reference Sheet front, ¾) shows V46's fist bottom at 67–70% of height vs the concept's 62–65%: already as low or lower. **My V46 "fist sits higher" note was wrong; corrected here.** TJ chose by pop-up: keep height, refine detail. Lowering did not happen, so no lowering-related incidences and no "stopped short" amount. Evidence: review_v47/fist_height_grid.png.

## Change

- **Fist:** segmented armour plates with panel breaks, a two-band wrist, an outer port, a framed recessed barrel (carousel option A), and four two-segment fingers on the opening bottom petal.
- **Cannon:** layered receiver (cover and side plates), outboard feed chute with belt links, ribbed and vented steps, muzzle fins. The accepted vertical stack is untouched.
- **Study:** the three-petal study is rebuilt to match the new fist (hidden, not exported).

## Checks (V47_VERIFIED)

- **Preserved:** 2,207 retained objects exact; 159 carried objects exact.
- **New geometry:** 63 new meshes, closed and outward.
- **Contacts:** 13/13 mounts; no arm-vs-body rest change.
- **Closed sweep:** 0 new at the 13 V45-clean poses. Pairs 93 / 104 / 125 (V45 / V46 / V47); the extra pairs are at already-failing poses, more pairs from segmentation.
- **Three-petal open:** adds nothing.
- **Export:** 180 meshes, 73,262 tris, no leaks. Height 4.013017 m.

| IoU | Front | Side | Back | ¾ legacy | ¾ corrected |
|---|---:|---:|---:|---:|---:|
| V39 | 0.781 | 0.626 | 0.761 | 0.623 | n/a |
| V45 | 0.779 | 0.553 | 0.748 | 0.631 | 0.731 |
| V46 | 0.751 | 0.528 | 0.754 | 0.619 | 0.711 |
| V47 | 0.749 | 0.545 | 0.754 | 0.620 | 0.711 |

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_weapon_detail_v47.blend (2,900,069 B) | 431ded43b65e1de980b19e53819b595adbfeeb978083420282047e9c32c102c1 |
| scout_v47_weapon_detail_unscaled.glb (2,279,764 B) | f6bb6cef5d8845196bd776783b741340c8ac4aa01bbf4ca0ff3ba0ccdca741cf |
| scout_v47_build_report.json | ddb78bae474949f779a3e83e92d5915e5c584b1e0779599d60a3e922e1664578 |
| scout_v47_verified.json | 610d4bc19a622ffb52d78e4a72cc150cccd195490d0621d7faff1813167763b2 |
| SCOUT_V47_REVIEW_PACKET.md | 2b904b124cbcf7621443aecffe61376db5866394c20841699d0686094037338d |
| review_v47/scout_v47_whole_mech_before_after.png | 2d60f177bd56144715cacc78f96d8949231e1a6d3cc41d12226881fce7e181aa |
| review_v47/scout_v47_weapons_vs_references.png | 854f132813ef838771634a3cc98d8c01a73b7fc4e0b5a02725ab94ca753774ba |
| review_v47/scout_v47_mechanism_study.png | 9bae01a307ba7491f4e37f5b757f15106adb8feac6a1095743b41e67d0b0e541 |
| review_v47/scout_v47_iou_and_sweep.png | 66d6a551516e3bf3718d4cae3d3e18b24ecd312aa51946a6d6b78b9835b6ba30 |
| review_v47/fist_height_grid.png / fist_height.json | ef5495c6…13d7 / 7944117f…5e99 |
| review_v47/scout_concept_vs_v47_iou.png / scout_concept_iou_v39_v42_v43_v45_v46_v47.json | e26a36eb…f1 / a89ec2e0…36 |
| build_scout_v47_weapon_detail.py / verify_scout_v47_weapon_detail.py / scout_v47_mechanism.py | 218052b8…ec81 / 0c83605d…cd34 / de5f4375…bf80 |
| render_scout_v47_review.py / build_scout_v47_review.py / build_scout_v47_iou_boards.py / measure_scout_v47_fist_height.py | df09424d…2d31 / 9d87cc53…d972 / 49d9ed1c…4ea7 / aa1cf65b…9ca2 |
| logs v47_build / v47_verify / v47_render | e9fddf5c…599a / 3145f14e…4b5a / d3a653e9…8a4e |

Preserved, rechecked: V46 442410ddeace7611b2e7869073bd933109cef9b0de05764fd4edead92d08ca4d (GLB 418bc62e…1de3); V45 5cf68612…56cd; V44 7b8df201…fd80; V43 5bd9730c…e063; V42 d6a6b701…f149; V41 trial03 cecd2411…6b53; V40 1c56f5d0…0983.

## Open gates

- **Shape:** TJ on V47; fist width/outboard mount; roof gun; rear pods; claws vs boots.
- **Mechanism:** carousel internals, locking and animation.
- **Rig:** joint limits at X+10 and left Y+10/+25; other sweep contacts; leg chain and ankle; physics.
- **Other:** normals; scale/collision; Unity/Quest.
- **Handoff:** rolling handoff not edited.
