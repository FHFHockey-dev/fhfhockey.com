# Q2 receipt — Vesper Basin v14 Strata Ascent (isolated Unity map pass)

24 October 2026, 14:53–15:15 UTC. Lane Q2, Claude session working under the Q2 lease in `CLAUDE-LEASES.json`. This is a bounded environment-art pass on the isolated validation project. v13, v12 and the main project are untouched. No Git, packages, Editor upgrade, Scout/Blender input, main integration, APK, device or spend.

**Status: satisfied for the bounded slice** (flat rock surfaces and tent-like caps, with playability re-verified). **Not addressed:** repeated compounds and debug HUD presentation. Concept fidelity and art acceptance are TJ's call; nothing here establishes Quest headset readiness.

## Exact outputs

| Item | Path | SHA-256 |
|---|---|---|
| New scene | `/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023B/V12ValidationProject/Assets/MapPrototype/Scenes/VesperBasin_v14_StrataAscent.unity` | `450e21bf020bb2f579cfb468b1589909ea7ca43430be64e1dd31deb5333ec80a` |
| v13 scene (read-only, unchanged) | `…/Scenes/VesperBasin_v13_RadarAscent.unity` | `077bd43b9bcaccd51a68e5d353b23cb2c701c7003c8eb21ea3c46c5ddd89aa80` (matches the v13 handoff) |
| Strata shader | `…/Assets/MapPrototype/Shaders/VesperV14StrataRock.shader` | `ceb9473e713a9bfcdcf6b8e83c6bd38b584233f5f9453808a3eca6acf13d9437` |
| All 84 added project files (scene, shader, 8 Editor scripts, `SprintAssets/v14/**`, metas) | listed with hashes in `PROJECT-OUTPUTS.sha256` (paths relative to the isolated project) | — |
| Lane evidence, images, source copies, tools | listed with hashes in `LANE-OUTPUTS.sha256` (relative to this folder) | — |
| Comparison sheet (10 matched pairs) | `images/v13-v14-comparison-sheet.png` | `974e715b5156e8e7caeadc8cb88ca336351e5d5111bace8e912df7d7f791d8ee` |

Unity **6000.6.5f1** (as recorded in the handoff). Open in the Editor with **Vesper Basin → Open strata ascent candidate (v14)**. Controls are unchanged from v13.

## What changed (v14 only)

1. **Layered sandstone instead of flat-colour stone.** A new URP shader, `VesperBasin/V14 Strata Rock`, gives every canyon-rock surface world-space sedimentary beds. The beds follow world height on walls, with dark seams, pale resistant ledges, varnish streaks and cross-bed wander. Plateaus get wind-dust. It keeps URP's own PBR lighting, shadows, SSAO and fog, and reuses URP Lit's ShadowCaster/DepthOnly/DepthNormals passes. 14 inherited rock materials (v12 terrain 01–05, v13 terrain 01–06, v02 Faceted canyon, v02 Sandstone ground, Canyon boundary) map to 14 strata twins that keep the original tints. That is 61 material slots on 41 renderers. Water, roads, structures, signs, HUD and targets are excluded.
2. **Tent caps removed.** Only `V13 North Ascent/Terrain` was regenerated (`SprintV14Terrain`, same placements and crops as v13):
   - The pointed buttress spurs became stepped, flat-topped buttresses. Their bases are unchanged and their tops sit lower than the old apex.
   - The folded "broken" caps became planar, tilted mesa tops.
3. Nothing else changed. The saved-scene comparison shows every other object, transform and serialized field is identical, apart from the rock material slots.

Matched views show the change most clearly in: `throat-west-close`, `throat-east-close`, `descent-landing`, `lower-approach`, `route-overview`, `basin-overview-west` and `radar-to-artillery`.

## Checks actually run (batch Editor on this Mac, all exit 0)

