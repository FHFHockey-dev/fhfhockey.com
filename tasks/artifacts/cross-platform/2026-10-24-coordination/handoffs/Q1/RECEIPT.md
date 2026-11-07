# Q1 receipt — Scout V42 rear spine (2026-10-24)

Status: **candidate saved and verified; shape NOT accepted.** No overall shape or headset acceptance is claimed. No Git writes, no Unity files, no other mech, no textures/weathering, no integration, no prod/spend. Base head per lease: `2a5092d37cb863ec92a2a4e609999cf226bfa4a5` (not touched).

## One visible issue addressed

V41 trial03's upper back reads as one wide dome; the concept back shows a central dark spine with recessed flanks. V42 recesses the rear upper-back channels (smooth injective Y-only map behind Y +0.25 m, above Z 2.8 m) and adds a seated flat spine plate with dark core using existing materials. Visible at whole-mech scale in rear (3.7% of silhouette pixels), rear three-quarter (4.4%) and side (1.8%) views. Front unchanged.

## Exact files (all in `/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| `scout_rear_spine_v42.blend` (2,706,878 B; scene `SCOUT_V42_REAR_SPINE`) | `d6a6b7012c6ec6438ea5d1827ab1c0ac360dcdeceb3abea4925b7b373b2cf149` |
| `scout_v42_rear_spine_unscaled.glb` (2,165,648 B) | `68d90270cae7dd0132d7c77c9e8624854f4238a739dd4a0e55856d5157abd17b` |
| `scout_v42_build_report.json` | `e594eac1703a20830445c2413cedaa57a9ffd39f6bda0708277e93baa3a1ee28` |
| `scout_v42_verified.json` | `c016ab607205ec4dc0f16869ee3fde68193368d0f75a53c13c862ba43ab90355` |
| `SCOUT_V42_REVIEW_PACKET.md` | `ef61fcb101dbb0ea6c8cf65adc0390435aea714dd2fb8fe8c6660c13d8e9fa62` |
| `review_v42/scout_v42_whole_mech_before_after.png` | `afdc3a58205e7cee864b2b6d50124da8fb1a85d3289f3cfeb6282dd578563725` |
| `review_v42/scout_v42_change_locator.png` | `4eb8015d4f76e5b6f23368408dd4351ec12a75e853cf433bd8c2b5fe6c601e97` |
| `review_v42/scout_v42_concept_comparison.png` | `9266ca44eb6860c38cf735d4800a24d71e11471eca6377cd5a8fa8dc402acef1` |
| `review_v42/scout_v42_oriented_overlays.png` | `12504f8b0f2d725f756c134da267f02ecc1c3651fc101b4eb84606c319c5f340` |
| `review_v42/scout_v42_upper_body_closeups.png` | `bcd268b36590db13071f84c9bb194716fcd2ba7d4786a11cd4c192f433daed98` |
| `review_v42/scout_v42_articulation_sample.png` | `58a5f46256ee5db0eeca3d3cbafef79217f89ec8464a3aec5dc1068f029d8931` |
| `review_v42/v42_camera_record.json` | `353b8877a9c98855a928c51d9a9333d78718dec67a53f3e9671ec16ef4d303a7` |
| `review_v42/v42_board_registration.json` | `3a89ed445e6cb30a4dc967bab708291998bd0f9c858dd080c253a0dc8bae3450` |
| `build_scout_v42_rear_spine.py` | `9963341f6c1cb106d86bbcc30ce5b469e0fea48a77473d48d59c32d69efbd5cb` |
| `verify_scout_v42_rear_spine.py` | `9e489b00d07fd0eac9d0cc3f6a772c20524fa7f51c068160009ae1bbd281ffee` |
| `render_scout_v42_review.py` | `f67777b66752d1eed1e253e9e53e5b229bd258327220f73f3a6ba1bb619f9fb0` |
| `build_scout_v42_review.py` | `26fc5013044b9c406e6dc8aa1e7980035a5f8d4e349992949da3f5cd3cee9511` |
| `v42_build.log` / `v42_verify.log` / `v42_render.log` | `62d74299…b999` / `0c23deba…2285` / `38ed1f5c…e9fe` |
| Diary `tasks/diaries/2026-10-24-scout-v42-q1-diary.md` | `08514779758f1567797cc7ae63801a9fa856bf970ef8e7fd5b0571e5fc0c57f8` |

Preserved, rechecked after every run: V41 trial03 blend `cecd241163048128ebe9efe70a263708878fea188039010d0d74e69f9d7f6b53`, V40 blend `1c56f5d0174b6fb5f428e0f2a10ba38ea7c3fbc3e710880072abecc6bc620983`.

Rejected and retained: `scout_rear_spine_v42_attempt1_cap_winding.blend` `2ef74682…f83a`, `scout_v42_attempt1_cap_winding_unscaled.glb` `7a90e76b…7a20` (spine-plate end caps wound inward), and verifier failure logs `v42_verify_initial_failure.log`, `_second_`, `_third_`, `_fourth_`, `_fifth_failure_cap_winding.log`.

## Check output (fresh Blender 5.2.2 process; log ends `V42_VERIFIED`)

- 1,551 retained V40/V41 objects + 15 materials exact; 0 new materials; 125 V41 meshes world-exact; pivots exact.
- 6 mapped meshes move Y-only (max 0.162 m), none in front of Y 0.25 or below Z 2.8. 2 added closed, consistently wound, outward, mirror-exact meshes (+400 tris).
- Normals: 176 inherited non-unit corners, same 10 meshes, 0 new, 0 fixed.
- 11/11 required mount contacts retained; the six V41 open mount-area contacts are still present; the only new contacts are the intended spine seats.
- 20-pose arm sweep: arm-vs-body contact sets identical between V41 and V42.
- Ankle empties 0.24 m below cross-pin centres (reproduced, not fixed).
- GLB fresh import: 127 meshes, 73,054 tris, 147 nodes, 164 primitives, 9 materials, bounds error 0. Height 4.027776 m unchanged; rear extent +0.029 m.

## Unresolved gates

Shape acceptance (TJ): rear sensor pods, back segmentation, leg stance/knee pose, roof-gun aim, forearm-gun forward reach. Rig: leg chain, ankle offset, brace tracking, overlap depth of the six mount contacts, motion clearance and physics. 176 inherited normals. Final scale (0.7944831232 proposal unapproved), collision roles/colliders, Unity/Quest validation. Rolling `SCOUT_RESUME_HANDOFF.md` not edited (outside lease); Scout/Codex to fold in `SCOUT_V42_REVIEW_PACKET.md`.


## Decision — 2026-10-24T14:53:36Z

TJ chose (wrap-up button in the Q1 session): keep the V42 rear spine as the working candidate for the next Scout shape review. This is not overall shape acceptance; every open gate above still stands. V41 trial03 and V40 stay preserved as fallbacks.
