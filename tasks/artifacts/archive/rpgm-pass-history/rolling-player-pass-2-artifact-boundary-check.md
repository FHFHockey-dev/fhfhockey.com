# Rolling Player Pass-2 Artifact Boundary Check

## Purpose

This artifact enforces the pass-2 rule that the audit leaves behind two separate outputs with non-overlapping responsibilities:

- `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`
- `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md`

It exists to prevent rationale, remediation ideas, and optimization work from leaking into the strict formula ledger.

## Artifact Contracts

### 1. Formula ledger

File:

- `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`

Allowed per-entry content:

- emoji status
- metric name
- formula

Forbidden content:

- rationale
- validation prose
- freshness notes
- dependency notes
- action items
- optimization suggestions
- remediation notes
- schema recommendations
- headings between metric entries

### 2. Action-items backlog

File:

- `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md`

Required per-entry content:

- title
- category
- priority
- affected metrics or fields
- affected files
- problem
- recommended action
- expected benefit
- blocker status
- source of discovery
- status

Allowed content:

- correctness fixes
- naming cleanups
- fallback hardening
- debug visibility improvements
- validation-payload additions
- freshness and recompute workflow improvements
- downstream compatibility follow-ups
- performance improvements
- test coverage follow-ups
- optional enhancements

Forbidden content:

- formula-only ledger entries with no action
- detailed family rationale better suited for the main audit artifact

## Current Verification State

### Formula ledger check

Verified against the current file contents:

- entries are flat list items only
- each entry uses the `emoji + metric name + formula` shape
- no headings or prose appear between entries
- no action recommendations appear in the file
- no rationale or validation notes appear in the file

Current result:

- `PASS`

Additional verification:

- the formula ledger remains flat-list only through the final pass-2 audit state
- optional enhancements such as `primary_assists`, `secondary_assists`, `penalties_drawn`, `penalties_drawn_per_60`, and `pp_toi_seconds` appear only in the action backlog and the main audit’s `Suggested Metric Additions` / `Actionable Findings Backlog` sections, not in the formula ledger as action prose
- no schema cleanup, debug-console optimization, freshness, performance, or test-coverage recommendations appear in the formula ledger

### Action backlog check

Verified against the current file contents:

- backlog contains implementation-oriented findings rather than metric-ledger entries
- entries capture concrete follow-up work for TOI trace visibility, PP-share provenance, alias ambiguity, support-field gaps, GP semantic ambiguity, validation payload work, and test coverage
- recommendations and expected benefits appear only in the backlog file, not in the formula ledger

Current result:

- `PASS`

Additional verification:

- schema, observability, freshness, downstream-compatibility, performance, test-coverage, and optional-enhancement follow-ups all remain in the action backlog
- no backlog entry is being used as a formula-ledger surrogate
- the main audit summarizes backlog groups without collapsing them back into the formula ledger

## Ongoing Enforcement Rules

- Every audited metric must have at most one formula-ledger entry and that entry must stay formula-only.
- A metric may also produce a rationale entry in the main audit artifact.
- A metric or field must produce a backlog item whenever the audit discovers a concrete improvement opportunity.
- If content can be phrased as “what should be changed,” it belongs in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md`, not in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`.
- If content can be phrased as “what the metric means or how it was validated,” it belongs in the main audit artifact, not in either standalone audit-output file.
