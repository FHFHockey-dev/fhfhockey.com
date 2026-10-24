# Q2 receipt — Vesper Basin v15 Distinct Compounds (isolated Unity map pass)

24 October 2026, about 15:25–16:05 UTC. Lane Q2, continuing from v14 at TJ's request: "vary the repeated octagonal compounds in a new v15 scene, keeping routes and cover verified the same way." This is a bounded art pass on the isolated validation project. v14, v13, v12 and the main project are untouched. No Git, packages, Editor upgrade, Scout/Blender input, main integration, APK, device or spend.

**Status: satisfied for the bounded slice.** The four repeated octagonal blocks now have distinct identities, and routes, cover and ground are verified identical. Art acceptance is TJ's call. Nothing here establishes Quest headset readiness.

## Where to look

The files are in the **isolated** project, not the main game project. Open `/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023B/V12ValidationProject` in Unity **6000.6.5f1**. Then use **Vesper Basin → Open distinct compounds candidate (v15)**, or **…strata ascent candidate (v14)** for the previous pass. The main project (`/Users/tim/Desktop/MetaQuestGame/Vesper Basin Prototype`) intentionally has no v13/v14/v15 scenes. The quickest visual check is `images/v14-v15-comparison-sheet.png`.

## Exact outputs

| Item | Path | SHA-256 |
|---|---|---|
| New scene | `…/V12ValidationProject/Assets/MapPrototype/Scenes/VesperBasin_v15_DistinctCompounds.unity` | `c5389bcadfe4e0b98003a82be080b547969a8d79b92b2842e03feef086973841` |
| v14 scene (read-only, unchanged) | `…/Scenes/VesperBasin_v14_StrataAscent.unity` | `450e21bf020bb2f579cfb468b1589909ea7ca43430be64e1dd31deb5333ec80a` |
| v13 scene (read-only, unchanged) | `…/Scenes/VesperBasin_v13_RadarAscent.unity` | `077bd43b9bcaccd51a68e5d353b23cb2c701c7003c8eb21ea3c46c5ddd89aa80` |
| All 66 added project files (scene, 6 Editor scripts, `SprintAssets/v15/**`, metas) | `PROJECT-OUTPUTS.sha256` (paths relative to the isolated project) | `817ca73a7cf4fb523456168d98690bad26c663c88cd2a702682d2d12a5f90025` |
| Lane evidence, images, source copies, tools | `LANE-OUTPUTS.sha256` (relative to this folder) | `114e8905a7203f3872bc8287c02f7c5608bc2ca8e7e87c07015f0b52473dc653` |
| Comparison sheet (12 matched pairs) | `images/v14-v15-comparison-sheet.png` | `f49e4d597d33affb8e84af26bc2ef22b4b0d9e76e2046740e3ec22836876934d` |

## What changed (v15 only)

Each block gets a rooftop silhouette that matches its name, plus its own hull and accent paint:

| Block | Rooftop identity | Paint |
|---|---|---|
| NE Cooling and service | Two hyperbolic cooling towers (6.7 m and 4.9 m tall), open tops with soot bands | Teal-grey hull, cooling-teal accent |
| NW Communications | 19 m tapering lattice mast with a red beacon, plus two comms dishes facing different ways | Navy hull and accent |
| SE Logistics | Yellow rooftop jib crane (hook over the roof), plus 3-high and 2-high stacks of 6 m containers in rust, teal and ochre | Ochre hull, hazard-ochre accent |
| SW Loading | North-light sawtooth shed bank (2 sheds, 2.6 m ridge, glazed faces) beside the existing gantry | Oxide-red hull and accent |

How it was built:
- **New objects:** 13 roof features with 13 colliders under one new root, `V15 Distinct compounds`, for 4,616 added triangles.
- **Repainted slots:** 12 existing material slots were repainted: each block's volume, plus its v12 dressing "Weathered blue steel" slot.
- **Placement:** every feature was placed by raycasting the roof against temporary colliders on the existing roof props, so nothing overlaps them. The temporary colliders were removed before saving. Placements are recorded in `evidence/v15-build.json`.
- **Untouched:** no existing transform, collider, gameplay field, label or HUD element changed.

## Checks actually run (batch Editor on this Mac, all exit 0, all against the final v15 hash)

