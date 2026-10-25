# Q1 review — Codex Scout sprint V53→V56 (read-only, 2026-10-25)

Scope: Q1 read the rolling `SCOUT_RESUME_HANDOFF.md`, `SCOUT_ACTIVE_CUSTODY.md/.json`, `cockpit_v56_fit/r1/SCOUT_V56_R1_CHECKPOINT.md`, the V53/V55 checkpoints, the V55 review boards, and the V56 R1 blend (scene scan only). Q1 modified nothing and did not touch GUI Blender PID 96476.

## Hash verification

- **Custody recovery files: all 10 match `SCOUT_ACTIVE_CUSTODY.json`.**
  - Blends: V52, V52 normals R1, V53 rear pods, V54C back, V53 eye studies r1 and r2.
  - GLBs: V54C, V52, normals R1, V53.
- **V56 R1 manifest (`cockpit_v56_fit/r1/V56_MANIFEST.json`): 153/154 match.** The mismatch is `SCOUT_RESUME_HANDOFF.md`. That is expected: a "STOPPED — usage reset 06:14 UTC" prefix was added after the manifest froze. The stop diary hash matches, at `048bd373…1f7`.
- **Current-candidate hashes:**

| File | SHA-256 (prefix) |
|---|---|
| V56 R1 blend | `c009b722…b782` |
| V56 R1 GLB | `80f8ff79…4648` |
| V55 R1 blend | `6034d417…9912` |
| V55 R1 GLB | `1f5021e8…fb16` |

## What the sprint did

| Version | Change | Status |
|---|---|---|
| V52 normals R1 | 132 invalid normal corners → 0, 89 collapsed faces removed; silhouette identical | technical branch |
| V53 | Paired upper-back pods + rear apertures (22 meshes), rear depth +4.1 cm | positively received 04:37 UTC; not shape acceptance |
| V54C | Segmented rear back construction | internal checkpoint |
| V55 R1 | Combined back / narrower service block / tapered shoulders / thick faceted shoulder caps / shorter arm shells | current exterior; independent review pass (bounded) |
| V56 R1 | Interior seat only (lowered 260 mm, cushion aft, footrest); measured neutral eye (0, −0.414, 3.442) m; opaque view obstruction 46.1% → 3.5% | current candidate; exterior exactly V55 R1 |

## Current working candidate and acceptance state

- **Working candidate:** `cockpit_v56_fit/r1/scout_cockpit_fit_v56_r1.blend`, scene `SCOUT_V56_COCKPIT_FIT`, root `SCOUT_V56_UNSCALED_METERS`, prefix `V56`, 258 exported meshes.
- **Accepted:** physical scale 4.013 m at source scale 1.0 ("yes, 4.01m", 05:13 UTC). No shrink to 3.2 m.
- **Open:** eye anchor, overall shape, comfort/anthropometry, the full leg rig, roof-gun form and aim, Unity import and the device.
- **Stored joint limits:** the five payloads are carried exactly.

## Protected (do not move, delete or overwrite)

Everything listed in `SCOUT_ACTIVE_CUSTODY.md/.json`:
- **Active directories:** `cockpit_v56_fit/`, `shape_v53_rear_pods/`, `shape_v54_back_study/`, `shape_v55_upper_body/`, `cockpit_v53_eye_study(_r2)/`, `review_normals_independent/`, `technical_v52_normals_r1/`.
- **Scripts:** all V53–V56 scripts.
- **References and read dependencies:** the original references, task-11 helpers and the other listed read dependencies.

Q1 writes only new V57+ files.

## Observations for the next pass

Remaining whole-mech gaps named by Codex: overall proportions and construction, hip/knee/calf rhythm, roof-gun aim, and cockpit fit.

Not reported by Codex, but visible on the concept ¾ overlay (V55 board):
- The concept's lower legs and feet are bulkier.
- The concept's arm and weapon masses read larger.
- The concept's torso is more rounded and layered.

Q1 will rank these quantitatively before V57.
