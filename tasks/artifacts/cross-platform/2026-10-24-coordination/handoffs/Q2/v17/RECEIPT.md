# Q2 receipt — Vesper Basin v17 Industrial Deck (isolated Unity map pass)

24 October 2026, about 17:15–17:55 UTC. Lane Q2, working on the orchestrator's ticket: "take the largest remaining concept gap listed in your v16 receipt and address it as a new v17 scene built from v16."

This is a bounded material pass in the isolated validation project. v16, v15, v14, v13, v12 and the main project are untouched. No Git, packages, Editor upgrade, Scout/Blender input, main integration, APK, device or spend.

**Status: satisfied for the bounded slice.** The road/plaza deck, the largest untreated surface, now has an industrial deck finish. Every check passes, and collision, routes, cover, HUD and gameplay are identical to v16. Concept fidelity and art acceptance are TJ's call. Desktop checks are not headset acceptance.

## How the gap was chosen (measured, not guessed)

`evidence/v16-coverage.json` (the ranking run is kept as `evidence/iteration1/v16-coverage-ranking-pass.json`) measures **occlusion-correct on-screen share by material family**. Each material family is swapped to flat magenta and the changed pixels are counted. The cameras are 3 overviews and 7 player-height views, with HUD, targets and text hidden.

| Family | Overview mean | Player-height mean | State after v13–v16 |
|---|---|---|---|
| Canyon rock | 50.0% | 15.0% | Layered strata already (v14). Remaining gap: texture-only, plain mesa tops (a refinement). |
| **Road / plaza deck (`Road graphite`)** | **19.8%** | **12.2%** (up to 35.5% on a road view) | **One flat untextured colour across 96 renderers in a regular grid. Never treated.** |
| Structures and props | 11.3% | 36.5% | Many materials. Compounds were differentiated in v15. Remaining gap: identical drums at street level. |
| Sky / background | 11.5% | 38.3% | Framing, not content. |
| Water | 7.3% | 0% | — |

The deck is the largest visible surface that has never been treated, and it is prominent at both overview and player height. It is also where the map reads as "sterile" against the concepts' busy industrial decks. Ranked after it:
- rock-top refinement
- compound street-level massing
- sky framing, which is not a content gap
- the radar-mast/artillery overlap, which is a single view

## Exact outputs

| Item | Path | SHA-256 |
|---|---|---|
| New scene | `…/V12ValidationProject/Assets/MapPrototype/Scenes/VesperBasin_v17_IndustrialDeck.unity` | `8ff8531db0a73e4d24262f042b3bd2e2bd68c30abc09a96238a9b46cc9771765` |
| v16 / v15 / v14 / v13 scenes (read-only, unchanged) | `VesperBasin_v16_PlayerHud` / `v15_DistinctCompounds` / `v14_StrataAscent` / `v13_RadarAscent` | `31115d60…93ee5` / `c5389bca…3841` / `450e21bf…ec80a` / `077bd43b…aa80` (full hashes in `evidence/saved-v17-validation.json`) |
| Deck shader | `…/Assets/MapPrototype/Shaders/VesperV17IndustrialDeck.shader` | `b7477c3644f14e9be63e836f630986fee7175035c46f2ba1022e2fc0d651ef83` |
| All 27 added project files (scene, shader, 8 Editor scripts, 1 material, 2 textures, metas) | `PROJECT-OUTPUTS.sha256` (relative to the isolated project) | `48ba0c1dc80b7116996ec8085a3cdc5e21c8ff53f610d53cc469731bb0b91641` |
| Lane evidence, images, source copies, tools | `LANE-OUTPUTS.sha256` (relative to this folder) | `344d9fd84af4406e6f1bb926984ca6253b97a1f50f68773a395f4b06582986d5` |
| Comparison sheet (11 matched v16/v17 pairs) | `images/v16-v17-comparison-sheet.png` | `94d7b1ae489a7fa19e5c443262f653c01176e9c53e8f5d8af6d85d870ab9d522` |

Open the isolated project in Unity **6000.6.5f1**, then use **Vesper Basin → Open industrial deck candidate (v17)**. The v16 HUD and the F3 debug toggle are unchanged.

## What changed (v17 only)