| Receipt | Result |
|---|---|
| `evidence/saved-v14-validation.json` | **17/17 passed.** v13 hash = handoff; shader compiles without Editor errors; all 0 objects missing/extra outside terrain; 0 transform/component/field differences except 61 rock material slots; gameplay components and 20 TextMesh labels retained; terrain keeps 4 renderers + 3 MeshColliders on visible meshes in `SprintAssets/v14`; no v14 renderer still uses a replaced material; **route corridor collision identical** (612 samples, ±5.4 m); margin differences only on regenerated terrain; no lateral obstruction moved inside the deck; both scenes unchanged by the check. |
| `evidence/qa-v13-route.json` (probe filename retained; `scene` = v14) | **22/22 Play Mode checks passed.** Continuous ascent and descent by actual input, 129 support samples, 0.0 capsule penetration, 13.96 m gain, max 8 ungrounded frames, 5.17 m underpass headroom, one setup warp, 0 runtime errors. |
| `evidence/qa-v11-pilot-regression.json` (`scene` = v14) | **10/10 passed:** 7 m/s travel, snap turn, target bypass, capture A progresses/completes while firing, cockpit readout connected. |
| `evidence/v13-visual-evidence.json` (`scene` = v14) | **9 shots, 9 hits, 3 targets disabled**, 0 errors, cleanup complete, saved scene hash unchanged. Cockpit images: `evidence/v13-initial-cockpit.png`, `v13-first-target-disabled.png`, `v13-range-complete-*.png` (file names come from the reused probe). |
| `evidence/v14-matched-captures.json` | 22 images = 11 exact camera pairs (v13 before / v14 after): 5 player-height ascent/descent/arrival views, 3 overviews, 2 new close views, clean and debug spawn. The hidden debug renderer list is recorded. |
| `evidence/baseline-before.json` / `baseline-after.json` | **Main project 611/611 byte-identical** before and after; isolated project 611/611; main has no v13/v14 scene. |
| `evidence/isolated-snapshot-diff.json` | Of the 780 files that existed in the isolated project's Assets/Packages/ProjectSettings, **0 changed and 0 removed**; 84 added (all v14). No transient URP-settings or `_Recovery` rewrite occurred this time. |

Commands: `tools/unity.sh <name> <method> [quit]`, which wraps `tools/run_bounded.py`. Execution receipts and logs are `evidence/*-execution.json` / `*.log`. The first build/capture iteration is kept in `evidence/iteration1/`. It was rebuilt only to reframe one close camera.

## Collision and cover changes, stated exactly

- The route corridor is unchanged.
- In the ±5.4–12 m margin, 47 samples changed height on regenerated rock (max 2.18 m), as the caps and buttresses were reshaped.
- On 2 margin samples, rock now rises above inherited ground. A reshaped buttress ledge sits up to **0.76 m above the v12 island top at about (−28.2, 2.8, 33)**, roughly 10 m from the route centreline. It was not traversal-tested.
- 7 of 80 lateral cover rays changed. Six moved farther, by up to 7.6 m; the throat rock now clears the 25 m ray at head height near (−10, 46). One moved 0.64 m closer, at 8.5 m from centreline.
- Scene inventory v13 → v14: 627/526 renderers (unchanged), 57 materials (unchanged), enabled triangles 129,162 → 129,386.
- ProfilerRecorder draw/batch counters were **not reported** for batch-mode offscreen renders (`stats.available=false`). No draw-call or frame-time figures are claimed.

## Remaining concept gaps and limits

- **Not addressed:** the repeated octagonal compounds and the regular wide roads; the large debug panels and target boxes at the original spawn. Both are unchanged and visible in `original-spawn-debug`.
- **Strata are procedural texture only.** They add no ledge geometry or normal relief. Banding is weak on shadowed faces at close range, the 28 m repeat and faint projection seams are visible on some facets, and the mesa tops are plain.
- **Other unchanged gaps:** sky-heavy ascent framing; the radar mast overlapping the artillery in one view; the existing red/pink near-field surface filling the lower spawn frame (present in v13, not investigated).
- **The custom shader is unverified for Android/Quest** (Vulkan/GLES compile, variant count, GPU cost, stereo). There is no APK, headset, frame-rate, memory or comfort evidence. All captures are Editor mono stills.
- Probe receipt filenames keep their v13/v11 names because the probes are reused unchanged. Each receipt's `scene` field records v14.
- The independent pixel review was not repeated for v14.
