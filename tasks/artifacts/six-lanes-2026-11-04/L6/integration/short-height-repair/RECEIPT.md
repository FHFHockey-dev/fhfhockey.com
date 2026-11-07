# Short-height matrix repair — ready for Chef

Chef's exact first-repair pins passed 1280×800 and 1440×900, then failed only C12 `.matrixBand` overflow at 1440×790. Ten remaining cases did not run. Read `canonical-browser-repair/browser.log`, `browser-results.json`, and personally inspected the populated failure screenshot: the bottom DIFF row is clipped. This is actual layout evidence, superseding the earlier worker launch restriction. No page errors were reported; blocked-resource console diagnostics remain available.

Only `web/styles/wigoCharts.module.scss` changed in this additional, explicitly authorized repair. All nine source pins matched before editing. Added one media rule for width ≥1400 and height ≤859, scoped further to `.wigo-one-page.wigo-fit`:

`grid-template-rows: auto 80px 60px minmax(130px, 1fr) 188px max-content;`

Compared with that tier's previous `auto 90px 66px minmax(130px, 1fr) 188px auto`, this reclaims 16px from identity/production and reserves the last track's full intrinsic content height. The matrix band previously could shrink inside the remaining `auto` track despite the table requiring its complete two header/eight body rows. A `max-content` track makes that demand explicit; no clip/scroll/overflow exception hides it. Identity's existing 64px headshot and labels remain intact; production keeps its complete four metric pairs, font sizes and markup. The selected-stat/ratings/radar spans share the modest height reduction; trend plots retain their 130px minimum and the driver/context row retains 188px.

Passing 1280×800 is outside the width condition; passing 1440×900 is outside the height condition. Their styles are unchanged. Wider short windows use this compact tier, while shorter windows that already enter flow mode do not match the fit selector. Full matrix/consistency content, labels ≥11px, controls/data and all existing test assertions remain unchanged.

Exact repair-only patch: `repair.patch`; before snapshot: `before-wigoCharts.module.scss`; all nine before/after pins and patch digest: `PINS.json`. Prior evidence was not overwritten.

**No tests, compile, lint, server or browser after edit**, respecting the shared-resource hold. Ready for Chef's unchanged offline browser rerun. It must verify the new intrinsic matrix allocation and long-name/no-player/partial-coverage behavior, not infer fit from this source calculation. This is a narrow allocation proposal, not final visual acceptance; any remaining measured constraint returns to Chef.
