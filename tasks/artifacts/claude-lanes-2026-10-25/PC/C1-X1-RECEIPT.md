# C1-X1 closed: raw evidence validator restricted to the trusted loader

Claude C1 session, 2026-10-25T18:33Z. Closes finding X1 in [C1-CROSSCHECK.md](C1-CROSSCHECK.md). Not committed (Codex commits). No Git operations, no GIT_DIR, and no player-cards source edits.

## File changed (granted for this ticket)

| File | Before sha256 | After sha256 | Change |
| --- | --- | --- | --- |
| `web/eslint.config.mjs` | `47974c70d20250ef3a11d698318026e2bd172589074956e7b89885520b623af6` | `9522bca670fd1ab0b222355ba28ff22b09c5981b01e042ad93c2e21c0ac5f6d8` (3922 bytes) | +24 lines: one appended config block |

The diff is in `C1-X1/eslint.config.mjs.diff` (sha256 349c3ad7…). The new block:

- **`files`:** `**/*.{js,jsx,mjs,cjs,ts,tsx}`. These are the extensions already linted; see the correction below.
- **`ignores`:** `lib/player-cards/evidenceLoader.ts` and `lib/player-cards/evidenceBundle.test.ts`.
- **Rule:** `no-restricted-imports: error`, with `patterns: [{ group: ["**/evidenceBundle", "**/evidenceBundle.*"], importNames: ["validateEvidenceBundle"] }]`.
- **Message:** "Use validateAdmittedEvidence from player-cards/evidenceLoader; a caller-built index must never reach the raw validator."

## Proof (isolated probe tree, never in the repo)

The probe tree was `/private/tmp/fhfh-c1-x1-probe/web`: copies of the config, tsconfig, package.json and `lib/player-cards/`, with node_modules symlinked. It was removed after the run. Probe sources are kept as evidence in `C1-X1/probe-files/`; they are artifacts, not linted repo code.

| Probe | Import form | Expected | Result |
| --- | --- | --- | --- |
| `lib/probe/relative.ts` | `../player-cards/evidenceBundle` named | fail | **error** |
| `lib/player-cards/probeSameDir.ts` | `./evidenceBundle` named (same directory) | fail | **error** |
| `components/probe/Alias.tsx` | `lib/player-cards/evidenceBundle` (tsconfig alias) | fail | **error** |
| `pages/api/probe-namespace.ts` | `import * as …` namespace | fail | **error** |
| `lib/probe/reexport.ts` | `export { validateEvidenceBundle } from …` | fail | **error** |
| `lib/probe/withExtension.ts` | `…/evidenceBundle.ts` with alias rename | fail | **error** |
| `lib/probe/typesOnly.ts` | `import type { RetainedReceipt, EvidenceResult }` | pass | pass |
| `lib/probe/dynamic.ts` | `await import(…)` | not covered (limitation) | pass |

The forbidden-form run gave 6 errors and 0 warnings (`C1-X1/probe-lint.log`, sha256 63c0acb0…).

- **Allowed files:** `evidenceLoader.ts`, `evidenceBundle.test.ts`, `evidenceLoader.test.ts`, `evidenceAdmissions.ts` and `evidenceBundle.ts` exit 0 (`C1-X1/allowed-lint.log`, empty).
- **Negative control:** with the `evidenceLoader.ts` exemption removed in the probe copy only, `evidenceLoader.ts:6:10` errors. So the allow-list, not a pattern miss, is what lets the loader through.

## Checks on the canonical tree

| Check | Result | Log |
| --- | --- | --- |
| `npx eslint lib/player-cards` (cwd `web/`) | **PASSED**: exit 0, no output | `C1-X1/player-cards-lint.log` (empty) |
| `npm run lint` (full, under `/private/tmp/fhfh-heavy.lock`, 18:32:15–18:32:36Z) | **PASSED**: exit 0, 0 errors, 69 warnings, all pre-existing | `C1-X1/full-lint.log` sha256 a902c955… |

The 69 warnings break down as:

| Count | Rule |
| --- | --- |
| 53 | `@next/next/no-img-element` |
| 8 | `react-hooks/exhaustive-deps` |
| 3 | `import/no-anonymous-default-export` |
| 5 | unused-disable-directive reports |

They are pre-existing by construction: the new block adds a single error-level rule, and the log has 0 `no-restricted-imports` hits. The full lint ran over the current working tree, which includes other lanes' uncommitted `web/` edits.

**Correction made during the ticket.** My first glob also listed `mts,cts`. That made ESLint start linting `lib/sources/decisionsReference/adapter.d.mts`, which the shared config doesn't route to the TS parser. The full lint then exited 1 with one `Parsing error: Unexpected token type` (70 problems = that error + the same 69 warnings). I narrowed the glob to the already-linted extensions, and all probes and lints above were rerun on the final config.

## Limits

- **Dynamic imports:** `import("…/evidenceBundle")` and `require(…)` are not caught by `no-restricted-imports`. No such call exists today. If one appears, `no-restricted-syntax` or a source-scan test could cover it.
- **`.mts`/`.cts` files:** not covered, matching the existing lint scope.
- **Lint is not a runtime guarantee:** the runtime boundary remains `validateAdmittedEvidence`'s WeakSet check (`evidenceLoader.ts:157`).
- **PC wiring:** must call `validateAdmittedEvidence`; any raw-validator import in that patch will now fail lint.
