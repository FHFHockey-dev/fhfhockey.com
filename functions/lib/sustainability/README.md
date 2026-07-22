# Sustainability Python Modules

These modules are offline-only and non-canonical for production sustainability serving.

The canonical runtime is the TypeScript implementation under `web/lib/sustainability/*` and `web/pages/api/v1/sustainability/*`. Python scoring and comparison utilities remain available for fixtures, research, and benchmarks, but persistence, incremental orchestration, snapshot reuse, run logging, locks, and retro-queue operations fail closed. A future production batch role requires a separate approved task and an exact reconciliation against the TypeScript contracts.
