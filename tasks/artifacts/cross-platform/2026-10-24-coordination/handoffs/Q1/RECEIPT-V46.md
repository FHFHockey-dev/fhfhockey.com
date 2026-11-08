# Q1 receipt — Scout V46 weapons (2026-10-24)

Status: **V46 saved and verified from V45-clearance; NOT accepted.** No textures, Unity, scale choice, integration or Git. Earlier receipts not edited. V40–V45 byte-identical.

## Arms (evidence: NCC 0.994 matches into Scout.png; TJ pop-up)

- **Mech's right (−X):** square palm hand-gun. Ref 1 = Scout.png FOREARM DETAIL; front and ¾ views place the fist on the mech's right.
- **Mech's left (+X):** automatic cannon. Ref 2 = Scout.png FRONT VIEW, mech's left. The accepted vertical stack (from the Reference Sheet LEFT side view) is kept inside the cannon housing.
- **Back view:** Scout.png's back view is mirrored, an inconsistency in the concept.
- **Decision:** removing the right arm's mirrored stack conflicted with the accepted detail, so I asked TJ by pop-up. TJ chose "Right fist, left cannon (Recommended)".

## Result

- **Closed V46:**
  - Right: wrist collar, four hinged petals and a carousel drum. Option A = three stacked knuckle barrels; the palm is mounted outboard (0.21 m).
  - Left: stepped housing around the untouched stack.
  - The right gun is archived (hidden, not exported).
- **Mechanism study:** real petal-hinge and carousel-pivot empties (exported). Options B (heavy barrel) and C (claw) are hidden and not exported. Shown open with a 4-petal lotus and with the **recommended 3-petal clamshell**, which adds no sweep contacts.
- **Clearance:**
  - Closed sweep 93 → 104, with **0 new at the 13 poses V45 keeps clean**. The 11 added are at poses V45 already fails.
  - Open 4-petal adds 3 at the clean X+25 pose (inner petal into the leg); 3-petal adds none.
- **IoU** (front / side / back / ¾ legacy / ¾ corrected):
  - V45: 0.779 / 0.553 / 0.748 / 0.631 / 0.731
  - V46: 0.751 / 0.528 / 0.754 / 0.619 / 0.711

  The fist sits higher and wider than the concept's hand. The outer-hands band improves in front and back.
- **Export:** 143 meshes, 71,762 tris, bounds error 1.2e-7, no study/archive leak. Height 4.013017 m.
- **Verification:** 2,019 retained objects exact; 13/13 mounts; no new external rest contacts.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_weapons_v46.blend (2,709,287 B) | 442410ddeace7611b2e7869073bd933109cef9b0de05764fd4edead92d08ca4d |
| scout_v46_weapons_unscaled.glb (2,171,988 B) | 418bc62e5261024b4914e4aa690173336d1ff2b7e70e29dcfa174c151cd01de3 |
| scout_v46_build_report.json | f78cdb2ee88d5bf4d64b6fead988007512774b648b5eccbacf3c3cbccaec696a |
| scout_v46_verified.json | e0b9bef07c4e9a97402398c45471a6bbb452d5550bca2341772f870f84c67b32 |
| SCOUT_V46_REVIEW_PACKET.md | e2924c8ff71547f095e255795fd5c5655ab5b488190dd79295259e97f6f862e4 |
| review_v46/scout_v46_whole_mech_before_after.png | bdb9b840672aebce6359b863496243aa9ec9e6a47e7647af8b32d5763ff2a6f9 |
| review_v46/scout_v46_weapons_vs_references.png | 7cfed7d546fa9562a9e658dee91fd6f98f993d80a7600bd3951cfb2194dadde1 |
| review_v46/scout_v46_mechanism_study.png | 1c1deed209622ab8fcee84911ad7909eff2bf41002be1cebdccb5fcf4d547303 |
| review_v46/scout_v46_iou_and_sweep.png | 1487cc5a5b247f13baa504e8f65b31d2c2abfffee30726267166bd839f33ca2d |
| review_v46/scout_concept_vs_v46_iou.png / ..._v45_iou.png | 4113f77e…00c7 / e28d2230…da62 |
| review_v46/scout_concept_iou_v39_v42_v43_v45_v46.json | 4d04e72eedc64d8227b173dfc98cf15c76ee1042182a84cef5a2b4fbc7d1f306 |
| review_v46/ref_match.json | dc7a4217313913104b7f366cd45e099592f4e006f4c43b66ed30e0091bea5d4a |
| build_scout_v46_weapons.py / verify_scout_v46_weapons.py / scout_v46_mechanism.py | bd05f6a6…1fb0 / f9ee0825…7b5b / e7263dcf…4e70 |
| render_scout_v46_review.py / render_scout_v46_three_petal.py / build_scout_v46_review.py | 9c43dc8b…f167 / 90e49990…f3f0 / 58eefd85…a3 |
| match_scout_v46_weapon_refs.py / probe_scout_v46_clearance.py / probe_scout_v46_open_variants.py | 8252cc61…c09a / b21dbc47…3c32 / 5bc04641…2929 |
| logs v46_build / v46_verify / v46_render / v46_three_petal_render / v46_open_variants | 5fb2756b…cfdecfe / 75a3971b…0437 / 01d094f5…c63e / ef0230f3…c795 / 2910593b…f895 |
| rejected attempt 1 blend / GLB / report | 367efbd7…2ec2 / ace3bba6…22b2 / 838527d1…ad4fac |
| failed/diagnostic logs: initial / second / closed-sweep regression | a5f1a0ed…c63e / d59a8ab9…75d0 / 12f61ece…92d |

Preserved, rechecked: V45 5cf68612ee80006f8a34bf6cac0a1f05132c29bbcf2a50bd0cd0e3ea661956cd (GLB 669e12e7…676f); V44 7b8df201…fd80; V43 5bd9730c…e063; V42 d6a6b701…f149; V41 trial03 cecd2411…6b53; V40 1c56f5d0…0983. Refs: tj-weapon-ref-1 3291f44a…b454, tj-weapon-ref-2 c02f02f7…b178.

## Open gates

- **Shape:** TJ on V46; fist height/size vs concept (IoU −0.02 to −0.03); roof gun; rear pods; claws vs boots.
- **Mechanism:** 3-petal vs lotus; carousel internals and animation; no final rig.
- **Rig:** joint limits at X+10 and left Y+10/+25; sensor pod / flank / X+26 housing contacts; leg chain and ankle; physics.
- **Other:** normals (132 exported); scale/collision; Unity/Quest.
- **Handoff:** rolling handoff not edited.
