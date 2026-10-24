# Q2 receipt — Vesper Basin v18 Rim Skyline (isolated Unity map pass)

24 October 2026, about 18:00–18:35 UTC. Lane Q2, working on the orchestrator's ticket: "TJ approved the next concept gap as a new v18 scene built from v17 … favour what's visible at player height."

This is a bounded landmark/silhouette pass in the isolated validation project. v17–v13, v12 and the main project are untouched. No Git, packages, Editor upgrade, Scout/Blender input, main integration, APK, device or spend.

**Status: satisfied for the bounded slice.** A distant industrial skyline now frames every player-height view. Every check passes, and routes, cover, the ascent, the artillery, the v16 HUD and the v17 deck are identical. The skyline's measured screen area is small (see below). Art acceptance is TJ's call. Desktop checks are not headset acceptance.

## Re-ranking for player height (measured)

Source: `evidence/v17-coverage.json`. These are the same occlusion-correct material-family masks as v17, now with 8 player-height views including radar-to-artillery.

| Gap from the v17 receipt | Player-height share | Assessment |
|---|---|---|
| **Bare horizon / sky-heavy framing** | **39.1% sky** (26.9–55.1%) | Above the low canyon rim, every pilot view has an empty sky band. The concepts show a layered industrial horizon behind the mesas. **Largest at player height; chosen.** |
| Compound street-level massing | inside the 36.8% "structures" share | Partly treated in v15 (roofs, paint). Street-level changes would alter cover and ground, which this ticket keeps fixed. |
| Rock tops texture-only | rock 15.2% (mostly walls) | Mesa tops are rarely visible from the ground. Low player-height payoff. |
| Deck repetition / no kerbs | deck 10.7% | Treated in v17. |
| Radar mast over artillery | one view | Narrow. |

## Exact outputs

| Item | Path | SHA-256 |
|---|---|---|
| New scene | `…/V12ValidationProject/Assets/MapPrototype/Scenes/VesperBasin_v18_RimSkyline.unity` | `e2ec09d62780cecd391b7b8628049610ba2de5838157c8baf6959d5070812e47` |
| v17 / v16 / v15 / v14 / v13 scenes (read-only, unchanged) | `v17_IndustrialDeck` / `v16_PlayerHud` / `v15_DistinctCompounds` / `v14_StrataAscent` / `v13_RadarAscent` | `8ff8531d…1765` / `31115d60…93ee5` / `c5389bca…3841` / `450e21bf…ec80a` / `077bd43b…aa80` (full hashes in `evidence/saved-v18-validation.json`) |
| All 46 added project files (scene, 8 Editor scripts, 5 materials, cluster and tower meshes, metas) | `PROJECT-OUTPUTS.sha256` (relative to the isolated project) | `1ca8f1c26d73a562d527b3cb9f8adaf9e51c166ce7b8ad34a250fcf686b0549e` |
| Lane evidence, images, source copies, tools | `LANE-OUTPUTS.sha256` (relative to this folder) | `28b00ebe0f54093c9e0180fcb79b9d567ada5d34558dc389e1285707f68ece52` |
| Comparison sheet (12 matched v17/v18 pairs, player height first) | `images/v17-v18-comparison-sheet.png` | `a41156111067518ad873385ac79ad16e8bc00f0035491a3931dadd0137115f3f` |

Open the isolated project in Unity **6000.6.5f1**, then use **Vesper Basin → Open rim skyline candidate (v18)**. The v16 HUD, its F3 debug toggle and the v17 deck are unchanged.

## What changed (v18 only)

One new root, `V18 Rim industrial skyline`, holds **7 clusters on the near canyon-rim mesas**:

| Cluster | Content | Roughly in line with |
|---|---|---|
| North-west refinery | Four banded stacks with red aviation lights, a flare derrick, a process hall with a lit sodium strip, pipe racks | the ascent |
| North-east tank farm | Six domed tanks, a stack, a derrick | the ascent |
| East cooling works | Three cooling towers, a hall, a stack | the spawn road |
| East derrick yard | Four lattice derricks, a shed, a stack | the spawn road |
| South fabrication halls | Three sawtooth halls with lit glazing, two stacks, a derrick | the radar descent |
| South-east refinery | Same kit as the north-west refinery | the plazas |
| West stack line | Derricks, shed, stack | west |

