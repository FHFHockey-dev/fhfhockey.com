# R-TELEMETRY handoff — local mitigation ready for Chef review

Owner `01a1566f-c3e3-7fc0-9dd4-2f71a4a62233`; own matching session turn_context re-confirmed `gpt-6.1-sol` / `high` before edits. Canonical checkout/branch retained. `_app.tsx` was clean and no existing app-composition test existed. Exact ownership declared to Chef and in OWNERSHIP.md before source edits. Source/test ownership now released to Chef for review; all work uncommitted; no process remains running. Sprint remains active.

## Implemented behavior

`_app.tsx` excludes both Analytics and SpeedInsights from the first render on exactly the existing credential pages `/auth/callback` and `/auth/reset-password`, including query/hash variants and trailing slash. It checks route pathname, router asPath, and current browser pathname so mismatched transition state remains conservative. The pages remain excluded after their own URL scrub; telemetry resumes after leaving them. Existing auth provider, layout, SEO, query provider, page props and snackbar composition are unchanged.

Installed telemetry scripts can outlive React unmount. Both telemetry components therefore receive the same stable supported `beforeSend` function, which rejects events when their URL/optional route identifies a credential page or the browser is currently on one. This blocks callbacks retained by the previously mounted SDK before React commits the transition and delayed credential-page events after returning to an ordinary page. Ordinary-route events are returned as the same original object. No telemetry payload or credential logging was introduced.

A new narrow `_app.test.tsx` is justified because no app-composition test existed. It exercises the actual MyApp component with mocked SDK/provider/Layout/SEO/style dependencies, synthetic URL/code/hash values, and a throwing fetch stub. No heavy real auth context or SDK script is mounted in verification.

## Installed SDK evidence (local files only)

- `@vercel/analytics` version **0.1.11**: `web/node_modules/@vercel/analytics/dist/react/index.d.ts` declares `beforeSend(event) => event | null`. `dist/react/index.js:40-88` registers the function through `window.va` before injecting a script from a React effect, and provides no cleanup removing that script on component unmount.
- `@vercel/speed-insights` version **1.3.1**: `web/node_modules/@vercel/speed-insights/dist/next/index.d.ts` declares a `beforeSend` middleware supporting null rejection. `dist/next/index.mjs:89-129,142-164` registers the middleware through `window.si`, injects from effects, and provides no unmount cleanup. This supports adding a retained-script filter in addition to component exclusion.
- Current credential page routes confirmed in `web/pages/auth/callback.tsx` and `web/pages/auth/reset-password.tsx`; callback scrubbing still occurs in their existing effects, untouched. No basePath/i18n/trailingSlash configuration was found by a bounded search of `web/next.config.*`.

SDK dependency files and auth pages were read only. No documentation/network/hosted/provider request or real credential was used.

## Checks actually run

| Check | Result |
| --- | --- |
| `cd web && npm test -- __tests__/pages/_app.test.tsx` | PASS, exit 0; 18 tests on first attempt. Covers six initial sensitive URL variants, two renderToString credential compositions, three mismatched router/browser states, five ordinary paths (including /auth and /db snackbar behavior), and two complete ordinary-to-credential-to-ordinary transitions with retained beforeSend callbacks. |
| `git diff --check -- web/pages/_app.tsx` | PASS; no whitespace errors. |
| `git diff --no-index --check /dev/null web/__tests__/pages/_app.test.tsx` | PASS; checks the new untracked test's whitespace. |
| Scoped source diff review | Only the route predicates/filter/mount condition and two beforeSend props were added; unrelated auth/layout/snackbar code preserved. |
| Global tsc/lint/build/full suite/browser/provider/hosted tests | NOT RUN; Chef owns global checks, and network/builds are prohibited. |

No failed focused check, retry or unresolved local acceptance item remains. Benign existing Node punycode deprecation warning only.

## Exact source/test files and hashes

| File | Action | SHA-256 |
| --- | --- | --- |
| `web/pages/_app.tsx` | changed | `930f0761a9d01f877f94dffae2c1ca8b224ed0362e7a28cad0054d0c22484d19` |
| `web/__tests__/pages/_app.test.tsx` | created | `c4bb9e2778c016414ac93a40657bb642aac5f374d1e90ba980be22dc2417d49d` |

## Exact lane files created

- `tasks/codex-sprint-2026-10-19/continuation-telemetry/OWNERSHIP.md`
- `tasks/codex-sprint-2026-10-19/continuation-telemetry/HANDOFF.md`

Preexisting R-TELEMETRY-TICKET.md was read only. No other source/helper/config/SDK/register/fenced file was changed. Previous worker receipts remain historical.

## Evidence limits and next unblocked piece

This is preventive mitigation for P8 S3's unverified ordering risk, with local source/contract and mocked composition evidence. It does not establish a prior credential disclosure or real browser/remote-script event ordering, and no production behavior is claimed. The predicate intentionally covers the two current rendered credential routes; it is not a general payload/referrer scrubber or whole-site telemetry privacy policy. Changing route structure, adding new rendered callback pages or replacing SDK contracts requires revisiting this boundary.

Chef's next unblocked piece is independent review of the small `_app.tsx` diff and the 18-test composition receipt, followed by Chef-owned integration checks and continued assignment of the remaining authorized queue. This lane has no further implementation dependency or running operation.
