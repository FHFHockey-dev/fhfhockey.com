# Q1 receipt — Scout V52: hip and calf armour integration (2026-10-24)

Status: **V52 saved and verified from V51; NOT accepted.** V51 remains TJ's working candidate until TJ decides. Earlier receipts are unedited, and V40–V51 are byte-identical. No Git, Unity, textures or scale choice. Detail is in `SCOUT_V52_REVIEW_PACKET.md`.

## The circled objects

TJ's mark-up is `references/tj-v51-floating-plates-marked.webp` (8991b435…0617). I confirmed the objects with a ray-cast object-ID pass from the same right-side camera. The same parts exist on both legs.

| Circle | Object | Measured |
|---|---|---|
| 1 | `V32R_Pelvis_Rear` (slab) | Touches only the backpack; 0.052 m from the hip axle, 0.10 m from the waist |
| 1 | `V4_Leg_±1_HipAxle` (bare gunmetal half-disc) | Rear-upper half exposed |
| 2 | `V31R_Leg_±1_Calf` (pentagon plate) | Joined only to the buried seated-shin core; 0.008 m from the upper-shin side; dark notch to the knee hub |
| 2 | `V24R_Leg_±1_ShinGuard` (lone 0.10 m block) | — |

## Change (18 new meshes, 9 per leg)

**Hip (circle 1)**
- **Bearing housing:** wraps the hip axle's rear-upper half, with a white cheek cap.
- **Bridge:** seats the housing into the pelvis-rear slab.
- **Hub cap:** a flush cap over the axle face (radius 0.172 m, protruding 6 mm), concentric with the hip axle.

**Calf / knee (circle 2)**
- **Rear housing:** a knee/calf housing sector filling the notch behind the knee.
- **Calf seat:** joins the calf plate to the shin core.
- **Shin side plate:** a larger plate with a white inset; it absorbs the shin-guard block and reaches the calf.

The verifier requires every new mesh to overlap its host armour and lists the hosts, so all 18 are seated. Rig, knee and ankle pivots, V51 boots and claws, weapons and stored limits are all carried exactly.

**Dropped on the way** (logs in `probe_v52/`):
- **Attempt A:** cut knee flexion from 22.5° to 12.5°, and its flange touched the shoulder pivot.
- **Large hub cap:** touched the elbow in 7 inward-swing poses per arm.
- **Full knee drum:** added cannon contacts at legacy poses outside the limits.

The final form has none of these.

## Leg travel (geometric; the leg chain is not rigged)

The thigh rotates about the hip axle and the lower leg about the knee axle. The table gives the first new contact, ignoring contacts present at rest.

| Joint | V51 | V52 |
|---|---|---|
| Hip | +45° clear / −10° | **identical** |
| Knee | flexion 22.5° (calf vs thigh, existing) / −45° clear | **identical** |

**Caveat:** the knee housing touches the thigh at rest, as V51's seated shin already does. Those rest contacts are excluded from the travel count.

## Checks (V52_VERIFIED)

| Check | V51 | V52 |
|---|---:|---:|
| Approved-limit grid (250 poses) | 0 failing | **0 failing** |
| Legacy 20-pose pairs (V45: 93) | 113 | 113 |
| New at V45-clean poses | 0 | **0** |
| Rest contacts new / lost | — | 0 / 0 |
| Required mounts | 13/13 | 13/13 |
| Three-petal open within limits | 1/22 | 1/22 (same pose) |
| Export meshes / tris | 214 / 75,062 | 232 / 77,310; limits in extras; no leaks |
| Height | 4.013017 m | 4.013017 m |

- **Retained objects:** 3,352 exact.
- **Carried exported meshes:** exact to 6.0e-7 m.
- **Hidden, unexported mechanism-study meshes:** now have their own 1e-5 m tolerance, because float32 noise reached 2.1e-6 m over carried versions. The failed log is kept.

**IoU** (front / side / back / ¾ legacy / ¾ corrected):

| Version | Front | Side | Back | ¾ legacy | ¾ corrected |
|---|---:|---:|---:|---:|---:|
| V51 | 0.786 | 0.512 | 0.780 | 0.603 | 0.698 |
| V52 | 0.785 | 0.516 | 0.778 | 0.602 | 0.696 |

Feet-anchored side goes 0.657 → 0.666 and ¾ corrected 0.657 → 0.661. The silhouette is kept.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_leg_armour_v52.blend (3,001,807 B) | b365528d540ba5723ca4df0b1f918d7399dbaa39bd95df58b5430ead0dd81bfd |
| scout_v52_leg_armour_unscaled.glb (2,816,620 B) | 8b02a8bbe670e693955f0b66157d52661d03c080a39f524c5ddc30de90b8aab9 |
| scout_v52_build_report.json | 97807a84df919e73ed2ae3eec8950eaa30fa840c3419bad510b40df1c9dc7fa3 |
| scout_v52_verified.json | 7384b134905de61f3a05ef41c1933888849936ecbf3eb54e22e468538e5dbcc5 |
| SCOUT_V52_REVIEW_PACKET.md | 47c72badde62e42d3877406e2425d0c60103ea42649a79e94896cd768af7e843 |
| review_v52/v52_hashes.txt (scripts, logs incl. failed run, boards, probes, TJ mark-up) | f39ff74975ee353cd089424f9a7da1e96c5921cd50b9a227411f39510a556398 |

**Boards** (task-3/review_v52/):
- scout_v52_circled_areas_before_after.png: TJ's marked view beside the matched right side and rear-¾, both sides.
- scout_v52_closeups.png: both circles on both legs.
- scout_v52_whole_mech_before_after.png
- scout_v52_seating_travel_iou.png
- scout_concept_vs_v52_iou.png

**Preserved, rechecked:**

| Version | Hash |
|---|---|
| V51 blend | 2995bc40…9082 |
| V51 GLB | 884c617f…475d |
| V50 | 81066716…7090 |
| V49 | 4f23f596…441e |
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
  - TJ's verdict on V52.
  - Roof gun (~18k px).
  - Rear pods and shoulder tops (~21k px; V41 shoulders).
- **Rig:**
  - The leg chain is unrigged.
  - Hip and knee travel are geometric only.
  - The knee housing and seated shin interpenetrate the thigh at rest.
- **Other:** normals, scale and collision, Unity/Quest.
- **Not done:** the rolling handoff is not edited, and there is no shape or headset acceptance.