Placement and build rules:
- **Fixed sites:** planned sites were chosen for player-height sightlines and kept clear of the artillery fortress silhouette. The north-west refinery was moved west after iteration 1, where it crowded the artillery in the route overview.
- **Grounding:** each cluster sits on a rim top found by raycasting the saved terrain. A deterministic search finds the nearest top flatter than 6 m within 30 m; the measured spread is 2.1–5.8 m. Bases sink 1.5 m so nothing floats.
- **Rendering:** each cluster is one combined renderer: 7 renderers, 19,464 triangles, 5 materials. They have **no colliders** and cast no shadows. They sit ≥32 m beyond the playable islands' bounds and ≥124 m from the ascent route, out of reach.

No existing object, material slot, collider, HUD or gameplay field changed.

Effect, measured with the same masks (`evidence/v17-coverage.json` vs `evidence/v18-coverage.json`):
- **At player height:** the skyline is visible in **all 8 views**, at 0.1–2.7% of the frame (mean 1.2%). Sky drops from 39.1% to 38.2%.
- **At overview:** 1.9%.

The gain is silhouette and depth on the horizon line (the outpost, then the canyon wall, then distant industry), not a large area. The middle-ascent view stays sky-heavy (55%) because it pitches up toward the radar.

## Checks actually run (batch Editor on this Mac, all exit 0, against the final v18 hash)

| Receipt | Result |
|---|---|
| `evidence/saved-v18-validation.json` | **21/21 passed.** <br>• v13–v17 hashes match their receipts. <br>• Outside the new root, nothing is missing or extra, and there are 0 transform/component/field differences. <br>• The v16 HUD, v17 deck and all 20 text labels are untouched. <br>• The root adds exactly 7 renderers, 0 colliders, no shadows, with assets only in `SprintAssets/v18`. <br>• Every cluster is ≥25 m outside the islands (measured 32.0 m) and ≥120 m from the route (measured 124.2 m). <br>• **Route corridor (612), margins (816), compound ground (3,803) and all 80 cover rays are identical.** |
| `evidence/qa-v16-hud.json` (v16 HUD probe; `scene` = v18) | **19/19.** |
| `evidence/qa-v13-route.json` (`scene` = v18) | **22/22:** continuous ascent and descent by actual input, 0.0 penetration, max 8 ungrounded frames. |
| `evidence/qa-v11-pilot-regression.json` (`scene` = v18) | **10/10.** |
| `evidence/v13-visual-evidence.json` (`scene` = v18) | **9 shots, 9 hits, 3 targets disabled**, 0 errors, saved scene unchanged. |
| `evidence/v18-matched-captures.json` | 26 images = 12 exact v17/v18 camera pairs plus the debug spawn. <br>• 8 player height: spawn road, 2 plazas, south road, radar-to-energy, radar-to-artillery, lower approach, middle ascent <br>• 3 overviews <br>• the spawn clean and with the HUD |
| `evidence/baseline-before.json` / `baseline-after.json` | **Main project 611/611 byte-identical.** The main project has no v13–v18 scenes. |
| `evidence/isolated-snapshot-diff-vs-v17-after.json` | Compared with the isolated project as it stood after v17: **46 added (all v18), 0 changed, 0 removed.** |

`evidence/iteration1/` holds the first layout: 5 clusters, with 2 skipped on uneven rims and the NW refinery crowding the artillery.

## Remaining gaps and limits

- **Small and simple:** the skyline is a thin horizon layer (about 1% of player views). The clusters are simple primitive/lathe massing with no textures, smoke, flare animation or night lighting. The emissive strips and beacons are small at this distance.
- **See-through to shots:** the clusters have no colliders. They are beyond the 90 m practice-weapon range from the playable areas, but a shot aimed at them would pass through.
- **Remaining gaps:**
  - middle-ascent framing is still sky-heavy
  - compounds keep identical drums at street level
  - rock tops are texture-only
  - the deck tile repeats, with no kerbs or lights
  - the radar mast overlaps the artillery in one view
- **No Quest evidence:** custom shaders (v14, v17) and the added skyline geometry have no Quest performance, stereo or comfort evidence.
- **Review:** no independent pixel review has been run for v18.
- **File names:** probe receipt filenames keep their earlier names because the probes are reused unchanged. Each receipt's `scene` field records v18.
