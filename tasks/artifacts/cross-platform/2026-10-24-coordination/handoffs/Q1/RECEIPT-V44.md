# Q1 receipt — Scout V44 arm retraction (2026-10-24)

Status: **V44 candidate saved and verified; NOT accepted.** V43 remains TJ's working candidate until TJ decides. No Git writes, no Unity, no other mech, no textures, no scale choice, no integration. Earlier receipts (RECEIPT.md, RECEIPT-V43.md, RECEIPT-V43-DECISION.md) not edited.

## Gate ranking (V43, residual px)

1. Claws vs boots ≈25.3k (protected).
2. Roof gun ≈12.1k (trialled; no clean gain).
3. Rear sensor pods ≈11.1k (conflicts with V41 accepted shoulders/housings).
4. Forearm-gun reach ≈6.6k (fixed here).

## Change

Upper arms pitched 11° back at the shoulders with elbow counter-rotation. Forearms and vertical guns translate 0.172 m back, orientation exact. This undoes the 0.129 m forward carry from V43's lean, plus about 0.04 m. Nothing else moved.

## IoU (legacy V39 method; same cameras; no mirroring)

| | Front | Side | Back | ¾ legacy | ¾ corrected |
|---|---:|---:|---:|---:|---:|
| V39 | 0.781 | 0.626 | 0.761 | 0.623 | n/a |
| V42 | 0.776 | 0.623 | 0.751 | 0.649 | 0.732 |
| V43 | 0.779 | 0.553 | 0.748 | 0.631 | 0.731 |
| V44 | 0.779 | 0.599 | 0.749 | 0.656 | 0.754 |

Feet-anchored side (diagnostic): V43 0.679 → V44 0.699.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_arm_retract_v44.blend (2,722,300 B) | 7b8df201a956a184eb9a19f27372b0d4da9a5065b66509fcb2f562012656fd80 |
| scout_v44_arm_retract_unscaled.glb (2,169,496 B) | 48bb23477a474ac0957c795375b6b8f6aaa5268befd1c4c61e53d0ee5d942d4e |
| scout_v44_build_report.json | 5639c2bba1a6de7ba7bfe6573a2c0328fde5ebc981659608dacf74b9ffb32223 |
| scout_v44_verified.json | aac8d126661713261de99abfbb4b83ad4ff96bba58f1ca89814a11a7818a6395 |
| SCOUT_V44_REVIEW_PACKET.md | c3a9db1025561284332ad3d2dc6caffefab9daef074decc77f676155e181ac42 |
| review_v44/scout_v44_whole_mech_before_after.png | 23ea0b4f7890e6ca122dd937c1ab43ab811b8dfefd50995c25810835e4d4b559 |
| review_v44/scout_v44_side_registration.png | d4e355fda4acfa7fe6422164355da17aeff855afb64b3fee7d6289934e53df6b |
| review_v44/scout_concept_vs_v43_iou.png | bf4860d5aa386aaafc219d2e9104a89ebfc829df2c0c34b3f4e9ab268e9f75de |
| review_v44/scout_concept_vs_v44_iou.png | 5ae8616dbe092372a6939a951878f2225021f47643b2cc0b3d701e5d9104e82d |
| review_v44/scout_v44_articulation_sample.png | 1c4765b88781dc030192b6d14fb427825be36fd33e7151aa0fdb57644443b49d |
| review_v44/scout_concept_iou_v39_v42_v43_v44.json | cdedba2746f61b10e37740e28301e379f03a6e1d644b5f2a30f35dfc208211ec |
| review_v44/v44_side_registration.json | 7fcd68ce2d24bcaafe3dc67968d400abbce00140566bfc8d21d3be4eb22ec57b |
| review_v44/v43_gate_ranking_before.json / v44_gate_ranking.json | d7934478…908f / 31a040c0…e4d |
| build_scout_v44_arm_retract.py | 07df59f4f7145455cb0ffb356b2e61c5ae5a270f7be2f21bb3647400e928524e |
| verify_scout_v44_arm_retract.py | ec749b8eab70408df9d17377266d4b98839827097037318937335de6f2e5b715 |
| rank_scout_v44_gates.py | a00cad397baf456931829ec8776a9608f51b740a1a11ae6454c3ae94b037d424 |
| build_scout_v44_iou_boards.py / build_scout_v44_review.py | 088f1ac8…e47e2 / aca62fd2…d8ff |
| render_scout_v44_iou_views.py / render_scout_v44_review.py | 77b06b52…faf9 / 2295e741…d7da |
| rejected-trial script build_scout_v44_roof_gun.py | 6bffdd42…34c2 |
| logs v44_build / v44_verify / v44_render / v44_iou_render | 31ef7a88…ad71 / a492079f…7635 / 5b07dabc…87ea5fc / 15c289ed…5505 |

Preserved, rechecked after all runs: V43 blend 5bd9730cb64dc39c0fb4bfc6884a55b1ee2b079bb92c0f376ebbc994b8cbe063 (GLB e0b6da73…8ed4), V42 d6a6b7012c6ec6438ea5d1827ab1c0ac360dcdeceb3abea4925b7b373b2cf149, V41 trial03 cecd241163048128ebe9efe70a263708878fea188039010d0d74e69f9d7f6b53, V40 1c56f5d0174b6fb5f428e0f2a10ba38ea7c3fbc3e710880072abecc6bc620983. SCOUT_V43_REVIEW_PACKET.md now f9aaa602…c470 (Decision appended; recorded in RECEIPT-V43-DECISION.md).

## Checks (V44_VERIFIED, fresh Blender 5.2.2 process)

- **Proportion:** 1,863 retained objects and 15 materials exact; 0 mesh data changes. 139 unchanged, 4 upper-arm rotated, 10 forearm translated, all within 4.8e-7. Gun orientation exact.
- **Rig/mounts:** 13/13 required contacts present; six V41 open contacts present; no new or lost rest contacts.
- **Shoulder/housing incidences:** the 2 V43 incidences are removed; 4 different ones appear at other 25° samples. 9 elbow-vs-leg incidences return at ±10–25° Y samples. Sampled poses only.
- **Unchanged:** ankle offset 0.24 m; 176 inherited non-unit normals.
- **Export:** 127 meshes, 73,054 tris, bounds error 0. Height 4.013017 m unchanged.

## Open gates

TJ: keep V44 or stay on V43. Roof gun (needs a mount redesign or TJ's preferred aim). Rear pods (TJ, conflicts with V41). Joint limits or housing clearance for the 25° shoulder samples. Leg chain and ankle. Normals. Scale/collision. Unity/Quest. Rolling handoff not edited.
