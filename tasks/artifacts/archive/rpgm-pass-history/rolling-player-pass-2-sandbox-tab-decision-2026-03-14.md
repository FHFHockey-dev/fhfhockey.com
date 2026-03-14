# Legacy Sandbox Placement Decision

Date: `2026-03-14`
Task: `6.3`

## Decision

Keep the legacy sustainability sandbox on `trendsDebug.tsx`, but move it behind a secondary tab instead of leaving it inline with the primary validation console.

## Why

- The validation console is now the authoritative pass-2 workspace.
- Leaving the sandbox inline made the page read like a mixed-purpose workbench instead of an audit tool.
- Moving the sandbox to a separate route would add extra routing churn without improving the current audit workflow.
- A secondary tab preserves the sandbox for existing experimentation while making the validation surface unambiguous by default.

## Implementation

- Added a top-level workspace toggle:
  - `Validation Console`
  - `Legacy Sandbox`
- Validation remains the default tab.
- Validation-only controls and panels stay visible only in the validation workspace.
- Legacy sandbox inputs and outputs render only in the sandbox workspace.
- The sandbox still hydrates from the currently selected validation row and player scope.

## Result

- `trendsDebug.tsx` now has a single primary purpose by default: rolling metric validation.
- The legacy model workbench remains available without competing with the audit panels.
- No new route was required.

## Verification

- `npm test -- --run pages/trendsDebug.test.tsx`
- `npx tsc --noEmit --pretty false`
