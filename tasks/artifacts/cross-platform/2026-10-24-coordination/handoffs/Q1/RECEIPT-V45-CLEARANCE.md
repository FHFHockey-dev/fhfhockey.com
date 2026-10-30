# Q1 receipt — Scout V45-clearance (2026-10-24)

Status: **V45-clearance saved and verified from V43; not accepted. No shape change; no joint limit.** V43 remains TJ's working candidate until TJ decides. V44 stays on file, not the base. No Git, Unity, textures, scale choice or integration. Earlier receipts not edited. V40–V44 byte-identical (hashes below).

## Reproduced first (V43, `diagnose_scout_v45_clearance.py`, read-only)

- **What collides:** at outward shoulder abduction (world Y: left +25°, right −25°; elbow ±20°), each arm's **ShoulderCollar** cuts into the **front-outer-top corner of its rear housing** (housing faces 17/36/39).
- **Depth and onset:** about 3 cm deep; contact starts at 19°.
- **Shoulder axes:** the local shoulder axes equal the world axes.
- **Backward swing:** shoulder X+ (backward) first touches the housing at 26°, just outside the sampled ±25°.

## Fix (smallest change: local housing relief)

- **Change:** the 6 front-outer-top bevel vertices of each rear housing (|x| > 1.0, y < 0.2, z > 3.3) move back +0.03 m in Y. Touched faces get flat normals; everything else is unchanged.
- **Why 3 cm:** probed at 0.02 / 0.03 / 0.04 / 0.06 / 0.08 / 0.10 m. 0.02 only delays onset to 29°. 0.03 is the smallest that clears abduction through a full ±40° scan.
- **Not used:** no pivot moves and no joint limit, so arm range is not reduced.

## Incidence tables (`scout_v45_verified.json`; fresh process, log ends `V45_VERIFIED`)

| 20-pose sweep (shoulder X/Y −25/−10/0/+10/+25, elbow ±20) | V43 | V45 |
|---|---:|---:|
| Shoulder / rear-housing | 2 (L Y+25, R Y−25) | **0** |
| New incidences anywhere | — | **0** |
| Elbow vs leg/knee | 7 | 7 (unchanged) |
| All arm-vs-other incidences | 95 | 93 |

| Housing-only scan ±40° (first contact) | V43 | V45 |
|---|---|---|
| Abduction (L Y+, R Y−) | 19° | none to 40° |
| Backward swing (X+) | 26° | 26° (unchanged; outside sampled range) |

Per-pose before/after lists: `review_v45/scout_v45_sweep_table.png` and the `sweep_table` in the verified JSON.

## Shape evidence, kept separate

- **Silhouette:** 0 silhouette pixels changed in front, side, back, legacy ¾, corrected ¾ and rear ¾ (`scout_v45_silhouette_check.png`).
- **Shading:** a small amount of internal shading changes (282 px in side, ≤203 elsewhere), at the relieved corner.
- **IoU:** V39-method IoU identical to V43 (0.7792 / 0.5531 / 0.7485 / 0.6306 / corrected 0.7306).
- **Housing outline:** X/Z outline unchanged and Y-min unchanged; left/right mirror within 2.5e-7 m.

## Other checks

