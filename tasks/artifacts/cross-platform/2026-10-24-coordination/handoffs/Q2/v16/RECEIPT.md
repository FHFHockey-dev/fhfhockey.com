# Q2 receipt — Vesper Basin v16 Player HUD (isolated Unity map pass)

24 October 2026, about 16:20–17:05 UTC. Lane Q2, working on the orchestrator's ticket: "the remaining item from your original brief, the debug HUD presentation, as a new v16 scene built from v15."

This is a bounded presentation pass in the isolated validation project. v15, v14, v13, v12 and the main project are untouched. No Git, packages, Editor upgrade, Scout/Blender input, main integration, APK, device or spend.

**Status: satisfied for the bounded slice.** The presentation now uses a compact player HUD, and the debug instrumentation is kept and switchable. Saved-scene, route, pilot, firing and new HUD Play Mode checks all pass on the final v16. Desktop checks are not headset acceptance.

## Where to look

Open the **isolated** project `/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023B/V12ValidationProject` in Unity **6000.6.5f1**. Then use **Vesper Basin → Open player HUD candidate (v16)** and press Play.

To see the debug panels, either:
- press **F3** (desktop), or
- tick **Debug Mode** on `Mech test proxy / WASD/V16 player HUD` before Play.

For a quick look, open `images/v15-v16-cockpit-comparison-sheet.png` and `images/v16-playmode-hud-states.png`.

## Exact outputs

| Item | Path | SHA-256 |
|---|---|---|
| New scene | `…/V12ValidationProject/Assets/MapPrototype/Scenes/VesperBasin_v16_PlayerHud.unity` | `31115d60fafbf4718672224b23e0a6d47b667a7872e52290d1973c3047193ee5` |
| v15 / v14 / v13 scenes (read-only, unchanged) | `…/Scenes/VesperBasin_v15_DistinctCompounds.unity` / `v14_StrataAscent` / `v13_RadarAscent` | `c5389bca…3841` / `450e21bf…ec80a` / `077bd43b…aa80` (full hashes in `evidence/saved-v16-validation.json`) |
| HUD runtime script | `…/Assets/MapPrototype/Scripts/V16PlayerHud.cs` | `7ab8ea2fc8997ec03344e0535e3acf2b689b8bf336b1866588c03214efad2f51` |
| All 29 added project files (scene, HUD script, HUD probe, 7 Editor scripts, 4 materials, metas) | `PROJECT-OUTPUTS.sha256` (relative to the isolated project) | `f41c24180ea98eff2f0ef2ffdefc32c6d8977ea335505fd8a204f5c0d94d3074` |
| Lane evidence, images, source copies, tools | `LANE-OUTPUTS.sha256` (relative to this folder) | `cd331aebc415cecb9780a74806f439517ebf79236bdd1ffe0bb92fc3220a94a0` |
| Cockpit comparison sheet (12 matched v15/v16 pairs) | `images/v15-v16-cockpit-comparison-sheet.png` | `c9709e4d09629812ad2c97b4ac53a4b00fd18ee626fba5c2bf82db2f2043f8bc` |
| Play Mode HUD states sheet | `images/v16-playmode-hud-states.png` | `34f94f44a6f63296b9387c2a0724c1938e838a265cae1627922d4595550e5cf3` |

## What changed (v16 only)

**Player HUD.** One cockpit-anchored panel sits under the pilot proxy. It is fixed to the cockpit, not to the head, and shows only three lines:
1. Objective: `A ENERGY` with `NEUTRAL`, `CAPTURING nn%`, `CAPTURED` or `CONTESTED`, colour-coded, plus a progress bar.
2. Weapon: `TARGETS left/total` with `READY`, `HIT`, `RELEASE TRIGGER`, `PAUSED`, `RESETTING nn%` or `RANGE CLEAR`.
3. Hint: a short controls hint for the first 12 s, or while input must be released. Once the range is clear it becomes `HOLD B / R  RESET RANGE`.

It reads the same live components as the debug readouts and writes no gameplay state.

**Comfort layout.** The panel is 0.92 m ahead of the eye and 0.32 m below it (19° pitch), 0.46 m wide. Glyphs are 31, 27 and 21 mm tall. Measured in Play Mode from the live camera:

| Measurement | Result |
|---|---|
| Horizontal extent | ±14.4° |
| Below the eye line | 14.0–23.3° |
| Distance from the eye | 0.98–1.01 m |
| Smallest glyph | 1.24° |
| Distance from the pilot centre | 0.98 m, inside the 1.10 m proxy radius, so walls can't cut the HUD (same rule as the v09 readout) |

**Debug instrumentation.** It is kept but hidden in the saved presentation. The 8 cockpit readout renderers (3 panels, 3 labels and the progress bar) and the 3 floating target labels are saved with their renderers disabled. Their GameObjects and scripts are untouched and keep updating their text. Debug mode switches back.

