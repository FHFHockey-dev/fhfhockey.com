# Q2 receipt — Vesper Basin v23 Live Battlefield (bigger pass, from TJ-accepted v22)

25 October 2026, about 14:15–14:25 UTC. Lane Q2, continuing TJ's direction that each approval checkpoint should close a larger concept gap. v22 was accepted by TJ by pop-up ("Accept as new base"). This is the isolated validation project only. No Git, packages, Editor upgrade, Scout import, main integration, APK, device or spend.

**Status: ACCEPTED by TJ as the new base** (direct pop-up answer in the Q2 session on 25 Oct 2026, about 14:28 UTC: "Accept as new base (Recommended)"). Desktop checks are not headset acceptance.

## Gap ranking after v22 (overview and player height)

| Concept feature (`map1(1).png`, `map2(1).png`) | v22 | v23 |
|---|---|---|
| Faction bases with glowing team trims and shielded deployment | ✗ plain red and blue boxes | **✓ faction trim traced on 12 base structures (56 segments), rear hex-shield arcs with 4 lit pylons per base** |
| Aerial life: drones and patrol craft over the battlefield | ✗ static, empty sky | **✓ 6 violet drones over E, 3 cyan repair drones over B, 2 patrol craft circling the canyon, animated in Play Mode** |
| Warm golden-hour mood, long light, warm haze | ✗ neutral midday, deep blue sky | **✓ sun at 21° in the WSW, warm sun colour and ambient, peach haze, new warm sky** |
| Objective beacons A–E, vivid rivers, lane edges | ✓ v22 | ✓ unchanged |
| Rock strata, distinct compounds, deck, skyline, targets, HUD | ✓ v14–v20 | ✓ unchanged |
| Lifts and ziplines, tunnels, rising-water event, cockpit at the approved Scout scale | ✗ | ✗ (not in this pass; the cockpit needs owner direction) |

That is **3 more concept features ✓** in this pass, or 7 across v22 and v23.

## Exact outputs

| Item | Path | SHA-256 |
|---|---|---|
| New scene | `…/V12ValidationProject/Assets/MapPrototype/Scenes/VesperBasin_v23_LiveBattlefield.unity` | `7b34c76f0528e7bd752ed095313417315fe273241609cc8d143054f3bc0c17b9` |
| Source scene (TJ-accepted, read-only) | `…/Scenes/VesperBasin_v22_ConceptLayer.unity` | `cfb821944a0bb1e2376a5aa27613e5613142088330ca8f974863795b46d85c41` |
| v13–v22 scenes | all ten re-hashed inside the saved-scene validation | unchanged |
| All 66 added project files (scene, 1 runtime script, 8 Editor scripts, materials, meshes, texture, metas) | `PROJECT-OUTPUTS.sha256` (relative to the isolated project) | `22a4f26de0136faaeb0cb4ff1bdabdc33195b2e3d39c956beaecccdf941bd404` |
| Lane evidence, images, source copies, tools | `LANE-OUTPUTS.sha256` (relative to this folder) | `d535261ce5c728f6b969286eae4e7ce30f41f100175ba38514a0cdb86bdd2b42` |
| Comparison sheet (13 matched v22/v23 pairs) | `images/v22-v23-comparison-sheet.png` | `62e31819b6eb9684b84116214ea5b99b9cc916cef84c2fdd7b93dd41cd10fd55` |
| Approval highlights (3 pairs) | `images/v23-approval-highlights.png` | `eaef6e5477b5b7f3257558a2ad6ba537a555feaa54b362c4d1ea6846e0fb0255` |

Open the isolated project in Unity **6000.6.5f1**, then use **Vesper Basin → Open live battlefield candidate (v23)** and press Play to see the flyers move. Controls are unchanged.

## What changed (v23 only)

**Faction bases**
- **Trim:** traced from each red/blue base structure's real top outline (convex hull of its top vertices), emissive, 2 combined renderers.
- **Rear shields:** a translucent hex-grid shield arc (130°, 15 m, radius 25 m) stands behind each base on the outward side, outside the eastward spawn view, with 4 lit pylons per base.

