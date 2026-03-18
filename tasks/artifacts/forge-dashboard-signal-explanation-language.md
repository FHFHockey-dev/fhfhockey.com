# Forge Dashboard Signal Explanation Language

## Purpose

Make the player insight sections self-explanatory at first glance so users do not have to infer whether a card is describing trust, regression risk, or short-term momentum.

## Language Contract

- `Trustworthy` means a rise still looks skill-backed and luck pressure remains manageable.
- `Overheated` means the player is running beyond the expected band and carries clearer regression risk.
- `Short-term only` means the signal is useful for current form or movement, but it is not a sustainability verdict.

## Applied Surfaces

- `Sustainable vs Unsustainable`
  - added a two-part guide for `Trustworthy` and `Overheated`
  - kept the row-level trust and heat badges
  - preserved short driver-based reason text
- `Hot / Cold` and `Trending Up / Down`
  - added a guide for `Short-term only`
  - clarified that hot/cold and movement tabs do not replace sustainability
  - tightened row reason text so it explicitly reads as momentum or movement language

## Why

- The dashboard is intentionally dense.
- Dense layouts only work when the meaning layer is explicit.
- Users should not need to already know the internal sustainability vocabulary to interpret the page.

## Guardrail

- Future player-insight work should add meaning through this shared explanation layer before adding more badges or more score columns.
