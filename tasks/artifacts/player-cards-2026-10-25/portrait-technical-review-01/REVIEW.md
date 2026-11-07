# Independent portrait technical review

No actionable defects found in the seven-source portrait change or coordinated Team Colors default. Recommend technical acceptance of this local feature to Scout. This does not authorize publication, live data, premium activation, or changes to accepted source/math contracts. Scout retains final integration acceptance.

## Actual source comparison

Read the seven paths in `portrait-treatments-01/LEASE.json`, the frozen `source.patch`, original `before/` files, frozen `source-files/`, and direct display/export/sample contracts. Reconstructing the unified patch from preserved originals and frozen sources reproduced `source.patch` exactly. All five existing before-files match the lease hashes; the two new files had no before-files.

The current production delta against the frozen portrait candidate is exactly `PlayerCardShareStudio.tsx:21`, changing the initial style from `original` to `team-colors`. The only other changed file is its test: injected treatment mocks plus fresh/invalid/unavailable default assertions. Five other canonical files equal the frozen source copies. Both current Studio files also equal the final `team-colors-default-01/source-files/` copies. See `current-vs-frozen.patch` and `source-comparison.json`.

## Contract evidence

- `portraitTreatment.ts:22–56`: transforms copy input, preserve dimensions and each alpha byte, and reject malformed/over-two-million-pixel inputs before allocation of an output buffer. All 256 alpha values were independently exercised across Original and the three treatments, with deterministic repeated output and unchanged input. RGB-only filtering preserves the source silhouette and pose; it does not generate a new identity. Palette and nearest-neighbor behavior were inspected directly.
- `portraitTreatment.ts:63–90`: preparation starts from the original, checks dimension bounds before decode, validates decoded dimensions, checks cancellation around async work, hashes rendered PNG bytes, and releases canvas backing dimensions in `finally`. Work/storage are bounded by the fixed pixel limit and fixed export sizes. No measured heap/CPU benchmark or adversarial decoder audit was performed.
- `PlayerCardShareStudio.tsx:21–45`: fresh, invalid and inaccessible storage choose Team Colors. Explicit saved Original, Posterized, Pixelated and Team Colors all survive. Independent DOM probes covered all seven cases. A separate delayed-treatment probe confirmed that a rejected obsolete player treatment cannot replace or show an error over the current player's portrait.
- `PlayerCardShareStudio.tsx:54–78` and `shareExport.ts:20–46`: portrait identity is included in the displayed/export/prepared-file key; changes invalidate preparation; busy controls prevent concurrent selection changes. Export checks the selected snapshot, artwork hash, format, treatment provenance and embedded image before rasterization and again at asynchronous completion. Independent probes rejected a stale treatment and unknown GP, while accepting a partial snapshot with explicit missing-source and known-undefined explanations.
- `HeroPlayerCard.tsx` confines image-rendering treatment to the portrait image. The analytics remain SVG text/shapes in the unchanged Editorial component. The stored card PNGs' complete analytics regions (y=338 through 1019) are byte-identical across all three styles.

## Executed checks

One bounded review run after the author released the shared lock:

1. New independent Vitest file: **10/10 passed**, 0 failures. Only `portrait-technical-review-01/probes.test.tsx` ran; no author or historical suites were rerun.
2. Independent Sharp readbacks of the frozen portrait and card PNGs: **passed**. All three portraits are 1296×729 with **zero alpha differences** from the reviewed local Kaprizov original. Rendered hashes match each manifest; player identity and same synthetic snapshot agree; all card PNGs are 1200×1020; analytics pixels match; prepared-share fallback bytes equal the saved reload PNG.
3. Source/packet preservation: **106 files unchanged**; reconstructed portrait patch matches; final default-source copies match; the new default PNG SHA256 matches the browser receipt.

Execution used Node 22.11.0, existing npm/packages, one atomically owned `/private/tmp/fhfh-heavy.lock`, an artifact-local npm/cache directory, and no application writes. Fetch was blocked in the DOM probes. Existing images were read locally; there were no network, provider, production, browser/server, dependency-install, Git/index, or publication actions. Logs and exact commands are in `commands.json`, `run-0.log`, `run-1.log`, and `pixel-results.json`. One non-failing existing Node punycode deprecation warning appeared.

Reproduction from repository root:

```sh
python3 tasks/artifacts/player-cards-2026-10-25/portrait-technical-review-01/run-review.py
```

## Visual inspection and limits

Directly inspected actual pixels in the frozen `comparison.png`, `team-colors-card.png`, `missing-metric-card.png`, and the new `team-colors-default-01/default-card.png`. Pose/identity remain recognizable across the three treatments; the header treatment is isolated from clear analytics; the missing-source export retains its explanation; the new default output shows Team Colors. Pixel readbacks independently validate the saved artifacts rather than accepting the author's prose endorsement.

The author's browser-results receipts were inspected as supporting evidence, not independently rerun. Current-browser rendering, mobile behavior, actual OS share-sheet delivery and real-browser decode/canvas execution were not independently exercised in this review. Unit rendering injected prepared artwork; saved PNG verification covers the actual previously produced raster outputs. RGB-difference counts include hidden RGB normalization by the browser canvas and are not an identity or quality metric. All alpha bytes match exactly.

Only the new review directory and reviewer diary were written. Original portrait/hero/NST packets and canonical application sources were preserved. No nested worker was used. Actual Chef model/effort hierarchy remains unexposed and is not claimed verified. The bounded review is complete; no corrective source changes are requested.