All 96 `Road graphite` material slots now use **V17 industrial deck graphite**, a world-space URP shader built the same way as the v14 rock shader. It uses URP Lit's own lighting, shadow, SSAO and fog helpers, replaces only the albedo, and reuses URP Lit's shadow and depth passes. Those 96 slots cover roads, plazas, pads, foundations and block roofs. The deck shows:
- **4 m composite slabs in running bond**, with dark expansion joints, worn arrises and ±20% per-slab tone.
- **Aggregate grain.**
- **Bolted 1.1 m service hatches and drain grates** on some slabs, plus a 2 m service strip with a channel in one row out of four.
- **Sparse, irregular sand drift** at a 97 m repeat, plus oil and grime.
- **Kerb and pad faces** shaded and run along the face.

It keeps the original Road graphite tint. Mesh UVs are ignored, so static batching cannot change the pattern.

Only material slots change. No mesh, transform, collider, HUD, gameplay field or other material changed.

Effect, measured with the same masks (`evidence/v16-coverage.json` vs `evidence/v17-coverage.json`):

| Road-pixel luminance spread | v16 | v17 | Change |
|---|---|---|---|
| Overview | 0.0217 | 0.0323 | +49% |
| Player height | 0.0722 | 0.0743 | +3% |

At player height the spread is dominated by lighting and shadow, so the visible gain there is joints, slabs, hatches and grates rather than a big tonal change. The deck's screen share is unchanged, as expected.

## Checks actually run (batch Editor on this Mac, all exit 0, against the final v17 hash)

| Receipt | Result |
|---|---|
| `evidence/saved-v17-validation.json` | **20/20 passed.** <br>• v13–v16 hashes match their receipts. <br>• The deck shader compiles without Editor errors. <br>• No objects were added or removed, and there are 0 transform/component differences. <br>• 0 field differences apart from exactly 96 `Road graphite → V17 industrial deck` slots; no renderer still uses Road graphite. <br>• The v16 player HUD, debug readout and all 20 text labels are untouched. <br>• **Route corridor (612), margins (816), compound ground (3,803) and all 80 cover rays are identical.** |
| `evidence/qa-v16-hud.json` (v16 HUD probe; `scene` = v17) | **19/19:** HUD bindings, debug toggle and comfort geometry are unchanged (±14.4°, smallest glyph 1.24°). |
| `evidence/qa-v13-route.json` (`scene` = v17) | **22/22:** continuous ascent and descent by actual input, 0.0 penetration, max 8 ungrounded frames. |
| `evidence/qa-v11-pilot-regression.json` (`scene` = v17) | **10/10.** |
| `evidence/v13-visual-evidence.json` (`scene` = v17) | **9 shots, 9 hits, 3 targets disabled**, 0 errors, saved scene unchanged. |
| `evidence/v17-matched-captures.json` | 22 images = 11 exact v16/v17 camera pairs: <br>• 3 overviews <br>• a close deck oblique <br>• 5 player-height road/plaza/descent views <br>• the clean spawn and the saved spawn with the player HUD |
| `evidence/baseline-before.json` / `baseline-after.json` | **Main project 611/611 byte-identical.** The main project has no v13–v17 scenes. |
| `evidence/isolated-snapshot-diff-vs-v16-after.json` | Compared with the isolated project as it stood after v16: **27 added (all v17), 0 changed, 0 removed.** |

Iterations are archived:
- `evidence/iteration1/` had the first deck, too faint on the dark base.
- `evidence/iteration2/` had sand drift that tiled as a regular camouflage pattern at overview distance.

The final version uses an absolute dust blend, a domain-warped sparse drift field and a 97 m repeat.

## Remaining gaps and limits

- **Texture only:** there are no kerbs, guardrails, lane edges, lights or geometric deck relief. Roads are still the same regular, wide network in the same layout. Overlapping road pieces made shader-painted edge lines unsafe, so I didn't add them.
- **Tiling:** the 16 m tile repeat and its hatch/grate placement repeat across large plazas.
- **Overview read:** the drift stays faint at long range, and the deck remains dark and low-contrast, matching the inherited palette.
- **Quest:** the custom shaders (v14 rock, v17 deck) are unverified on Android/Quest, with no shader compile, cost or stereo evidence there.
- **Next-ranked gaps, unaddressed:** rock tops are texture-only and plain, compounds are identical drums at street level, the ascent views are sky-heavy, and the radar mast overlaps the artillery in one view.
- **Review:** no independent pixel review has been run for v17.
- **File names:** probe receipt filenames keep their v13/v11/v16 names because the probes are reused unchanged. Each receipt's `scene` field records v17.
