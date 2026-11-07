# Q1 receipt — Scout V51 boot shells around the protected claws (2026-10-24)

Status: **V51 saved and verified from V50; NOT accepted.** V50 remains TJ's working candidate until TJ decides. Earlier receipts are unedited, and V40–V50 are byte-identical. No Git, Unity, textures or scale choice. Detail: `SCOUT_V51_REVIEW_PACKET.md`.

## Gap ranking (V50, matched unmirrored silhouettes; legacy / feet-anchored residual px)

| Rank | Region | Legacy px | Feet-anchored px | Note |
|---:|---|---:|---:|---|
| 1 | Arms / weapons | 53.8k | 71.2k | Model-only width from accepted parts |
| 2 | **Feet: claws vs boots** | **39.1k** | **37.7k** | Mostly missing concept boot mass |
| 3 | Legs | 40.8k | 34.9k | Model-only width, known |
| 4 | Rear pods / shoulder tops | 21.7k | 15.8k | Mostly our shoulders; conflicts with the accepted V41 shoulders |
| 5 | Roof gun | 18.4k | 19.5k | Unprotected |

The largest named gap was the feet, which are protected, so I asked TJ by pop-up first. TJ chose **"Boot shells, claws kept (Recommended)"** over "Keep claws, do roof gun" and "Full boots replace claws".

## Change

Each foot gets boot shells (32 new meshes in total):
- **Foot block:** a chunky foot block on a sole band.
- **Heel:** heel with a white plate.
- **Ankle guards:** set behind the leg-brace sockets.
- **Instep:** raised instep.
- **Toes:** three segmented toe blocks with white faces that follow the front claw.

The three claws, hinges and ankle are carried exactly. The claws remain the ground contact: shells sit at z ≥ 0.030 m, the claws at 0.002 m.

Everything V50 kept is carried exactly:
- cockpit, V42 spine, V43 lean, V45 clearance;
- V47–V50 weapons and gauntlets;
- the V48 mount and the stored joint limits.

## Checks (V51_VERIFIED)

| Check | V50 | V51 |
|---|---:|---:|
| Approved-limit grid (250 poses) | 0 failing | **0 failing** |
| Legacy 20-pose pairs (V45: 93) | 113 | 113 |
| New at V45-clean poses | 0 | **0** |
| Rest contacts new / lost | — | 0 / 0 |
| Required mounts | 13/13 | 13/13 |
| Three-petal open within limits | 1/22 | 1/22 (same pose) |
| Export meshes / tris | 182 / 73,654 | 214 / 75,062; limits in extras; no leaks |
| Height | 4.013017 m | 4.013017 m |

- **Preserved:** 3,093 retained objects exact; 224 carried from V50 exact.
- **New geometry:** 32 new meshes, closed and facing outward.
- **Tolerance:** the point tolerance is now 2e-6 m. Float32 noise reached 1.43e-6 m on a hidden, unexported, rotated study mesh; the failed log is kept.

**IoU** (front / side / back / ¾ legacy / ¾ corrected):
- **V50:** 0.777 / 0.492 / 0.775 / 0.597 / 0.690
- **V51:** **0.786 / 0.512 / 0.780 / 0.603 / 0.698**

**Feet-anchored IoU:**

| View | V50 | V51 |
|---|---:|---:|
| Side | 0.654 | 0.657 |
| ¾ corrected | 0.627 | 0.657 |

**Feet residual:**

| Registration | V50 | V51 | Change |
|---|---:|---:|---:|
| Legacy | 39.1k | 33.3k | −15% |
| Feet-anchored | 37.7k | 26.1k | −31% |

The boots read at whole-mech scale in the front, side and ¾ views.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_boot_shells_v51.blend (2,898,819 B) | 2995bc40357e273dc7038e838b3a020af6806197033a3bc09c7096d7fff19082 |
| scout_v51_boot_shells_unscaled.glb (2,687,392 B) | 884c617f59dc68398efc0bbb06ec2558016734b2ba82ae36f6dd689a6c8e475d |
| scout_v51_build_report.json | 69a37c4ebabe02d4bd81c8eb6f09d57a56c3d954fb065c58e121a01feb73e2b6 |
| scout_v51_verified.json | 85bf2bb57060422305eeb5f9350aea0d90dd55df3e1860332d8fa8ca3bad4e73 |
| SCOUT_V51_REVIEW_PACKET.md | 76ec0f8b5879a8332bb510f62b5d4fc731eb4c3e332da89854b96fe2c6439e22 |
| review_v51/v51_hashes.txt (scripts, logs incl. failed runs, boards, probes) | 484602989610591a362b5ec97d9b67246ef1ff51ce29d036918e9a0a92e99af4 |

Boards (task-3/review_v51/):
- scout_v51_whole_mech_before_after.png
- scout_v51_feet_closeups.png
- scout_v51_gap_ranking.png
- scout_v51_iou_and_limits.png
- scout_concept_vs_v51_iou.png

**Preserved, rechecked:**

| Version | Hash |
|---|---|
| V50 blend | 81066716…7090 |
| V50 GLB | bd1b5cc4…9d3d |
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
  - TJ's verdict on V51.
  - Next gaps: roof gun (18k) and rear pods / shoulder tops (21k, protected by the V41 shoulders).
  - Arms/legs width comes from accepted parts.
- **Rig:**
  - Ankle and toe articulation: shells follow the ankle and front claw only.
  - Leg chain.
  - Limits are engine data, not constraints.
- **Other:** normals; scale/collision; Unity/Quest.
- **Not claimed:** rolling handoff not edited; no shape or headset acceptance.
