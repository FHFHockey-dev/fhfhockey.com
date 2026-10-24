# Saved pixel inspection

Inspected actual files with the image viewer: `slice-01/preview.png`, `qa-desktop.png`, `qa-mobile.png`, `qa-long-name.png`, `qa-missing.png`, `qa-partial.png`, and `qa-extra.png`. Their exact hashes are recorded in PINS.start/end. No new screenshot, browser session or HTTP request was created.

The exported PNG has a valid PNG signature and a 1080×1080 IHDR. It contains only the card: no search/select/download controls. The synthetic banner is prominent at the top; fabricated-cohort and numeric-magnitude cautions remain visible at the bottom. Four categories are visibly separate. The curated image includes GP, TOI, actual span, own-L10/All-Strengths labels, common cutoff, snapshot time and per-metric pool sizes.

Manual pixel read of the curated PNG, checked against the manifest and independently recomputed fabricated pools:

| Metric | Visible value | Visible rank / population | Visible percentile |
| --- | --- | --- | --- |
| ATOI | 21:21 | T-161 of 812 | 79.7 |
| SOG/60 | 11.80 | T-161 of 809 | 79.7 |
| iSCF/60 | 9.40 | T-160 of 803 | 79.6 |
| ixG/60 | 1.24 | T-160 of 800 | 79.6 |
| On-ice xGF/60 | 3.62 | T-157 of 791 | 79.7 |
| On-ice xG% | 58.7% | T-157 of 788 | 79.6 |
| IPP | 76.9% | T-157 of 785 | 79.6 |
| SH% | 14.6% | T-155 of 782 | 79.8 |

At saved desktop/export size, no clipped values, overlapping rows or footer collision were observed. The demonstrated long name wraps to two lines above team context. Extra-card content replaces the metric selection and stays within the same frame. The short-sample capture states 3 of 10, 64.0 min and the actual shorter dates with an amber warning. The missing capture shows an ixG em dash and source-game reason; its bar/rank disappears. The separately incomplete on-ice xG% pool retains 58.7% and replaces rank/bar with a coverage explanation.

**Design feedback, subject to TJ:** in the saved 390px mobile capture the square card scales to about 358px; native 21–23px SVG unit/rank/footer text becomes roughly 7–8 CSS pixels. It is dense at fit-to-width phone sharing size. The page supplies a text-size alternative, which helps page reading but is not embedded in the PNG. Consider fewer footer lines, more image text space, or another sharing composition before final export legibility acceptance. This is a limitation of the proposed design, not an arithmetic/data-state bug or a claim that TJ approved the layout.

The full-resolution image is readable and suitable for synthetic design review. This is not blanket accessibility, cross-browser, arbitrary-name, all-content-layout or final mobile-export acceptance. No new rasterization was performed by the reviewer. Saved PNG/desktop pixels, source inspection and a mocked rasterizer handoff test support semantic consistency; they do not establish byte-for-byte equality of every possible exported image.
