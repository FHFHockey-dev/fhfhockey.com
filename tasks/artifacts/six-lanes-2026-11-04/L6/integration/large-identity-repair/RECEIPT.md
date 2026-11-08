# Large-tier identity correction — ready for Chef

Chef's short-height correction passes 1440×790. The next previously unrun 1920×1080 case fails only C02/C03 `playerMetaGrid` overflow; nine further cases were not run. Read `canonical-browser-short-height/browser.log`, and personally inspected the failure screenshot showing “ALEX FICTIONA” followed by a lone “L”, with biography pressed against the card bottom. The actual large-tier identity track remains 130px high, with 16px total vertical padding and an enlarged 28px name.

Only `web/styles/wigoCharts.module.scss` changed. Within the existing ≥1800px-wide/≥1000px-high fit tier:

- Portrait grid column: 96→80px.
- Column gap: 16→12px, recovering 20px for the name/biography column.
- Portrait dimensions: 96×112→80×96px, preserving the portrait/team identity and leaving more vertical room.

No font size, text, row allocation, matrix, chart, control, assertion or other breakpoint changed. The name retains its 28px large-tier treatment; biography retains existing sizes. The targeted correction addresses the observed orphaned final letter and the resulting shortage of biography height instead of hiding/truncating text or enlarging an unrelated row.

All nine pre-edit pins matched the short-height handoff. Distinct artifacts preserve previous evidence: `repair.patch`, `before-wigoCharts.module.scss`, and `PINS.json` with all nine before/after hashes. Only page style differs.

**No compile/lint/tests/server/browser after edit**, respecting Composer02 heavy priority. Ready for Chef's remaining browser cases together without first-failure stopping. This patch is an evidence-based width correction awaiting rendered verification, not a claim that large-tier fit or overall WiGO acceptance has passed.
