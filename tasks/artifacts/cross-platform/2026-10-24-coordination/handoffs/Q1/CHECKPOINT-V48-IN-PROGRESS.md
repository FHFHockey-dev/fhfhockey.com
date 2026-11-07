# Q1 checkpoint — V48 in progress (usage limit reached; NO V48 file saved)

Working candidate remains **V47** `scout_weapon_detail_v47.blend` 431ded43b65e1de980b19e53819b595adbfeeb978083420282047e9c32c102c1 (unchanged). V40–V47 untouched. No V48 blend/GLB exists yet.

## Findings so far (evidence in task-3/review_v48/)

**Fist width/mount** (`fist_width.json`, `fist_width_grid_raw.png`):

| | Width | Centre offset |
|---|---:|---:|
| Concept front | 0.31–0.36 m | 1.09–1.16 m |
| V47 | 0.45 m | 1.26 m |

Plan: half-width 0.17 at lateral 0.13 (centre ≈1.16 m, outer edge ≈1.33 m); height unchanged.

**Joint ranges in V47** (`v47_joint_ranges.json`), both arms:

| Motion | First contact | Contact pair |
|---|---:|---|
| Shoulder pitch back / aim lower | +7.5° | forearm vs knee guard (inherited since V45) |
| Elbow down | +15° | same |
| Shoulder up | −32.5° | sensor pod |
| Side swing inward | 12.5° | torso flank |
| Side swing outward | 15° | sensor pod |

**Relief** (`relief_probe.json`): a lower-inner forearm/wrist/receiver chamfer K = 0.20 (≈12 cm legs) raises pitch-back to 12.5° and elbow-down to 22.5°.

**Combined poses** still fail: inward swing while aiming down hits the knee/thigh, outward swing with aiming up hits the rear housing, and shoulder +10° plus elbow +20° hits the knee. So joint limits are coupled and affect gameplay aiming. **TJ must approve them by pop-up before V48 is saved** (not yet asked).

## Next steps

1. Run the unsaved probe of the built geometry:

       Blender -b scout_weapon_detail_v47.blend -t 2 --python build_scout_v48_fist_mount_limits.py -- probe '{"shoulder_pitch":[-20,10],"elbow_pitch":[-40,20],"side_in":0,"side_out":10,"combined_down_max":25,"combined_up_min":-60}'

   Tighten until clean. The preview build already works: 43 fist meshes rebuilt, chamfer applied.
2. Pop-up to TJ: the exact clean box versus the ±25° sweep range (degrees lost per joint).
3. Save with the approved limits (`-- save '<json>'`). Write a V48 verifier from verify_scout_v47_weapon_detail.py (check the limit box instead of V45-clean poses, plus the legacy 20-pose sweep). Render from render_scout_v47_review.py, IoU via build_scout_v47_iou_boards.py, then RECEIPT-V48.md.

Hashes of V48 working scripts and evidence: task-3/review_v48/checkpoint_hashes.txt. No Git, Unity or textures.
