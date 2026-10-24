# Preserved reviewer discovery failures

These happened before check execution and did not change source. Original owner failures remain unmodified in slice-01/EVIDENCE.json and HANDOFF.md.

- Initial optional `.agents`, `.codex` and `tasks/coordination` path searches returned no matches/absent paths. The actual coordination packet was located through the named owner diary.
- A `cat` attempted `tasks/artifacts/cross-platform/2026-10-24-coordination/COORDINATION.md`, which does not exist (exit 1). Correct `COORDINATION-PROTOCOL.md` was subsequently read; leases were read and relevant owners/paths/resources summarized from parsed JSON.
- Optional shell discovery used `/tmp/*heavy*`; zsh reported `no matches found` and stopped that shell portion. The actual documented `/private/tmp/fhfh-heavy.lock` was checked directly and was absent (ls exit 1). No lock was created/removed or heavy check run.
- The first pin-verification shell ended with an optional probe for two alternative Node executable paths, which were absent (aggregate exit 1). The Python verifier itself completed 30/30 matching pins and wrote PINS.start.json. Actual `/usr/local/bin/node` was v22.11.0, npm 10.9.0. No Node installation was attempted.
- Several initial combined read outputs were truncated by tool budgets. The four complete short source/test files were read, the PRD's opening/relevant sections were read separately, and task/coordination requirements were inspected through bounded excerpts/parsed summaries. No unobserved output is claimed as test evidence.

Substantive checks were each run once. Vitest exit 1 is preserved: exactly two independent R1 expectations failed. Scoped TypeScript and ESLint exited 0. See COMMANDS.json and the original log files. No self-repair, weakened expectation or repeated broad suite occurred.
