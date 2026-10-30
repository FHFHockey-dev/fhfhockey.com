# Q1 receipt — Scout V57: concept stance + roof rifle (2026-10-25)

Status: **V57 is saved and verified from V56 R1, but not accepted.** V56 R1 stays the working candidate until TJ decides.
- **Sources:** the V56 source and all custody-listed files are untouched.
- **Earlier receipts:** not edited.
- **Not done:** no textures, Unity, Git or scale change.
- **Detail:** `SCOUT_V57_REVIEW_PACKET.md`.
- **Review of the Codex V53–V56 sprint:** `REVIEW-CODEX-V53-V56.md`.

## Gap ranking on V56 (matched, unmirrored silhouettes vs Scout.png)

IoU front 0.773 / side 0.532 / back 0.769 / ¾ 0.600 / ¾ corrected 0.699.

| Rank | Region | Residual (px) | Note |
|---:|---|---:|---|
| 1 | Arms / weapons | 55.2k | Rest-pose difference: the concept's arms hang lowered |
| 2 | Legs | 39.7k | Mostly registration; leg widths match |
| 3 | Feet | 32.7k | — |
| 4 | Rear pods | 26.6k | — |
| 5 | Torso | 19.3k | — |
| 6 | Roof gun | 18.0k | — |

Approved-pose stance tests: shoulders +10° gives side 0.647 and ¾ corrected 0.733. Because this changes the basis of the stored limits, I asked TJ first. TJ chose **"Lower rest stance (Recommended)"**.

## Change (one pass, two gaps)

1. **Stance:** both shoulders rest 10° lower.
   - The stored limits are re-based with `shoulder_rest_offset_deg: 10`.
   - The allowed absolute arm envelope is identical: the same 125 poses per arm, asserted by both the builder and the verifier.
2. **Roof rifle:** the two legacy roof-gun assemblies (10 meshes) are archived, hidden and not exported.
   - **New rifle:** a slim black scoped rifle (14 meshes) on two posts, 12–16 cm above the crown, pointing forward at x −0.22.
   - **Height:** the scope top is pinned to the old top, so height stays 4.013 m.
   - **Muzzle anchor:** the roof muzzle anchor moves to the new bore.

Everything else is carried exactly from V56 R1.

## Before → after

| Metric | V56 R1 | V57 |
|---|---:|---:|
| IoU front / side / back / ¾ / ¾ corrected | 0.773 / 0.532 / 0.769 / 0.600 / 0.699 | 0.766 / **0.620** / 0.762 / **0.653** / **0.732** |
| Feet-anchored side | 0.669 | **0.707** |
| Total region residual | 210.7k px | **183.0k px (−13.1%; feet-anchored −6.4%)** |
| Pilot-view opaque rays (1,271) | 45 | **14** |

**Concept checklist**

| Status | Count | Items |
|---|---:|---|
| Matched | 4 | Lowered arms with weapons pointing down; slim scoped rifle; raised on a post; pointing forward, offset |
| Partial | 1 | Rifle thickness |
| Kept | 5 | — |
| Remaining | 4 | Arms width in front view; chest bulge; leg stance and segmentation; back depth |

The stance reads clearly in the side and ¾ views. The front view barely changes, and front and back IoU each drop 0.007.

## Checks (V57_VERIFIED)

- **Preserved:** 18 preserved version files verified.
  - V52–V56 are at their original paths.
  - **V40–V51 are only in the iCloud Trash.** A separate cleanup worker moved them there, not Q1. They were verified read-only at the paths in `TRASH_RECOVERY_MAP.csv`.
- **Retained objects:** 6,087 retained objects are exact. 302 carried objects are exact with the stance removed (≤ 1.4e-6 m).
- **Limits and clearance:**
  - The re-based limits are stored on the root, the four pivots and the GLB extras.
  - The pose grid is 250/250 clean.
  - Rest arm contacts are equal to V56.
- **Legacy sweep:** identical to V56 in absolute angles (115 pairs; 0 new; 0 at V45-clean poses).
- **Export:** 262 meshes, 78,284 tris, node set equal to V56 ±roof parts, no leaks.
  - Re-import bounds error: 3.6e-7 m.
  - Height: 4.013016 m.
- **Failed runs:** retained. One was missing the preserved paths; one had a wrong bounds formula that asserted nothing; the height guard also rejected a first rifle that was 2 mm too tall.

## Files (`/Users/tim/Documents/Codex/2026-10-15/task-3/`)

| File | SHA-256 |
|---|---|
| scout_concept_stance_v57.blend (3,690,629 B) | 540a93224d7259ac10d335f81d3976e39c9ec959ce2cac8a1e21b78254e9a625 |
| scout_v57_concept_stance_unscaled.glb (2,934,300 B) | 3f45ed6adfae390e990f75fe7f42f6ec4fceee65d4fe7339e03ad311a9cac2e8 |
| scout_v57_build_report.json | d7182ccee813705988a2cf4512662a87e19bc61a18d5fdbaa8ea59b3cd8e779a |
| scout_v57_verified.json | 51ab9f15c7d674b613aee955be5889fbd6430b1614a2f77079a18c0ca239a1a7 |
| SCOUT_V57_REVIEW_PACKET.md | 8cdfd4b7efae01b698c7aa7d27b6eed766d9f7ece1f36c313a31da0d82ce03cf |
| review_v57/v57_hashes.txt (scripts, logs incl. failed runs, boards, probes) | 7515294dd069c8dce5a017f5c87558036a7ce9b33d96b1004b4c779971ab2167 |

**Boards** (`review_v57/`):
- whole-mech before/after;
- concept comparison;
- roof rifle;
- gaps and checklist;
- concept-vs-V56 and concept-vs-V57 IoU.

**Source check:** V56 R1 `c009b722…b782` was rechecked after every V57 run. All custody hashes match.

## Open gates

- **Shape:**
  - TJ's verdict on V57.
  - Remaining gaps: rifle thickness, arms width, chest bulge, leg stance and segmentation, back depth.
- **Interface:**
  - Unity and RF01 must apply `shoulder_rest_offset_deg`.
  - The V56 interface muzzle anchors are superseded by the V57 export.
  - Eye, comfort and Unity remain open.
- **Preservation:** V40–V51 are only in the iCloud Trash. They need an owner decision before it auto-empties.
- **Not claimed:** shape or headset acceptance.