**Aerial life**
- **Flyers:** 11 render-only flyers driven by the new `V23Orbit`. It is visual only: deterministic circles, a bob and a bank, with no physics or colliders.
- **Clearances:** every orbit stays **≥13.7 m above any surface below** and **≥37.9 m from the practice range**.

**Golden hour**
- **Sun:** rotation (31, −46) → (21, 68), colour warmer, intensity 2.05 → 2.3. The sun now sits west-south-west, behind the spawn view, so the pilot never faces it and the targets are front-lit.
- **Ambient and fog:** warmer trilight ambient; fog colour (0.52, 0.64, 0.70) → (0.80, 0.62, 0.50), start 220 → 150 m, end 560 → 540 m.
- **Sky:** a new `V23 golden hour sky` material; the v13 sky asset is untouched.

The root holds 17 renderers, 5,172 triangles and **0 colliders**, and casts no shadows. Outside the root, only the sun's light and transform changed, plus RenderSettings. No gameplay, HUD, rig, eye or scale change.

## Checks actually run (batch Editor, shared heavy lock taken and released per run, all exit 0, final hash)

| Receipt | Result |
|---|---|
| `evidence/saved-v23-validation.json` | **18/18 passed.** <br>• v13–v22 hashes all match and are unchanged. <br>• v23 is built from accepted v22. <br>• Outside the root, 0 differences apart from 4 sun fields plus the sun transform. <br>• HUD, deck, targets, v20 art and v22 beacons/lanes/rivers are untouched. <br>• The root has renderers only, with assets only in `SprintAssets/v23`. <br>• Flyer clearance and range distance meet the rules above; trims cover both bases; golden-hour lighting is confirmed. <br>• **Route corridor (612), margins (816), compound ground (3,803) and all 80 cover rays are identical.** |
| `evidence/qa-v19-gameplay.json` (Codex suite, `scene` = v23) | **73/73**, one real reload, 0 errors. |
| `evidence/qa-v16-hud.json` | **19/19.** |
| `evidence/qa-v13-route.json` | **22/22:** 0.0 penetration, max 8 ungrounded frames. |
| `evidence/qa-v11-pilot-regression.json` | **10/10.** |
| `evidence/v13-visual-evidence.json` | **9 shots, 9 hits, 3 targets disabled**, 0 errors, saved scene unchanged. |
| `evidence/v23-matched-captures.json` | 34 images = 16 exact v22/v23 camera pairs plus the debug spawn. They include both base rear obliques and a player-height view of the E drone sky. |
| `evidence/v22-coverage.json` / `v23-coverage.json` | New elements are visible in 8 of 11 coverage views (0.2–1.4% of each frame). The lighting change affects every frame and is not area-measured. |
| `evidence/baseline-before.json` / `baseline-after.json` | **Main project 611/611 byte-identical.** The main project has no v13+ scenes. |
| `evidence/isolated-snapshot-diff-vs-v22-after.json` | Compared with the isolated project as it stood after v22: **66 added (all v23), 0 changed, 0 removed.** |

Iterations:
- **`evidence/iteration1/`:** the sun was in the pilot's face in the spawn and plaza views, and the horizon turned a yellow-green band.
- **`evidence/iteration2/`:** the southern patrol orbit came 12.9 m from the range, and the B drones dipped to 6.6 m above a roof. Validation correctly failed it. The suites that passed on that replaced scene are archived with it.
- **Final:** orbits moved and drones raised, then every check was re-run on the final scene.

## Remaining gaps and limits

- **Not yet in the scene:** lifts and ziplines (vertical routes), the tunnel/underpass network, the rising-water event, base interiors and sabotage terminals.
- **Cockpit:** the cockpit at the approved 4.013 m Scout scale is the separate v21/RF02 path.
- **Flyers:** simple primitive silhouettes with no rotor animation, trails or sound. They are not solid, so shots pass through.
- **Shields:** static, with no shimmer animation.
- **Golden hour:** the lower sun makes longer shadows, so some road views are darker. Shadow distance is still 50 m.
- **No headset evidence:** none for comfort with moving flyers in peripheral vision, low-sun glare, performance or stereo.
- **Review:** no independent pixel review was run.
- **File names:** probe receipt filenames keep their earlier names; each `scene` field records v23.