- **Preserved:** 1,863 retained V40–V43 objects and 15 materials fingerprint-exact; 0 new materials.
- **Unchanged objects:** 131 unchanged objects within 2.4e-7 m (float32); frames within 1.2e-7.
- **Rest contacts:** 13/13 required mount contacts; no new or lost rest contacts vs V43.
- **Normals:** 176 inherited non-unit corners, unchanged; the touched housing faces are unit.
- **Export:** fresh import 127 meshes, 73,054 tris, 147 nodes, 164 primitives, 9 materials, bounds error 0. Height 4.013017 m unchanged.
- **Verifier tolerances:** two first-run failures are retained. In `v45_verify_initial_failure.log` the 1e-9 m point threshold was below float32 round-off; in `v45_verify_second_failure.log` the 1e-7 frame threshold tripped on a three-level child chain. Both thresholds were aligned to the V43/V44 verifiers (1e-6 m points, 2e-6 frames); no geometry changed between runs.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_clearance_v45.blend (2,640,376 B; scene SCOUT_V45_CLEARANCE) | 5cf68612ee80006f8a34bf6cac0a1f05132c29bbcf2a50bd0cd0e3ea661956cd |
| scout_v45_clearance_unscaled.glb (2,170,332 B) | 669e12e78a0fd5b62d2a009203a4953f462638cafb4514baeb2454e2d56f676f |
| scout_v45_build_report.json | e6ee0f2b428f1fd4695fa5356578c77d0de158ea969d2b701827ea4e02406d52 |
| scout_v45_verified.json | 86ca42d25ba3a23af1b857df30a9bda203f9212950becd1ede66654ddb6492d1 |
| review_v45/scout_v45_articulation_before_after.png | b4b92386c7ce36ec0f7fcc0007b1b8ba4e139a0dec3d33bd01e4558e4ff3b359 |
| review_v45/scout_v45_rear_abducted.png | 2c65b60e5e90bc7efb5142382051f4816928486daf6d66dfb853a3f0cc1fd118 |
| review_v45/scout_v45_sweep_table.png | 2bbd7e9ff976b7bdc55e1ee1207b61f67d61c5fe584d2e36260de0c1076f4f3e |
| review_v45/scout_v45_silhouette_check.png | adabed546c6464fd91f5f5ce29d3e9c72b75f989f4da5964b7eb76a4ab7ce4c6 |
| review_v45/v45_silhouette_check.json | 02b4fb6e24f66817c838ee6cbc1a8fccafaefc53d00bdd27fa953b4bbbfdde6e |
| review_v45/v45_camera_record.json | e087eb2b845bbdcdc82b2b8fac7e832cad889297df6359119e192a3c0f75ba07 |
| build_scout_v45_clearance.py | dad6fbc5176735090f3a378754d314e8c0fb450a78e4e2b4f9a9d6ba31bde8d8 |
| verify_scout_v45_clearance.py | a45db29fd360abc357afbed3b6ea20b65700bcc56025b94d096118e7c7bf0ad6 |
| diagnose_scout_v45_clearance.py | 665721d362a037a6765dd3cfcea1863e416653602aabf00509322dc2df889b85 |
| render_scout_v45_review.py / build_scout_v45_review.py | d68c8760…bd2a / 98c3ca79…e6a |
| logs v45_build / v45_verify / v45_render | c44320e5…9adb / 1781dacc…7af / 31ded3a1…94d0 |
| failed logs v45_verify_initial_failure / _second_failure | 984bf359…c3e / ea8d25a0…6f |

Preserved, rechecked after all runs: V43 5bd9730cb64dc39c0fb4bfc6884a55b1ee2b079bb92c0f376ebbc994b8cbe063 (GLB e0b6da73…8ed4); V44 7b8df201a956a184eb9a19f27372b0d4da9a5065b66509fcb2f562012656fd80 (GLB 48bb2347…2d4e); V42 d6a6b701…f149; V41 trial03 cecd2411…6b53; V40 1c56f5d0…0983.

## Open gates (rig, then shape)

- **Contacts still in the sweep (unchanged, outside this ticket's housing target):**
  - shoulder sensor pod vs shoulder hardware at 25° abduction, both sides;
  - torso flank vs arm at 25° adduction;
  - 7 elbow-vs-leg/knee incidences;
  - shoulder hardware seated in the armor, bearing, cabin and cheek at every pose (designed mount seats);
  - backward swing touches the housing at 26°.
  These need relief or TJ-approved joint limits.
- **Leg rig:** leg chain and the 0.24 m ankle offset; mount overlap depth; motion/physics.
- **Normals:** 176 inherited non-unit corners.
- **Scale/collision; Unity/Quest.**
- **Shape (after clearance, per TJ):** roof gun, rear pods, forearm-gun reach (V44 on file), claws vs boots.
- **Handoff:** rolling handoff not edited (outside lease).
