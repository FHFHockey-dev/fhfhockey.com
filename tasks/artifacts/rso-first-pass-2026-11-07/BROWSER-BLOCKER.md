# Resolved verification-environment blocker

The diagnosis below is historical. The first-exception stack proved that ESM QueryClientProvider loaded React through a copied `node_modules/node_modules` symlink back to the canonical checkout, while the private SSR renderer loaded private React. Removing only that copied symlink resolved the failure: the unchanged candidate returned HTTP 200. The original canonical dependency symlink was left untouched. Evidence: `SSR-ROOT-CAUSE.json`, `ssr-diagnostic-duplicate-react.log`, `ssr-diagnostic.json`. Browser suites have resumed; their result is recorded separately in HANDOFF.md.

# RSO browser acceptance blocker

## Observed result

The candidate passes 2,292 unit/integration tests, full TypeScript and scoped lint. Browser acceptance has not run successfully: Next returns React invalid-hook/null dispatcher errors on the RSO page before Playwright's web-server readiness check can finish. This is an unresolved local startup failure, not proof that the candidate is defective or that the released application is broken.

- Base: `00ea36b39ee0c541fd6050b79703d2c054e97f1d` (#414).
- Candidate tree: `50766b2d31d6f5a6b9cbbcc3565be91152080c9e`.
- Source corrections: 16 paths from `2c20b5669c738f13d97daa55e4c93381908120a0`.
- Node 22.11.0; Next 15.5.22; React and react-dom both 18.3.1.
- Relevant specs: `e2e/roster-schedule-optimizer.spec.ts`, `e2e/rso-acceptance.spec.ts`, `e2e/rso-continuity.spec.ts` (63 cases discovered).
- Server: `npm run dev:stable -- -H 127.0.0.1 -p 3164`, `PLAYWRIGHT_ISOLATED_NEXT=1`, separate `.next-playwright` output.
- Environment: curated inert values, no copied `.env*` files, Node outbound guard; fixtures intercept provider/auth/data requests. No live league or production requests.

## Attempts and stop condition

1. Default local sandbox: Chromium could not register a macOS Mach bootstrap port. No application assertion ran.
2. Supported local permission escalation: browser launched, but Next SSR printed invalid-hook errors. Dependency symlinking was a hypothesis, not an established cause.
3. Replaced only the verification export's dependency symlink with an APFS clone of existing installed dependencies; cleared only its generated caches. The same SSR `TypeError: Cannot read properties of null (reading 'useEffect')` persisted. Stopped instead of rerunning unchanged tests. Port 3164 was verified free, own heavy-slot lock released, sibling lane notified.

No packages were installed, no application-source correction was made, and no Git index, branch, ref, commit, push or deployment was created. The original canonical dependency and environment files are untouched.

## Next diagnostic, not performed

Get a full source-mapped stack for the first SSR hook exception and identify which React instance owns its dispatcher. Compare candidate and pinned base only if narrower stack/resolution inspection cannot distinguish the cause. Keep provider requests blocked and share the heavy slot. A known-green component-only harness can supplement but cannot replace these full RSO page acceptance suites. Do not label the issue baseline-only without evidence.

## Copy-paste diagnostic handoff

I need help diagnosing an isolated local Next.js SSR startup failure before RSO browser acceptance. Please ask for any missing source files, configuration, full logs or excerpts before recommending a change.

Repository: FHFH hockey application, Pages Router, Next 15.5.22, React/react-dom 18.3.1, Node 22.11.0 on macOS. Pinned base 00ea36b39ee0c541fd6050b79703d2c054e97f1d (#414); candidate is that base plus 16 existing RSO correctness/test files from 2c20b5669c738f13d97daa55e4c93381908120a0. Its reconstructed tree is 50766b2d31d6f5a6b9cbbcc3565be91152080c9e. All 2,292 relevant unit/integration tests, full TypeScript and scoped ESLint pass.

The Git-free verification export is under macOS TMPDIR. A local Playwright webServer runs npm run dev:stable -- -H 127.0.0.1 -p 3164 with PLAYWRIGHT_ISOLATED_NEXT=1, isolated .next-playwright, inert Supabase/CMS values, no .env files and a Node loopback-only guard. Provider/auth/data traffic is fixture-intercepted. On GET /roster-schedule-optimizer, Next repeatedly reports Invalid hook call and TypeError: Cannot read properties of null (reading 'useEffect'), before readiness completes. Initial Chromium sandbox Mach-port failure was resolved through the supported permission route. Replacing symlinked node_modules with a private APFS copy of the installed dependencies and clearing only the private build cache did not resolve the SSR failure. Both React versions report 18.3.1. No successful application browser assertion yet.

Settled constraints: one canonical editing checkout; no new branch/worktree; preserve concurrent work; no deployment, remote preview, live league/provider read or expensive production build; use the shared heavy-test lock; do not change the frozen candidate based on an unproven diagnosis. Current base vs candidate attribution is unresolved. Existing logs/config/runner and candidate hashes are in tasks/artifacts/rso-first-pass-2026-11-07/ (browser-private-deps.log, verify-browser.py, CANDIDATE.json, CORRECTIONS.patch).

What is the smallest decisive diagnostic to locate the first SSR hook call and prove whether this is duplicate React/module resolution, the verification environment, or an application bug? Please request the needed files/logs first, and distinguish evidence from hypotheses.
