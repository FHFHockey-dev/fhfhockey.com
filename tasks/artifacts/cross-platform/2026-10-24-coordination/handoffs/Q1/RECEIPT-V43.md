# Q1 receipt — Scout V43 hip lean (2026-10-24)

Status: **V43 candidate saved and verified; NOT accepted.** V42 remains TJ's working candidate until TJ decides. No Git writes, no Unity, no other mech, no textures, no scale choice, no integration. First receipt (RECEIPT.md, V42) not edited.

## IoU (legacy V39 method, reproduced exactly on V39 renders)

| | Front | Side | Back | ¾ legacy | ¾ corrected |
|---|---:|---:|---:|---:|---:|
| V39 | 0.781 | 0.626 | 0.761 | 0.623 | n/a |
| V42 | 0.776 | 0.623 | 0.751 | 0.649 | 0.732 |
| V43 | 0.779 | 0.553 | 0.748 | 0.631 | 0.731 |

Side, feet-anchored (diagnostic only): V42 0.655 (torso band 0.726) → V43 0.679 (torso band 0.861). The legacy side drop comes from bbox centring following the forward-moving forearm guns; it slides the fixed legs out of register.

## Change

The largest unprotected gap: V42's upper body sat about 0.17 m behind the concept relative to the legs in side view (feet are protected claws; knee band already close). V43 pitches the upper body 7° forward about the existing hip-axle axis. Legs, claws, hulls and leg rig are exact. Arms and vertical guns translate only. The canopy is rigid, but its world pitch changes by 7°. Height 4.027776 → 4.013017 m. Rejected unsaved trials: arm abduction (front IoU fell), roof-gun elevation (all views fell; height +0.18–0.32 m), plus the 4° and 10° leans.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_hip_lean_v43.blend (2,804,713 B) | 5bd9730cb64dc39c0fb4bfc6884a55b1ee2b079bb92c0f376ebbc994b8cbe063 |
| scout_v43_hip_lean_unscaled.glb (2,169,352 B) | e0b6da73a707b136e16636556c13e52f0fa18eb70b1d618244110313eced8ed4 |
| scout_v43_build_report.json | fb73b7620f0ae6ece820892eb74ddd7f95651a0b0f5c849600f72abdbeb8a9c0 |
| scout_v43_verified.json | 60cc427ba09d49965c15fa9bc162b55fb4879f35dcf13a32fac1e8263c8a6339 |
| SCOUT_V43_REVIEW_PACKET.md | c7182db16cf668b7cf6c6b6260001c38578b2f9535f13f6663010ead3a9ed6b4 |
| review_v43/scout_concept_vs_v39_iou.png | a4f45a50dd4923e00b1d7d9943a44e759a1dc45044f7d39b24974c90982e9629 |
| review_v43/scout_concept_vs_v42_iou.png | 3cafb98ba9406754cfc3be90084fe73b91682409b7d99dfa112398c6e2935915 |
| review_v43/scout_concept_vs_v43_iou.png | fca5ba69664eadb9f0776564e2930b4a830f018f4388a8a3ef987e7a6bd46508 |
| review_v43/scout_v43_side_registration.png | d9e5cbb1fc5d52aaf4e08271d2add1f19acdc046462a95bab47e2f141e1657df |
| review_v43/scout_v43_whole_mech_before_after.png | d95a67832c8163fb56c025d6ec65a1eaab9226a7a849a59920fa8fa63d27b162 |
| review_v43/scout_v43_articulation_sample.png | 9870cc9e8606f8dbab97726f8c5a92bde37a2eaa6ea7e5f07b0a3d512fa74f4d |
| review_v43/scout_concept_iou_v39_v42_v43.json | 8edb755fcbe56c495ab73bcc632fbc55ec01f7c667fd81329299da999e7cd635 |
| review_v43/v43_side_registration.json | 056f8e6fa2472fbf9272379429295f690899446b3be2e8fd0f9e4771bdaaaaa7 |
| build_scout_v43_hip_lean.py | 2bd59ae16f4700c17e544781f545239b311a0ed037daa098ac819fb9b2bbb21c |
| verify_scout_v43_hip_lean.py | a8d976a0c13005a94db8a33c099d1ddde42381636fe0eb1f2365380a7a22963d |
| build_scout_v43_iou_boards.py | d2f1e3ea49b9f91fb3745ada7ef5b110c6f7a0fb4395c9a04cfaddf2dd3ba1d9 |
| render_scout_v43_iou_views.py | 4eec3ba25d503c328f6c9e46ca097fd300aa34c7f2bce13472d618c806342b09 |
| render_scout_v43_review.py / build_scout_v43_review.py | 9dfdd575…27ab / 676d92c1…ce70 |
| rejected-trial scripts: build_scout_v43_arm_carriage.py / build_scout_v43_roof_gun_aim.py | 0fb8112f…2349 / 2f528b99…79b3 |
| logs v43_build / v43_verify / v43_render / v43_iou_render | 8e7c6f27…c4b / 3e5dc881…db7dd / 155520fd…772f / b3811865…e4b6 |

Preserved, rechecked after all runs: V42 d6a6b7012c6ec6438ea5d1827ab1c0ac360dcdeceb3abea4925b7b373b2cf149, V41 trial03 cecd241163048128ebe9efe70a263708878fea188039010d0d74e69f9d7f6b53, V40 1c56f5d0174b6fb5f428e0f2a10ba38ea7c3fbc3e710880072abecc6bc620983. References: Scout.png 8edaf9fe…df53, Reference Sheet 7db4dfb6…b464, Blueprint 75f6e2ea…9e1c81, V39 sheet 36c2015d…515d.

## Checks (V43_VERIFIED, fresh Blender 5.2.2 process)

- **Proportion:** 1,707 retained objects and 15 materials exact; 0 mesh data changes. Classes verified: 72 fixed leg (error 0), 66 leaned body (≤1.1e-7), 14 arm translated (≤2.4e-7). Canopy rigid; gun orientation exact.
- **Rig/mounts:** waist/hip-axle interface identical. 13/13 required contacts present; six V41 open contacts present. No new or lost rest contacts. Arm sweep (20 poses): 11 V42 arm-leg/housing incidences gone, 2 shoulder/housing incidences at mirror 25° Y poses. Ankle offset still 0.24 m.
- **Normals:** 176 inherited non-unit corners, unchanged.
- **Export:** 127 meshes, 73,054 tris, bounds error 0.

## Open gates

TJ: keep the V43 lean (canopy world pitch +7°) or stay on V42. Forearm-gun reach, roof-gun aim, rear sensor pods, claws vs boots. Leg chain and ankle offset, mount overlap depth, motion/physics. Inherited normals. Scale/collision (height now 4.013017 m). Unity/Quest validation. Rolling handoff not edited.
