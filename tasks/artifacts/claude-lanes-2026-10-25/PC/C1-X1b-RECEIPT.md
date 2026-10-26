# C1-X1b closed: dynamic import() and require() of evidenceBundle are now lint errors

Claude C1 session, 2026-10-25T18:54Z. This closes the limit C7 noted on lint rule `d5413c688` (C1-X1). Not committed (Codex commits). No Git operations, no GIT_DIR, and no player-cards source edits.

## File changed (granted for this ticket)

| File | Before sha256 (= committed d5413c688) | After sha256 | Change |
| --- | --- | --- | --- |
| `web/eslint.config.mjs` | `9522bca670fd1ab0b222355ba28ff22b09c5981b01e042ad93c2e21c0ac5f6d8` | `58cbf257d88a47d1005a8e57c4250f4bee22d38665ec9472ab0feb83bb8b7c35` (5015 bytes) | +16 lines |

The diff is in `C1-X1b/eslint.config.mjs.diff` (sha256 05864b82…).

**What was added.** A `no-restricted-syntax: error` rule goes in the same block as the X1 `no-restricted-imports` rule. It therefore shares that block's `files` glob (`**/*.{js,jsx,mjs,cjs,ts,tsx}`) and its two exemptions: `lib/player-cards/evidenceLoader.ts` and `lib/player-cards/evidenceBundle.test.ts`. No other config sets `no-restricted-syntax`, so nothing is overridden.

It has six selectors. The module test is `(^|[^\w$])evidenceBundle(\.\w+)?$`, with no `/` in the regex, which avoids esquery's slash parsing.

| Selector | Covers |
| --- | --- |
| `ImportExpression[source.value=…]` | `import("…/evidenceBundle")`, any prefix or extension |
| `ImportExpression[source.type='TemplateLiteral'] > TemplateLiteral > TemplateElement[value.raw=/evidenceBundle/]` | `` import(`…/evidenceBundle`) `` |
| `CallExpression[callee.name='require'][arguments.0.value=…]` | `require("…/evidenceBundle")` |
| `CallExpression[callee.name='require'] > TemplateLiteral > TemplateElement[…]` | ``require(`…`)`` |
| `CallExpression[callee.property.name=/^(importActual\|requireActual\|importMock\|requireMock)$/][arguments.0.value=…]` | `vi.importActual(…)`, `jest.requireActual(…)` and similar test loaders |
| `TSExternalModuleReference[expression.value=…]` | TS `import x = require("…")` |

**Scope.** The ticket asked to match `**/player-cards/evidenceBundle`. The rule matches any `evidenceBundle` specifier instead, because the same-directory form `./evidenceBundle` contains no `player-cards`. This is the same scope as X1's `**/evidenceBundle` group.

The dynamic selectors block the whole module, not just one name, because a dynamic or required module object always exposes `validateEvidenceBundle`. Before adding it I checked the repo: there are no existing dynamic or `require` uses of evidenceBundle.

## Proof (probe tree `/private/tmp/fhfh-c1-x1b-probe`, never in the repo, removed after the run)

Probe sources are kept as evidence in `C1-X1b/probe-files/`; they are artifacts, not repo code.

| Probe | Form | Expected | Result |
| --- | --- | --- | --- |
| `static.ts` | static named import (X1 rule) | fail | **error** `no-restricted-imports` |
| `dynamic.ts` | `await import("../player-cards/evidenceBundle")` | fail | **error** |
| `DynamicAlias.tsx` | `import("lib/player-cards/evidenceBundle")` (alias) | fail | **error** |
| `dynamicTemplate.ts` | `` import(`../player-cards/evidenceBundle`) `` | fail | **error** |
| `probeSameDirDynamic.ts` | `import("./evidenceBundle.ts")` inside player-cards | fail | **error** |
| `probe-require.cjs` | CommonJS `require("../lib/player-cards/evidenceBundle")` | fail | **error** |
| `requireTs.ts` | `require("./../player-cards/evidenceBundle")` in TS | fail | **error** |
| `requireTemplate.js` | ``require(`../player-cards/evidenceBundle`)`` | fail | **error** |
| `importEquals.ts` | `import evidence = require("…")` | fail | **error** |
| `viImportActual.test.ts` | `vi.importActual("../player-cards/evidenceBundle")` | fail | **error** |
| `typesOnly.ts` | `import type { RetainedReceipt }` | pass | pass |
| `unrelated.ts` | `import("…/evidenceLoader")`, `import("./myevidenceBundleNotes")`, `require("node:path")` | pass | pass (no false positives) |

**Must-fail run:** exit 1, 10 errors, one per probe (`C1-X1b/fail-lint.log`, sha256 91977762…). The single warning there is an unneeded `eslint-disable` comment in my own probe file, not from the config.

**Must-pass run:** exit 0, 0 errors (`C1-X1b/pass-lint.log`, sha256 40d2a83d…). It covered both probes above plus `evidenceLoader.ts`, `evidenceBundle.test.ts`, `evidenceLoader.test.ts`, `evidenceAdmissions.ts` and `evidenceBundle.ts`. Its one warning is again a probe's own unneeded disable comment.

**Negative control on the exemption** (probe copy only):
- I appended `import("./evidenceBundle")` to the loader. While exempt, it passes (`ctl1-lint.log`, empty).
- With the exemption removed, the loader errors at both `6:10` (static, X1) and `168:35` (dynamic, X1b) (`ctl2-lint.log`, sha256 078f300c…).

## Checks on the canonical tree

| Check | Result | Log |
| --- | --- | --- |
| `npx eslint lib/player-cards` (cwd `web/`) | **PASSED**: exit 0, no output | `C1-X1b/player-cards-lint.log` (empty) |
| `npm run lint` (full, under `/private/tmp/fhfh-heavy.lock`, 18:53:25–18:53:48Z) | **PASSED**: exit 0, **0 errors**, 69 warnings, all pre-existing | `C1-X1b/full-lint.log` sha256 a902c955… |

The full-lint log is **byte-identical** to the X1 run (same sha256 `a902c955…`), so the new rule added no reports anywhere. The 69 warnings are 53 `@next/next/no-img-element`, 8 `react-hooks/exhaustive-deps`, 3 `import/no-anonymous-default-export` and 5 unused-disable reports. The run covered the current working tree, including other lanes' uncommitted `web/` edits.

## Remaining limits

- **Non-literal specifiers** (`import(variable)`, `require(path.join(…))`) can't be resolved statically, so no lint rule can catch them.
- **Aliased require** (`const r = require; r("…")`, or `createRequire(...)` results under another name) is not caught; only the identifier `require` is matched.
- **`.mts`/`.cts` files** are not covered, matching the existing lint scope; see the X1 receipt for why the glob stays narrow.
- **Lint is not a runtime guarantee.** At runtime, `validateAdmittedEvidence` still rejects any evidence its loader didn't issue (WeakSet check, `evidenceLoader.ts:157`).
