# Portrait treatments — frozen local checkpoint

Three actual Kaprizov cards are ready for TJ's checkpoint feedback: posterized, pixelated and team colors. This is a local synthetic-stat artwork candidate, not live-player statistical or production acceptance.

- Compare: http://127.0.0.1:3125/player-cards/portraits
- Interactive style selection / PNG / Social Share: http://127.0.0.1:3125/player-cards
- Actual exports: `posterized-card.png`, `pixelated-card.png`, `team-colors-card.png`; each has a matching `*-manifest.json`. `comparison.png` contains the three exported cards side by side. `posterized-social-square.png`, `phone-card.png` and `phone-page.png` cover square/mobile.

## Source and input scope

Lease `CODEX-PLAYER-CARDS-PORTRAIT-TREATMENTS-20261025` grants exactly seven files in CHANGED-FILES.json: two new portraitTreatment module/test files, and five transferred HeroPlayerCard/PlayerCardShareStudio/shareExport sources/tests. Source.patch is against preserved before/ bytes; source-files/ contains final candidate copies. No Editorial, math/window/rank/NST, shared auth/navigation/route, asset, dependency or batch edits.

TJ's direct local JPEG and PNG attachments were individually inspected; LOCAL-REFERENCES.json preserves paths, input identities, bytes and hashes. This supersedes the earlier Library input blocker. HANDOFF-INPUT-BLOCKED.md and all failed input-transfer evidence remain unchanged; no Library retry or output upload occurred, and no output Library IDs exist. Original reviewed Kaprizov/Matthews cutouts remain byte-identical. The roster805 batch was not processed or consumed.

The pure RGB transforms preserve every input alpha byte and dimensions. Posterization quantizes six brightness bands while retaining source hue. Pixelation samples nearest source RGB in scaled blocks, falls back to original RGB at transparent boundaries, and uses nearest-neighbor display rendering. Team-color flattening maps quantized luminance through dark/primary/secondary team colors from teamsInfo.ts and FHFH off-white. No new facial/jersey/equipment geometry is generated. Original photo remains an option.

Treatment choice persists locally with storage failure fallback; selected style/version/source-alpha/rendered hash is retained in the manifest and SVG export assertion. Stale transformation results are cancelled/ignored. The prepared Social Share file is invalidated by style changes. Controls remain outside exported artwork. Missing-source explanation and unknown-GP export block remain intact.

## Actual validation

Commands from repository root, wrapper executes in web with Node22.11.0 and atomically owns/releases the shared heavy lock:

- `python3 tasks/artifacts/player-cards-2026-10-25/portrait-treatments-01/run-check.py tests`: **19/19 passed**, including existing editorial/export/UI controls and new deterministic alpha/bounds/persistence checks.
- `.../run-check.py types`: scoped TypeScript **passed** on final source.
- `.../run-check.py lint`: seven-file ESLint **passed**; final nearest-neighbor image attribute also checked by TypeScript and browser.
- `.../run-check.py render`: self-contained offline fixture built using existing esbuild/sass, no app build/dependencies.
- `.../run-check.py browser`: **4 grouped offline Chromium checks passed**, zero HTTP attempts/page errors. All three portraits had zero alpha differences, equal1296x729 dimensions and distinct rendered hashes. All three card PNGs are1200x1020 with identical snapshots and byte-identical analytics-region pixels. Styled share fallback equals its same displayed-instance PNG. Missing reasons/unverifiedGP, persisted selection, square export and390px controls verified. Recorded treatment-selection-to-ready41/49/50ms on this Mac; not a device-wide performance claim.

Pixel buffers are bounded to2million pixels, original assets are reused, and one output canvas is released after each transform. Browser/SVG raster resampling may differ between reloads despite identical filtered-portrait bytes; cross-session whole-PNG binary reproducibility is not claimed. Same-instance sharing/export consistency is verified. First overlystrict cross-reload PNG assertion and hidden-control measurement failure are retained; the diagnostic confirmed identical portrait hashes, and corrected tests compare the proper displayed instance and visible controls. Initial AbortSignal compatibility/test typing corrections and sandbox launch failure are retained too.

Actual posterized full card, three-card comparison and phone image were visually inspected. Primary identity/values remain clear; the dense provenance/footer still needs zoom on a phone, inherited from accepted layout. No layout overhaul was made in this treatment checkpoint.

## Preservation and preview lifecycle

99 old hero/NST source/artifact pins matched (the five transferred files checked against their exact preserved before copies); zero unexpected changes. Parent still owns independent visual/source acceptance. The previous hero packet is immutable and its shared-navigation integration warning still applies: replay its minimal link patch onto the released file, never replace the old canonical whole file.

Fresh listener/command guard replaced only owned PID30284 with PID44618 on127.0.0.1:3125. Five local GETs returned exact expected bytes/hashes for current preview, comparison, prior hero, functional and editorial routes. Runtime.json records these receipts. Separate process inspection confirmed PID44618, PPID1, PGID44618, noTTY after launcher exit; no active exec session. Host/environment shutdown ends it; no autorestart/system changes. A transient executor disconnect occurred before handoff and recovered; no process was touched while disconnected.

## Independent adapter result and smallest proposed read

Fresh Astra reviewer inspected the frozen offline NST mapper and ran six independent grouped probes once: all passed, no actionable defect, all39 tracked source/author packet pins unchanged. Report and probes: `../observed-adapter-01-review/REVIEW.md`. Lead inspected report and actual probes; Scout owns final acceptance. This accepts no real history/finality/model/league pool assertions.

Proposed, **not executed**: one read-only SELECT on the existing FHFH Supabase project, only public.games and public."statsUpdateStatus", for Kucherov8476453's five already captured games on October13,15,17,20,23,2026. Return at most five rows to check season/game identity and completion manifests;5-second statement timeout,1-second lock timeout, one execution, no retries, no writes/providers/private data/secrets. Exact SQL and IDs are in `../observed-adapter-01/PROPOSED-READ-ONLY-COMPLETION.sql`; parent reconfirms project/gets any necessary approval. Ingestion completion is not actual game-end time; this read cannot establish complete history, model semantics or all-NHL ranking coverage.

## Next action / remaining gates

Pause visual propagation at this comparison for TJ's preference. Parent independently reviews the seven-file candidate, then decides integration; hero/share and NST acceptance remain separate. Full public search, supported live adapter/provenance/history/population, device-native share behavior, image rights/source exceptions, and premium business split remain gates. No live/premium activation, external upload/publication, database query, deployment, Git mutation or new batch inference performed.
