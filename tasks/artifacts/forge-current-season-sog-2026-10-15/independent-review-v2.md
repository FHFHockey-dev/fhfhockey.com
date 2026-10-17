# Independent re-review — current-season SOG expiry correction

Verdict: **ACCEPT the exact corrected four-file increment for bounded source integration.** The P2 expiry finding is resolved. No remaining actionable findings were identified in the focused correction. This acceptance does not authorize genuine source collection, producer execution, publication or release inclusion.

The original rejection remains unchanged at both `independent-review.md` and `rejected-v1/independent-review.md`, SHA-256 `3ae5d2a1a056e0c0e1f478132546c9c909fd45e069954da1cd92e353e1d4fa35`. This sidecar supersedes that verdict only for the corrected pins below.

## Correction assessed

`currentSeasonSogBaseline.ts:116–117` now compares the exact target start to the cutoff plus 24 hours using `timestampMicros`. When the target is the earlier bound it retains the original start string; otherwise it uses the exact millisecond-representable 24-hour bound derived from the generation `Date`. The existing microsecond target check still requires the start strictly after cutoff. A one-microsecond positive interval is therefore preserved instead of being rounded into an expired packet.

Five new synthetic controls assert positive one-microsecond intervals in UTC and an equivalent explicit offset, reject exact-start UTC/offset values, and reject a target one microsecond before cutoff. The normal expiry assertion now expects the unchanged original target string. The CLI source/test pair is byte-for-byte unchanged. Only the assembler and its test changed from the rejected candidate; the prior bounded assessment of source admission, conditional SOG aggregation, null participation/uncertainty and private exclusive output handling remains applicable.

## Exact accepted pins

| Path | SHA-256 |
| --- | --- |
| `web/lib/player-forecasts/currentSeasonSogBaseline.ts` | `fbe292390e8a9aa25845c30e9ff47a04f35849386fabdddfe3e5a9a32d3fdf43` |
| `web/lib/player-forecasts/currentSeasonSogBaseline.test.ts` | `8e4f1c541f242aae219973d6fd295780b8b02a90f19f1ac7a08448ce61565753` |
| `web/scripts/capture-current-season-sog-baseline.ts` | `be122c0f6f6dff32e483cca566bffb0d44421b63ce2388d4ba51ab96403d0dd2` |
| `web/scripts/capture-current-season-sog-baseline.test.ts` | `1bde29d9799f649f6bfa4f9b936def1131632c8ddb70ea26d5f1fcd8e4ff7f13` |

Artifact hashes observed at review:

- `candidate.sha256`: `fa24ec75b4fb0d0bee84b6176a7b0dde04e372316c43fae290109c3141eb1c65`
- `expiry-correction.patch`: `5b6b48beef1ac44c6553cffc2c6a55096332ffc5fad51db54a1410e87ed51539`
- `change.patch`: `5951637f85ddcbe8210d7e59e7f052dd49d4c4df2b00fcf469adf3ddd92a6b56`
- `verification.json`: `ce3f7c309f4acca1c8ff7ca740ff337c39f01263e1a50ec782b72a071100575d`
- `HANDOFF.md`: `36213f18156bf0e0dafa2b98d4bc5c02f74a9d2407c8a6d360961b4d14bf65c7`

All four current source pins match the manifest. The correction patch applies exactly to the preserved rejected source/test copies and reconstructs the two changed current files. Those before copies match the rejected pins; the two CLI pins are unchanged. The refreshed full patch contains exactly four additions and independently reconstructs all four current files byte-for-byte.

## Verification and limits

The retained author verification reports 36 passing synthetic tests, four-file ESLint exit 0/no warnings, and successful whitespace checks. The correction source, regression assertions and verification artifact were inspected. No tests or lint were rerun by this reviewer.

Reviewer actions were read-only source/artifact inspection, hashes and offline textual patch reconstruction. This sidecar is the only reviewer-written file. No source edits, compiler/build, browser/worker, genuine outcome reads, source acquisition, producer/model execution, database/provider/network actions or private-pilot evidence/label reads occurred.

The packet remains an unreleased local current-season conditional mean over the declared selected club-game window, with null participation and uncertainty, unavailable calibration and no public-use approval. Synthetic replay does not establish authentic receipts, original publication/correction availability, complete player-season history, forecast quality or consumer admission. Genuine collection/execution and release remain separately authorized steps; none is approved or performed by this review. No new compiler result or pilot action is implied.
