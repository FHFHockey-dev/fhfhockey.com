# `vars.scss` Token Audit

This audit supports task `3.1` in `tasks-prd-fhfh-style-system-and-underlying-stats-restyle.md`.

## Canonical token families already present

- Page and surface bases exist: `$background-dark`, `$background-medium`, `$background-light`, `$surface-0`, `$surface-1`, `$surface-2`
- Core brand and semantic colors exist: `$primary-color`, `$secondary-color`, `$success-color`, `$warning-color`, `$danger-color`, `$info-color`
- Core text colors exist: `$text-primary`, `$text-secondary`, `$text-button`
- Primary typography roles exist: `$font-family-primary`, `$font-family-accent`, `$font-family-numbers`
- Core spacing exists: `$space-xxs` through `$space-xxxl`
- Core borders exist: `$border-primary`, `$border-secondary`, `$border-subtle`
- Shared radii exist, but in conflicting systems: `$border-radius-*` and `$radius-*`

## Duplicated or conflicting systems

### Breakpoints

- `vars.scss` currently carries three overlapping desktop breakpoint systems:
  - `$screen-*`
  - `$breakpoint-*`
  - mobile-specific `$breakpoint-mobile-*`
- `1024px` is used as the desktop start in one system while `$breakpoint-lg-min` is `1008px`, which creates an avoidable split.

### Radius tokens

- Two radius systems exist at once:
  - `$border-radius-sm`, `$border-radius-md`, `$border-radius-lg`, `$border-radius-xl`
  - `$radius-xs`, `$radius-sm`, `$radius-md`, `$radius-lg`
- The rewritten style guide examples already use `$radius-sm` and `$radius-md`, so these should become canonical and the `border-radius-*` set should become compatibility aliases if still needed.

### Surface and elevation tokens

- Flat surface tokens and gradient-heavy desktop surface tokens coexist in the same source:
  - flat / canonical direction: `$background-*`, `$surface-*`
  - legacy dashboard-intense direction: `$desktop-panel-bg`, `$desktop-surface-elevated`, `$gradient-accent-inline`, `$gradient-accent-radial`
- This conflicts with the new guide rule that gradients are sparse and not the baseline background treatment.

### Focus systems

- Multiple focus models exist:
  - `$focus-color`
  - `$shadow-focus`
  - `$focus-ring-desktop`
  - `$focus-ring-mobile`
- These should collapse into one canonical focus-ring token family plus optional device variants only if the distinction is still necessary.

### Shadow systems

- `vars.scss` currently has `$box-shadow-default`, `$shadow-hover`, `$shadow-focus`, and `$desktop-panel-shadow`.
- The guide examples also reference `$shadow-panel`, which does not yet exist.
- A single documented shadow ramp is needed for base panel, hover, and focus states.

### Typography naming

- The primary font families are usable, but there is still legacy naming drift:
  - canonical candidates: `$font-family-primary`, `$font-family-accent`, `$font-family-numbers`
  - compatibility alias: `$font-family-condensed`

## Duplicated mixin definitions

The following mixin names are defined twice in `vars.scss`:

- `border-base`
- `dark-container`
- `button-style`
- `table-base`
- `component-wrapper`

These are not duplicate tokens, but they are an important source of ambiguity because later definitions silently override earlier ones.

## Missing tokens required by the rewritten style guide

Cross-checking `fhfh-styles.md` against `vars.scss` shows two referenced tokens that do not currently exist:

- `$shadow-panel`
- `$border-soft`

These must be added in task `3.2` or the guide examples must be rewritten to match the canonical variable names.

## Legacy aliases that appear intentional and should likely remain temporarily

- `$text-color-primary`
- `$text-color-secondary`
- `$border-color-primary`
- `$border-color-secondary`
- `$text-primary-color`
- `$bg-dark`
- `$bg-light`
- `$border-color`
- `$color-yellow`
- `$color-green`
- `$color-red`
- `$color-brand-blue`
- `$text-muted`
- `$font-size-small`
- `$font-family-condensed`

These should be treated as compatibility aliases during normalization, not as the long-term canonical vocabulary.

## Canonical vs compatibility mapping for new work

Use the canonical names below for all new styling work. Keep the compatibility aliases only to avoid breaking older modules until they are migrated.

### Text