**Not changed:** objects, colliders, gameplay fields, world signs, targets, reticle and lighting. The large pink band at the bottom of the spawn view is the existing `RED BASE / protected spawn/Spawn pad`, which is world geometry, not HUD. It was identified in `evidence/v16-build.json`.

## Checks actually run (batch Editor on this Mac, all exit 0, against the final v16 hash)

| Receipt | Result |
|---|---|
| `evidence/saved-v16-validation.json` | **21/21 passed.** <br>• v13, v14 and v15 hashes match their receipts. <br>• The HUD is wired, saved in player mode, with 7 player renderers on and exactly those 11 debug renderers off. <br>• Outside the HUD, nothing is missing or extra. There are 0 transform/component differences and 0 field differences apart from those 11 enable flags. <br>• Gameplay components, the 20 world TextMesh labels and the cockpit readout script are all retained. <br>• The HUD adds no colliders, and its materials live only in `SprintAssets/v16` (the label material is reused). <br>• **Route corridor (612), margins (816), compound ground (3,803) and all 80 cover rays are identical.** |
| `evidence/qa-v16-hud.json` (new probe) | **19/19 Play Mode checks:** <br>• starts in player mode with correct NEUTRAL / `TARGETS 3/3 READY` text and the hint visible <br>• hidden debug text keeps updating <br>• debug on and off via the API and via desktop F3 <br>• target count follows disabled targets (direct `ApplyHit`, binding test only) <br>• a real capture of A, after one setup warp: `CAPTURING 19%` with a growing bar, then `CAPTURED` with a full bar <br>• the hidden debug readout also reports CAPTURED <br>• the hint times out at 12.6 s <br>• range clear shows the reset hint <br>• the five comfort-geometry checks above <br>• 0 runtime errors |
| `evidence/qa-v13-route.json` (probe filename retained; `scene` = v16) | **22/22:** continuous ascent and descent by actual input, 0.0 penetration, max 8 ungrounded frames. |
| `evidence/qa-v11-pilot-regression.json` (`scene` = v16) | **10/10**, including "cockpit capture readout remains connected": the debug readout still works while hidden. |
| `evidence/v13-visual-evidence.json` (`scene` = v16) | **9 shots, 9 hits, 3 targets disabled** with real virtual trigger input, 0 errors, saved scene unchanged. Its cockpit images (`evidence/v13-*.png`) now show the player HUD. |
| `evidence/v16-matched-captures.json` | 24 images: v15 and v16 × 4 cockpit stations × 3 presentations. <br>• Stations: spawn, lower approach, middle ascent, radar-arrival descent. <br>• Presentations: `player` (as saved), `debug` (instrumentation shown) and `env` (HUD, targets and text hidden). <br>• v16 `debug` matches v15 `player`, so the instrumentation is preserved. |
| Play Mode HUD images | `evidence/v16-play-*.png`: start (player/debug), capturing, range clear (player/debug). |
| `evidence/baseline-before.json` / `baseline-after.json` | **Main project 611/611 byte-identical** before and after. The main project has no v13–v16 scenes. |
| `evidence/isolated-snapshot-diff-vs-v15-after.json` | Compared with the isolated project as it stood after v15: **29 added (all v16), 0 changed, 0 removed.** |

Inventory v15 → v16:
- Renderers: 640 → 647 total, 539 → 535 enabled (7 HUD renderers on, 11 debug renderers off).
- Materials: 76 → 80.
- Colliders: 248, unchanged.

Iterations are archived:
- `evidence/iteration1/` had text that was too small (the hint was 0.9°).
- `evidence/iteration2/` had a panel 15.6° wide, which failed the probe's ±15° rule. That run's route, pilot and firing receipts passed and are kept there too.
- Two saved-validation comparator bugs were fixed in the checker, not the data: booleans serialise as True/False, and the TextMesh count was including the HUD's own lines.

## Remaining gaps and limits

- **No headset evidence.** These are desktop mono Editor and Play Mode renders, not headset legibility, stereo convergence, comfort, frame rate or memory. A Quest wearer still needs to judge text size, the 19° placement and the panel contrast.
- **No headset debug toggle.** On Quest, debug mode is the Inspector flag only, because no controller binding was added (that would touch the input assets).
- **No contested state tested.** The HUD shows CONTESTED from `CaptureZone.IsContested`, but no opponent exists, so that state wasn't exercised. `RESETTING` (B/R hold) and `PAUSED` were not exercised in Play Mode either.
- **Targets rely on colour.** Floating target labels are hidden in player mode, so targets read by colour only (orange full, red damaged, grey disabled) plus the HUD count. There is no per-target hit counter.
- **Text rendering.** It uses the existing depth-tested TextMesh material. Nothing uses SDF/TextMeshPro, and no new font asset was added.
- **Open from earlier passes:** the v14 strata shader is unverified on Quest, the compound street-level massing is unchanged, and no independent pixel review has been run for v16.
- **File names:** probe receipt filenames keep their v13/v11 names because the probes are reused unchanged. Each receipt's `scene` field records v16.
