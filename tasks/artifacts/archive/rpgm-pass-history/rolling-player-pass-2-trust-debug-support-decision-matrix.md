## pass-2 trust/debug-support decision matrix

Sub-task: `5.4`

This artifact determines whether missing trust/debug-support data should remain derived at read time or should become future persisted support columns or required API payload additions.

## Decision Summary

Default rule after pass 2:

- recompute-time trust state, source provenance, freshness state, and validation helpers should stay derived at read time and move into the debug validation payload
- persisted schema expansion should be reserved for support data that is either:
  - impossible to reconstruct efficiently from existing stored/source rows during inspection, or
  - needed as first-class support parity across the stored table itself rather than only in the debug console

In practice, most current gaps belong in the validation payload, not in new columns.

## 1. Keep derived at read time and expose through API payload

These surfaces already exist in helper logic, merged source rows, diagnostics, or recompute traces and do not need to become permanent row columns.

### TOI trust and fallback trace

Decision:

- keep derived at read time
- add to validation payload, not table schema

Why:

- TOI source choice, rejected candidates, trust tier, fallback-seed origin, and WGO normalization are recompute-time explanations of how a stored TOI result was chosen
- they are high-value for validation, but low-value as long-lived row columns on every stored record
- the current debug gap is visibility, not inability to compute the data

Required surface:

- validation payload additions under `contracts`, `helpers`, or a dedicated TOI-trace section

### Additive source precedence

Decision:

- keep derived at read time
- expose through validation payload

Why:

- NST-versus-WGO precedence is already encoded in row assembly and source-selection helpers
- storing a per-field provenance column for every additive metric would add large schema weight for mainly debug-only value

Required surface:

- per-row source trace in the validation payload for selected metrics or focused rows

### PP-share mixed-source provenance

Decision:

- keep derived at read time
- expose through validation payload

Why:

- the missing information is per-game denominator provenance inside a selected window
- this is a debug/reconstruction aid and is naturally computed from merged source rows plus PP-share helper behavior
- it is not necessary as a permanent persisted row column if the validation payload exposes it correctly

Required surface:

- per-game PP-share component provenance and mixed-source window warnings in the payload

### PP unit trust and line-context trust

Decision:

- keep derived at read time
- expose through validation payload

Why:

- current stored labels are already persisted
- the missing piece is whether the label is trusted, stale, or source-missing for the selected inspection slice
- that is a freshness/debug concern, not a row-schema requirement

Required surface:

- validation payload trust flags plus freshness blockers

### Coverage, stale-tail, completeness, and suspicious-output diagnostics

Decision:

- keep derived at read time
- expose through validation payload and script surfaces

Why:

- these are inherently run- or slice-scoped diagnostics
- persisting them in every rolling row would make freshness/debug state stale by design

Required surface:

- expanded diagnostics payload
- repeatable diagnostics script/API path

### Formula metadata, contract summaries, window membership, and copy-helper strings

Decision:

- keep derived at read time
- expose through validation payload

Why:

- these are display and audit-support artifacts derived from the current helper contracts and selected row scope
- storing them in the table would duplicate logic and increase schema drift risk

Required surface:

- fill the currently null `contracts`, `formulas`, `windows`, and `helpers` payload sections

## 2. Candidate for future persisted support columns

These are the narrow areas where schema expansion may be justified because stored support parity is currently weaker than it should be.

### Dedicated `on_ice_sv_pct` support components

Decision:

- candidate for future persisted support columns
- payload-only fallback is acceptable if schema growth is rejected

Why:

- `on_ice_sv_pct` currently lacks dedicated numerator / denominator support fields
- reconstruction is still possible from `oi_sa` and `oi_ga`, but support parity is weaker than for other ratio families
- this is the clearest case where persisted support may improve the stored contract itself, not just the debug console

Preferred path:

- first evaluate whether dedicated support columns materially improve audit clarity
- if not, guarantee first-class reconstruction helpers in the validation payload instead

### All-scope and `lastN` weighted-rate support components

Decision:

- optional persisted support candidate
- payload precomputation is the preferred first move

Why:

- weighted-rate support fields exist only for `season`, `3ya`, and `career`
- `all` and `lastN` scopes still require reconstruction from additive companions plus TOI
- this is a legitimate support-parity gap, but likely solvable more cheaply in the payload first

Preferred path:

- first add normalized payload support for all-scope and `lastN` numerator / denominator components
- only add columns later if repeated audit use proves payload-only support is insufficient

## 3. Do not persist

These should explicitly not become row columns.

- readiness status (`READY`, `READY_WITH_CAUTIONS`, `BLOCKED`)
- next recommended action
- copy-helper outputs
- stale-tail counts
- per-run suspicious-output summaries
- temporary mixed-source caution labels

Why:

- they are slice-specific, freshness-sensitive, or presentation-specific
- persisting them would create stale metadata and contract drift

## 4. Final posture for implementation planning

Recommended implementation order:

1. fill the validation payload gaps for trust/debug metadata
2. keep diagnostics and provenance derived at read time
3. add persisted support columns only for the small set of support-parity gaps that remain painful after payload expansion

Net conclusion:

- future API payload additions are required
- future persisted support columns are optional and should stay limited to `on_ice_sv_pct` support parity and possibly all-scope / `lastN` weighted-rate support parity
- the rest of the missing trust/debug surface should remain derived, not stored