- Canonical:
  - `$text-primary`
  - `$text-secondary`
  - `$text-button`
- Compatibility aliases:
  - `$text-color-primary`
  - `$text-color-secondary`
  - `$text-primary-color`

### Borders and dividers

- Canonical:
  - `$border-primary`
  - `$border-secondary`
  - `$border-soft`
  - `$border-subtle`
- Compatibility aliases:
  - `$border-color-primary`
  - `$border-color-secondary`
  - `$border-color`
  - `$border-default`
  - `$border-separator`

### Surfaces and backgrounds

- Canonical:
  - `$background-dark`
  - `$background-medium`
  - `$background-light`
  - `$surface-0`
  - `$surface-1`
  - `$surface-2`
- Compatibility aliases:
  - `$bg-dark`
  - `$bg-light`
  - `$background-middle`
  - `$color-bg-dark-1`
  - `$color-bg-dark-2`
  - `$color-bg-dark-3`
  - `$color-bg-dark-4`

### Typography

- Canonical:
  - `$font-family-primary`
  - `$font-family-accent`
  - `$font-family-numbers`
  - `$font-size-sm`
- Compatibility aliases:
  - `$font-family-condensed`
  - `$font-size-small`

### Radius and shadows

- Canonical:
  - `$radius-sm`
  - `$radius-md`
  - `$radius-lg`
  - `$radius-control`
  - `$radius-card`
  - `$radius-panel`
  - `$shadow-panel`
  - `$shadow-hover`
  - `$shadow-focus`
- Compatibility aliases:
  - `$border-radius`
  - `$border-radius-sm`
  - `$border-radius-md`
  - `$border-radius-lg`
  - `$border-radius-xl`
  - `$box-shadow`
  - `$box-shadow-default`
  - `$desktop-panel-shadow`

### Semantic colors

- Canonical:
  - `$primary-color`
  - `$secondary-color`
  - `$success-color`
  - `$warning-color`
  - `$danger-color`
  - `$info-color`
- Compatibility aliases:
  - `$color-yellow`
  - `$color-green`
  - `$color-red`
  - `$color-brand-blue`

## Intentional temporary keep list

The following aliases should remain in place until the existing modules that reference them are migrated:

- text aliases: `$text-color-primary`, `$text-color-secondary`, `$text-primary-color`
- border aliases: `$border-color-primary`, `$border-color-secondary`, `$border-color`
- surface aliases: `$bg-dark`, `$bg-light`, `$background-middle`, `$color-bg-dark-*`
- typography aliases: `$font-family-condensed`, `$font-size-small`
- radius/shadow aliases: `$border-radius*`, `$box-shadow`
- semantic color aliases: `$color-yellow`, `$color-green`, `$color-red`, `$color-brand-blue`

## Cleanup candidates for task `3.2`

- Define a single canonical breakpoint system and alias the rest if required.
- Promote `$radius-*` as canonical and demote `$border-radius-*` to compatibility aliases.
- Add the missing `$shadow-panel` and `$border-soft` tokens.
- Replace gradient-first surface assumptions with flat-surface defaults and keep gradients as optional accent tokens only.
- Collapse focus and shadow naming into a documented, minimal ramp.
- Remove or clearly quarantine duplicate mixin definitions so `_panel.scss` can become the real shared surface primitive layer.

## Verification checkpoint for task `3.5`

- Every token currently referenced by `fhfh-styles.md` now exists in `vars.scss`.
- `fhfh-styles.md` currently references these shared tokens:
  - `$background-dark`
  - `$background-medium`
  - `$border-soft`
  - `$border-subtle`
  - `$color-white`
  - `$font-family-accent`
  - `$primary-color`
  - `$radius-md`
  - `$radius-sm`
  - `$shadow-panel`
  - `$text-primary`
  - `$text-secondary`
- No panel mixins are currently referenced directly inside `fhfh-styles.md` code snippets.
- `cssTestingGrounds.tsx` and `cssTestingGrounds.module.scss` do not exist yet, so sandbox verification is intentionally deferred until task `4.0`.
- The `underlying-stats` production pages exist, but the style-system restyle pass has not started yet, so production-page verification for the new canonical rules is deferred until task `5.0`.
- Shared-layer compile verification passed via `cd web && npm run build`.
