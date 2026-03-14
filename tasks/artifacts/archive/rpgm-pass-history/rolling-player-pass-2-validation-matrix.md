# Rolling Player Pass-2 Validation Matrix

## Purpose

This artifact defines the repeatable player matrix for pass-2 live validation.

It turns the PRD requirement into an explicit execution surface so later audit steps can choose the right player quickly for:

- healthy full-season validation
- injured or missed-games validation
- traded or multi-team validation
- heavy-PP validation
- line-context validation
- TOI / fallback validation

The matrix intentionally reuses the validated player core from the March 11, 2026 rolling-player reports unless pass-2 refresh work finds a materially better replacement.

Primary supporting evidence:

- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-family-reconstruction-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-disputed-metrics-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-context-label-validation-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md`

## Validation Matrix

| Archetype | Primary player | Season | Current role in pass 2 | Ready state from prior validation | Primary families to audit | Key blocker or caveat |
| --- | --- | --- | --- | --- | --- | --- |
| Healthy full-season skater | Brent Burns (`8470613`) | `20252026` | high-sample healthy control | `READY` after PP builder refresh | additive counts, ratios, weighted `/60`, TOI, territorial, historical baselines | PP-sensitive validation required builder refresh first |
| Injured / missed-games skater | Corey Perry (`8470621`) | `20252026` | missed-games denominator stress case | ready for all-strength / EV / PP / GP checks; PK still blocked | availability, participation, rolling denominators, ratio sanity under missed games | PK NST source tails remained stale |
| Traded or multi-team skater | Corey Perry (`8470621`) | `20252026` | traded-player season semantics anchor | allowed for GP / availability validation | season availability, rolling availability, cross-stint semantics, legacy `gp_pct_*` compatibility | visible upstream slice in prior notes lagged the reported later team change; pass 2 must re-check freshness before final signoff |
| Heavy-PP skater | Jesper Bratt (`8479407`) | `20252026` | PP-share and PP-role stress case | `READY` | `pp_share_pct`, PP support fields, PP context labels, PP-sensitive ratios | none in ready scope; use as the main PP validation anchor |
| Line-context validation skater | Seth Jones (`8477495`) | `20252026` | clean contextual-label comparison case with retained freshness proxy value | labels passed; PK-sensitive arithmetic still blocked | `line_combo_slot`, `line_combo_group`, line builder freshness behavior | PK-sensitive source tails remained blocked, but line labels themselves were validated successfully |
| TOI / fallback validation skater | Brent Burns (`8470613`) | `20252026` | weighted-rate and TOI-trust anchor | `READY` for refreshed weighted `/60` and TOI family comparisons | `toi_seconds`, TOI support fields, `sog_per_60`, `ixg_per_60`, weighted-rate denominator trust | pass 2 still needs per-row TOI source-trace visibility, not just family-level parity |

## Player Detail

### 1. Brent Burns (`8470613`)

Primary archetype ownership:

- healthy full-season skater
- TOI / fallback validation skater

Secondary coverage:

- low-PP contrast case for PP-share work
- ratio and weighted-rate healthy control
- historical baseline control

Why retained:

- prior family reconstruction passed across availability, participation, TOI, additive counts, weighted `/60`, finishing ratios, on-ice context, zone / usage, territorial, and historical baselines
- prior disputed-metric validation passed for ratio `lastN` families and `ixg_per_60`
- prior refresh workflow explicitly cleared the PP builder blocker, which makes Burns a stable “healthy but not PP-dominant” case

Best audit uses:

- additive source-selection spot checks
- TOI denominator reconstruction
- weighted-rate component validation
- canonical-versus-legacy ratio parity

Pass-2 caution:

- do not reuse stale pre-refresh Burns rows from earlier reports
- use refreshed rows only, especially for PP-context comparisons

### 2. Corey Perry (`8470621`)

Primary archetype ownership:

- injured / missed-games skater
- traded or multi-team skater

Secondary coverage:

- secondary PP-role example
- denominator-stress case for availability and participation semantics

Why retained:

- prior disputed-metric validation used Perry as the traded-player GP / availability case and passed in the refreshed ready scope
- prior notes explicitly identify Perry as the clearest proof that season GP semantics break under a team change
- prior refresh workflow concluded Perry is ready for all-strength, EV, PP, and GP / availability checks even though PK remained blocked

Best audit uses:

- canonical availability versus legacy `gp_pct_*`
- current-team rolling denominator validation
- season / 3YA / career availability and participation semantics
- cross-stint or trade-sensitive interpretation review

Pass-2 caution:

- PK-sensitive validation was previously blocked by stale source tails
- pass 2 must confirm whether the reported later team change is now present in refreshed upstream rows before final “traded player” signoff

### 3. Jesper Bratt (`8479407`)

Primary archetype ownership:

- heavy-PP skater

Secondary coverage:

- ready-case ratio validation
- contextual PP role validation
- support-field validation for PP share

Why retained:

- prior family reconstruction passed across every compared family
- prior disputed-metric validation used Bratt as the main PP-share case and passed
- prior targeted recompute showed `pp_share_pct_total_last20` matching source-derived `pp_share_pct_last20` exactly on a fresh row
- prior context-label validation showed `pp_unit` matching builder rows with zero mismatches

Best audit uses:

- `pp_share_pct` numerator / denominator reconstruction
- builder-versus-fallback PP-source review
- PP role context panel validation
- heavy-usage stress tests for ratio windows

Pass-2 caution:

- earlier missing-row issues were target freshness issues, not formula issues
- always confirm the player’s stored row is the fresh post-recompute slice before using Bratt as a confidence anchor

### 4. Seth Jones (`8477495`)

Primary archetype ownership:

- line-context validation skater

Secondary coverage:

- incomplete-tail proxy
- freshness-blocked comparison case
- low-PP contrast case

Why retained:

- prior context-label validation passed cleanly for `line_combo_slot` and `line_combo_group`
- prior disputed-metric workflow explicitly retained Jones as the incomplete-tail proxy
- prior freshness workflow concluded Jones should remain in the matrix because he is useful for blocker-aware validation and mismatch classification

Best audit uses:

- line builder trust validation
- stale-tail blocker demonstrations
- distinction between “row refresh succeeded” and “upstream source tail is still incomplete”

Pass-2 caution:

- Jones is not the primary arithmetic signoff player for PK-sensitive families until source tails are fresh
- use Jones to validate blocker handling and freshness diagnostics, not as a proof that blocked metrics are wrong

## Coverage Mapping by Family

- Availability / participation
  - primary: Corey Perry
  - secondary: Brent Burns
- TOI
  - primary: Brent Burns
  - secondary: Jesper Bratt
- Surface counting stats
  - primary: Brent Burns
  - secondary: Corey Perry
- Weighted `/60`
  - primary: Brent Burns
  - secondary: Jesper Bratt
- Finishing / shooting
  - primary: Brent Burns
  - secondary: Corey Perry
- Expected / chance metrics
  - primary: Brent Burns
  - secondary: Jesper Bratt
- On-ice context
  - primary: Brent Burns
  - secondary: Corey Perry
- Territorial / possession
  - primary: Brent Burns
  - secondary: Seth Jones
- Power-play usage
  - primary: Jesper Bratt
  - secondary: Corey Perry
- PP role / PP unit context
  - primary: Jesper Bratt
  - secondary: Corey Perry
- Line / role context
  - primary: Seth Jones
  - secondary: Brent Burns
- Historical baseline columns
  - primary: Brent Burns
  - secondary: Corey Perry
- Freshness / trust / fallback behavior
  - primary: Seth Jones
  - secondary: Corey Perry

## Execution Rules

- Use this matrix as the default player set for pass-2 validation examples.
- A player may satisfy multiple archetypes, but each required archetype must have one named primary owner in the final audit.
- If pass-2 freshness work uncovers a clearly better traded-player or TOI-fallback case, the replacement is allowed only if:
  - the reason for replacement is written into the main audit rationale
  - the replacement improves one of the required archetype proofs materially
  - Seth Jones remains available as the explicit incomplete-tail or freshness-blocked proxy unless another player is better for that exact blocker role
- Final live validation examples should pull from this matrix rather than choosing ad hoc players family by family.

## Pass-2 Recommendation

Proceed with this primary matrix unless refresh work produces a materially cleaner traded-player example than Corey Perry or a materially better blocked-tail proxy than Seth Jones.

That keeps pass 2 aligned with the already-validated March 11 evidence while still leaving room for a targeted replacement where the current matrix is explicitly caveated.
