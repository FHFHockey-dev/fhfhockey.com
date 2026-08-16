# Stylesheet Organization and Safe Cleanup Plan

Scope: frozen audit snapshot `36536c3f1cbf065c34dc0ee5eceec2094e17d858`. This is a plan only; no stylesheet or consumer was changed.

## Current organization

The frozen tree contains 166 stylesheets and 84,475 lines: 159 SCSS files, seven CSS files, 157 module files, and nine global/support files. The lexical inventory found 13,482 selector fragments, 551 media queries, 488 Sass variable definitions, 168 CSS custom-property definitions with 572 uses, 37 mixin definitions with 340 includes, and 395 `!important` declarations. Full file-level metrics and consumers are in `evidence/style-metrics.json`; page ownership is in `evidence/route-style-ownership.jsonl`.

`web/pages/_app.tsx` establishes the application-wide order: `globals.css`, `vars.scss`, a side-effect import of `Home.module.scss`, then the global `TeamLandingPage/teamLandingPage.scss`. Storybook CSS is isolated under `web/stories/`. `vars.scss`, `mixins.scss`, and `_panel.scss` are support layers rather than page-owned styles. The remaining modules are primarily component or route owned.

The metrics are discovery evidence, not automatic cleanup authority. Sass selectors were parsed lexically without executing nesting or interpolation; no computed-specificity claim is made. A missing static consumer does not prove that a stylesheet is unused because global imports, Sass dependencies, D3/string-built classes, CMS output, and external tooling can be valid consumers.

## Justified consolidation work

1. **Resolve the exact game-detail duplicate (`FIND-STYLE-001`).** `web/components/GamePreview/GamePreview.module.scss` and `web/pages/stats/game/[gameId].module.scss` are byte-identical 451-line files with different active consumers. Choose component or route ownership first. Redirect one consumer, compare both game surfaces at desktop/tablet/mobile, run the nearest tests and type check, and only then retire the zero-consumer copy. Do not edit both copies independently while the decision is pending.

2. **Adjudicate the TeamLanding CSS/SCSS pair (`FIND-STYLE-002`).** `teamLandingPage.css` and `teamLandingPage.scss` normalize to the same 809-line content, while `_app.tsx` imports the SCSS path. Confirm that the CSS file is not generated, manually published, or consumed outside static imports. If SCSS is authoritative, remove the CSS copy only after build-input/history/owner checks and three-viewport comparison. Until then its cleanup status remains **Needs owner decision**.

3. **Consolidate breakpoint vocabulary semantically (`FIND-STYLE-003`).** The 551 media queries include 46 literal `480px` maximums and 33 literal `768px` maximums alongside 52 `$breakpoint-mobile-max` and 50 `$breakpoint-tablet` maximums. `vars.scss` also defines overlapping 640/641, 768, 1007/1008, and 1024 families. Inventory each condition's intended inclusive boundary before substitution; `480px`, `481px`, `767px`, and `768px` are not interchangeable. Migrate one ownership group at a time and verify its routes at 1440×900, 834×1112, and 390×844 before retiring an alias.

4. **Give PP TOI an owned responsive/accessibility path (`FIND-A11Y-003`).** `PPTOIChart.tsx` is hover-driven and `PPTOIChart.module.scss` has no media query. Add an explicit small-screen layout plus keyboard or table access in a later implementation task, then verify representative data at all three viewport classes. This is a targeted component correction, not authority for a wider redesign.

## Evidence that does not yet justify a rewrite

- The 100 repeated declaration-block groups are often ordinary layout or focus patterns. Consolidate only when the same semantic component contract repeats and the shared change would reduce demonstrated maintenance cost; do not build a utility layer from lexical similarity alone.
- `#07aae2` appears 111 times across 24 files and is already represented in `vars.scss`. A token migration is reasonable only where the literal means the same brand role; chart-series colors or externally defined team colors must remain independent.
- The 395 `!important` declarations show layering pressure, concentrated in `GameGrid.module.scss` (129), `Home.module.scss` (41), and `Forge.module.scss` (19). They are investigation targets only. Record an actual cascade defect and computed selector chain before removing an override or adding layers.
- The analyzer reported 22 directives after non-directive text across 11 files. Comments can trigger this lexical proxy, and no Sass compile failure was established. Normalize import/use order only when a real compiler warning, ordering defect, or touched-file migration requires it.
- Fifteen files have no direct static consumer in the import graph. That set includes intentional foundations (`globals.css`, `vars.scss`, `mixins.scss`, `_panel.scss`) and one already-adjudicated duplicate. No file should be labeled unused from this signal alone.
- Repeated dimensions are not token candidates by count alone: values such as `1px`, `8px`, `10px`, and `12px` can represent unrelated borders, geometry, and spacing.

## Safe migration sequence

1. Freeze the intended affected route set and current import graph; record the selected owner and rollback file for each consolidation.
2. Capture representative desktop, tablet, and mobile states for every affected route, including loading, empty, error, and interactive states where applicable.
3. Perform the exact game-detail merge as an isolated change; preserve class names and verify both consumers before removing a file.
4. Resolve the TeamLanding owner gate; if approved, migrate its single global import without combining this work with token or selector changes.
5. Reconcile breakpoint aliases by semantic boundary and ownership group, preserving off-by-one behavior explicitly.
6. Implement the PP TOI responsive/accessibility correction independently so behavior and visual regressions remain attributable.
7. Review color literals, declaration duplication, `!important`, and directive order only when a concrete defect or repeated maintenance cost is documented.
8. After each stage, rerun the nearest tests, TypeScript, the applicable lint scope, and three-viewport browser checks. Use a production build only when import resolution or Sass compilation cannot be verified more narrowly.

Rollback is file-local: restore the prior import and retained stylesheet copy for consolidation stages; restore the prior media condition/token alias for breakpoint stages. Do not batch deletions, global-order changes, and token rewrites into one migration.
