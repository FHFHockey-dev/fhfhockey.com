# Game Grid refactor

Implement the approved TypeScript and mockup-based redesign at `/shiftChart`, preserving query parameters and shared site chrome. Completed-game replay is the target; live polling is deferred.

Use one typed, validated NHL data load for chart, cursor-relative score/shots/TOI, active-player-first ordering, goals, special teams, and full-game matrices. Handle missing shifts, stale responses, overtime and shootouts explicitly. Keep matrix standalone consumers compatible. Match the mockup's compact dark panels and responsive two-column composition; add timeline and per-team matrix filters, keyboard seeking and reduced-motion support.

Acceptance: focused model/matrix tests, fixture-backed browser interactions and responsive visual inspection, TypeScript and targeted lint. No new dependencies, database changes, deployments or unrelated edits.
