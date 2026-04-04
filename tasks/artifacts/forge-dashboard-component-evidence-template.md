# FORGE Dashboard Component Evidence Template

## Purpose

Normalize the evidence format used in final component-health records so each status summary can be compared directly.

## Required Fields

Every final component record should include:

1. `Status`
2. `Scope Audited`
3. `Component Intent`
4. `Serving Contract`
5. `Source Contract`
6. `Freshness Evidence`
7. `Source-To-UI Reconciliation`
8. `Degraded / Fallback Behavior`
9. `Observability`
10. `Status Rationale`
11. `Required Follow-Ups`

## Required Reasoning Style

- status must be explicit: `green`, `yellow`, or `red`
- rationale must name:
  - what is working
  - what is unsafe
  - why the final color is justified
- follow-ups must be phrased as concrete next actions, not vague concerns

## Required Evidence Expectations

### For `green`

- current freshness proof
- route/source/UI reconciliation proof
- degraded-state review
- observability proof

### For `yellow`

- identify the exact limiting factor preventing `green`
- show why the surface is still usable enough not to be `red`

### For `red`

- identify the specific unsafe condition
- show whether the failure is:
  - freshness
  - correctness
  - degraded-state honesty
  - route continuity
  - observability / ownership

## Notes

- route-family records may merge `Serving Contract` and click semantics when useful
- cross-cutting records may omit `Source Contract` only if they are explicitly synthesizing prior component evidence rather than auditing a new chain directly
