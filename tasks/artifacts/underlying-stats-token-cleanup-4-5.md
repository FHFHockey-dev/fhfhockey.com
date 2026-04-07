# Underlying Stats Token Cleanup

Task: `4.5 Reuse shared tokens and panel patterns from web/styles/vars.scss and web/styles/_panel.scss instead of introducing new local one-off styles.`

## What changed

Cleaned up the new landing-page style literals introduced during the `4.x` layout pass:

- added shared compact table-padding tokens in `/Users/tim/Code/fhfhockey.com/web/styles/vars.scss`
  - `$table-cell-padding-compact`
  - `$table-cell-padding-compact-mobile`
- updated `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss` to use:
  - `v.$table-cell-padding-compact`
  - `v.$table-cell-padding-compact-mobile`
  - existing spacing tokens for compact badge padding:
    - `v.$space-xs`
    - `v.$space-sm`

## What stayed intentionally unchanged

- The current working-tree shell-width override (`width: 90%`) remains untouched in this step because it appears to be a user-owned local experiment rather than a style-system change introduced by the `SoS` work.
- Older pre-existing local literals elsewhere in the file were not broadly rewritten; this task only cleaned up the new landing-page values introduced during the current workstream.

## Why

This keeps the landing-page density changes aligned with the style system:

- compact table padding is now a shared token instead of repeated local values
- compact pill padding reuses the shared spacing scale
- panel shells still rely on the canonical `panel-shell` mixin rather than new surface helpers

## Verification

- reviewed final diffs in:
  - `/Users/tim/Code/fhfhockey.com/web/styles/vars.scss`
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`
- verified the new compact table-padding tokens are consumed by the landing-page table rules

## Scope note

This was a style-system cleanup only. No runtime behavior, data, or page structure changed.
