Independent re-review of `AUDIT-FIXES-REREVIEW-20261101.json`, the focused patch, current source/tests, regenerated preview and retained browser evidence.

**P2 closed: oversized warning exports now fail closed.** The original 321-character URL produces a readable non-exportable notice, no blank leading line, and a truncation marker. Both `assertAnalysisExport` and the actual `rasterizeAnalysis` entry point reject it before rasterization. Full warning text remains in the accessible description and manifest.

The separate 120-`W` case has one line and no truncation marker, but exceeds the 1120-unit content limit and is rejected by the geometry guard. Normal warnings and two 60-`W` words on separate lines pass. Missing `getBBox`, zero/negative/nonfinite widths, and width 1121 all reject. Token splitting alone is therefore no longer the acceptance criterion.

| Independent reproduction | Local SVG ink width | Export result |
| --- | ---: | --- |
| Ordinary producer warnings | 868 | Accepted |
| Original 321-character URL | 678 for the replacement notice | Rejected by truncation marker |
| One 120-`W` token | 1926 | Rejected by measured width |
| Two 60-`W` words | 963 | Accepted |

`reproduce.cjs` renders the actual current component and invokes the actual export guards. Geometry is independently measured with sharp/libvips and supplied to the DOM guard; this is not represented as native browser `getBBox`. `REPRODUCTION.json`, generated SVGs and PNGs preserve the exact cases. I visually inspected the replacement notice and wrapped-wide render. The PNGs here are audit renders, not exports obtained by bypassing a product rejection.

I also inspected the implementer's actual Chromium probe, its retained receipt, and verified all four successful PNG hashes/dimensions. Its native widths corroborate the independent rendering: ordinary 868.265625, wide 1925.453125, wrapped 962.734375. Its download record contains normal/wrapped and two retained BLSH PNGs, with no blocked-case download, HTTP request or page error. Fresh Chromium execution was not repeated in this environment: the earlier independent launch failed before navigation with SIGABRT/cleanup EPERM. No new browser success, automatic approval denial or browser escalation is claimed.

**P3 closed: retained and synthetic provenance is correctly distinguished.** Both `preview-entry.tsx` and regenerated `preview.html` contain the corrected notice naming retained NHL/BLSH captures, separately dated box comparisons and stale research. The old “All other data are synthetic” sentence is absent. Other selections retain their synthetic/unavailable labels. The retained browser receipt independently records the same notice and a 320px reflow check; I did not rerun that browser check.

**Verification and preservation:** 19 targeted tests passed (9 studio/export, 10 shared-goalie), with Node network denial and environment-file loading disabled. All four fix receipt hashes, all 16 candidate pins and all 78 protected baseline files match. Exactly the three declared application/test files changed from the original audit; the fourth change is the preview artifact entry. Ranking, short-sample, goalie producer/admission and retained BLSH calculation source remains unchanged. No held editor/source file was modified by this review.

No remaining finding in the two-fix scope. Existing custody/canonical integration, observed ranking population, real goalie/source qualification and other source-evidence gates remain open. This disposition does not adopt or deploy the candidate. No production/provider/database request, holdout access, source edit, push or deployment was performed. No denied, pending or uncertain operation arose in this re-review.
