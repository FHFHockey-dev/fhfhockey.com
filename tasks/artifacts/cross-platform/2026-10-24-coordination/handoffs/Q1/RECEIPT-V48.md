# Q1 receipt — Scout V48 fist mount + joint limits (2026-10-24)

Status: **V48 saved and verified from V47; NOT accepted.** V47 remains TJ's working candidate until TJ decides. Resumed from CHECKPOINT-V48-IN-PROGRESS.md after re-verifying its hashes. Earlier receipts not edited. V40–V47 byte-identical. No Git, Unity, textures or scale choice.

## Changes

- **Fist width/mount:** concept width (0.34 m nominal), centred 1.20 m out. Footprint 0.60 m → 0.39 m wide; V47 0.886–1.484 m → V48 1.016–1.404 m from the midline. Concept: width 0.31–0.36 m, centre 1.09–1.16 m. Height unchanged. Same segmented detail and three-petal hinges.
- **Clearance relief:** 12 cm lower-inner chamfer on both forearms, the right wrist and the cannon receiver.
- **Joint limits (TJ pop-up "Compromise mount (Recommended)"):** shoulder pitch −20…+10°; elbow −40…+20°; 2×shoulder-down + elbow-down ≤ 20°; inward 10° when level/up, 0° when aiming down; outward 10°. Stored as glTF extras.
  - Loss vs ±25° sampling: aim-lower (shoulder) 15°, aim-up 5°, elbow-down 5°, inward 15° (25° while aiming down), outward 15°.
  - Affected: low/close and cross-body aiming.

## Incidence table

| Check | V45 | V47 | V48 |
|---|---:|---:|---:|
| Legacy 20-pose pairs | 93 | 125 | 121 |
| New at V45-clean poses | — | 0 | 0 |
| Approved-limit grid (250 poses) | n/a | n/a | **0 failing** |
| Single-joint first contact, pitch-down shoulder / elbow | 7.5° / 15° | 7.5° / 15° | 12.5° / 22.5° |
| Three-petal open within limits | — | — | 1 / 22 failing (inward 10° level) → swap rule inward ≤ 5° |

## IoU (front / side / back / ¾ legacy / ¾ corrected)

- V47: 0.749 / 0.545 / 0.754 / 0.620 / 0.711
- V48: **0.774** / 0.545 / **0.772** / 0.615 / 0.711

## Checks (V48_VERIFIED)

- **Preserved:** 2,432 retained objects exact; 174 carried exact. The relief is confined to the chamfer region.
- **New geometry:** 43 new meshes, closed and outward.
- **Contacts:** 13/13 mounts; no rest change.
- **Export:** 180 meshes, 73,262 tris; limits in GLB extras on 5 nodes; no leaks. Height 4.013017 m.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_fist_mount_v48.blend (2,849,774 B) | c6e8414e0ceb2e5f0a53c262d37d1e988f831d3f64913fa3c139ce910813b04c |
| scout_v48_fist_mount_unscaled.glb (2,569,964 B) | 8e11fd54ed96e4388db139442c480ca354e68e005b312fd12e99946d65177183 |
| scout_v48_build_report.json | 90cc5bcf65467a4daabe00401591339f0b47f0503e3263f83ba735c7bd4b1250 |
| scout_v48_verified.json | 8bcdfc1f145e00fc9596f2e98c84fbb8b16da68cec5a6fdbdfa37588f56a7f68 |
| SCOUT_V48_REVIEW_PACKET.md | 205f2b18225f3502aef9680c5ee7bdfce3e32f22b6f601b808e18900164e7cf8 |
| review_v48/v48_hashes.txt (all V48 scripts, logs, boards, probe JSONs) | bf9486cde7ab3a94800d4f58ebdb4902b1062036946ff35ee5a9c85811ffa0c0 |

Boards (task-3/review_v48/): scout_v48_whole_mech_before_after.png, scout_v48_weapons_vs_references.png, scout_v48_articulation_limits.png, scout_v48_mechanism_study.png, scout_v48_iou_and_limits.png, scout_concept_vs_v48_iou.png.

Preserved, rechecked: V47 431ded43b65e1de980b19e53819b595adbfeeb978083420282047e9c32c102c1; V46 442410dd…ca4d; V45 5cf68612…56cd; V44 7b8df201…fd80; V43 5bd9730c…e063; V42 d6a6b701…f149; V41 trial03 cecd2411…6b53; V40 1c56f5d0…0983.

## Open gates

- **Shape:** TJ on V48; fist still slightly wider and further out than the concept (clearance-bound); roof gun; rear pods; claws vs boots.
- **Mechanism:** swap only with inward ≤ 5°; carousel internals and animation.
- **Rig:** limits are data for the engine, not constraints; leg chain and ankle; physics.
- **Other:** normals; scale/collision; Unity/Quest.
- **Handoff:** rolling handoff not edited.