| Receipt | Result |
|---|---|
| `evidence/saved-v15-validation.json` | **18/18 passed.** <br>• v13 and v14 hashes match their receipts. <br>• Outside the new root, nothing is missing or extra, and there are 0 transform/component/field differences apart from the 12 compound paint slots. <br>• Gameplay components and all 20 TextMesh labels are retained. <br>• The 13 features each have a renderer and a collider, and their assets live only in `SprintAssets/v15`. <br>• **Every render-mesh vertex and collider surface sample sits over its own roof and at or above the roof top.** <br>• **Route corridor (612 samples) and margins (816) are identical.** <br>• **Ground around all four blocks is identical** (3,803 samples). <br>• **All 80 lateral cover rays are identical.** <br>• The scenes were unchanged by the check. |
| `evidence/qa-v13-route.json` (probe filename retained; `scene` = v15) | **22/22 Play Mode checks:** continuous ascent and descent by actual input, 0.0 capsule penetration, max 8 ungrounded frames, 5.17 m underpass headroom, one setup warp, 0 errors. |
| `evidence/qa-v11-pilot-regression.json` (`scene` = v15) | **10/10:** travel, snap turn, target bypass, capture A while firing, cockpit readout connected. |
| `evidence/v13-visual-evidence.json` (`scene` = v15) | **9 shots, 9 hits, 3 targets disabled**, 0 errors, saved scene hash unchanged. |
| `evidence/v15-matched-captures.json` | 25 images: 12 exact v14/v15 camera pairs plus the v15 debug spawn. They include the overview, 4 close views, 4 player-height A-plaza views, the route overview, the radar-to-energy descent view and the clean/debug spawn. |
| `evidence/baseline-before.json` / `baseline-after.json` | **Main project 611/611 byte-identical** before and after, and the isolated project's baseline files 611/611. The before check ran after TJ had opened and closed the main project in the Editor at 11:26 local. |
| `evidence/isolated-snapshot-diff.json` | Isolated project: **66 added (all v15), 0 changed, 0 removed.** |

Inventory v14 → v15:

| | v14 | v15 |
|---|---|---|
| Renderers (total / enabled) | 627 / 526 | 640 / 539 |
| Colliders | 235 | 248 |
| Materials | 57 | 76 |
| Enabled triangles | 129,386 | 134,002 |

These are content counts. No draw-call or frame-time figure is claimed: batch offscreen renders did not report counters in v14.

Process notes:
- Placement was iterated before the first save. The early runs failed and saved nothing, because the radius bound came from the wrong mesh and the container footprint axes were swapped.
- Two saved iterations are archived in `evidence/iteration1/` and `evidence/iteration2/`:
  - iteration 1 → 2: taller sawtooth.
  - iteration 2 → final: the crane counter-jib was shortened, after the shape-accurate check found a 0.15 m overhang past the roof edge.
- The two north plaza cameras were reframed because a gate pillar blocked them. Both scenes were captured from the same new cameras.

## Effects on play, stated plainly

- Ground routes, paths around the blocks and route cover are unchanged.
- The new rooftop solids are on top of the 9–14 m roofs. They change **elevated sightlines and shots that pass above roofs**, for example from the radar deck or the ascent toward the NE/NW blocks.
- Nothing was traversed on the roofs, and roof access wasn't assessed.

## Remaining gaps and limits

- **Footprints:** the blocks keep their identical octagonal drums and footprints. Identity comes from rooftop silhouettes and paint, not new massing at street level.
- **Roads:** the wider regular road network is unchanged.
- **Feature size:** the free roof area was limited, so the SW sawtooth bank and the dishes are small. They read best in close and overhead views.
- **Debug HUD and spawn targets:** still unchanged; they were not in this slice.
- **Primitive detail:** features are simple primitive and lathe geometry. There are no textures, decals, lights or animation, the crane doesn't move, and the beacon is emissive only.
- **No Quest evidence:** no Quest/APK, stereo, comfort, frame-rate or memory evidence.
- **Shader:** the v14 strata shader remains unverified on Android/Quest.
- **Review:** no independent pixel review was run for v15.
- **File names:** probe receipt filenames keep their v13/v11 names because the probes are reused unchanged. Each receipt's `scene` field records v15.
