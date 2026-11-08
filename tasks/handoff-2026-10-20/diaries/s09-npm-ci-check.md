# Handoff diary: s09-npm-ci-check (S-09 dependency removal, clean npm ci check)

> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

Session id: `local_42e4908e-af5b-43e7-b1b2-d2cc65170435` ("Verify clean npm ci for the dependency removal (S-09)"), idle, 6 turns. Started from the RSO/handoff-review session `local_08a0bf1c`.

## 1. Scope
- Lane S-09 (2026-10-18 sprint) removed 7 dependencies to cut bundle size. The 10-18 handoff said a clean `npm ci` was never verified, so S-09 was held out of releases R2-R4.
- This session was a read-only verification in a scratch copy, to decide whether S-09 can go into the next release. It changed nothing in the repo.
- Removed packages (commit `317f8f57e`, `web/package.json` + lockfile -201 lines): formidable, immer, json2csv, jstat, ml-pca, react-flip-move, use-immer, plus `@types/formidable`. The commit also added a `typecheck` script.

## 2. Where
- Commit `317f8f57e` ("10/18 sprint checkpoint"), checked by the helper in git: it is on `octoberBranch` and `origin/octoberBranch` only.
- Scratch copy (`git archive HEAD web`, Node 22.11.0 per `.nvmrc`) was under `/private/tmp/claude-501/` and has been deleted. No notes file written; the report was returned in chat only.

## 3. State
- Verdict from the session: the removal looks safe to ship. Caveat: the production build could not be observed end to end.
- Remaining references: none. A search of `web/` (excluding node_modules, the lockfile and `.next*`) found no import, require or dynamic import of any removed package.
- `npm ci`: passed, 1479 packages, no lockfile or peer errors. It printed 57 audit vulnerabilities, which were not investigated.
- `tsc --noEmit` (8 GB heap, under the heavy lock): passed, 0 errors.
- `npm run build` with dummy env vars: failed, but only after webpack finished ("Compiled with warnings in 28.8s", no "Module not found" / "Can't resolve"). It failed in "Collecting page data" / "Generating static pages (22/88)" with `getaddrinfo ENOTFOUND unit-tests.supabase.invalid` (pages such as `/lines` call Supabase at build time). No dependency-related error in the log.
- Where the work lives (checked by the helper against git on 2026-10-20): S-09 is NOT released. `origin/master` (R6f `b630e0767`) `web/package.json` still lists all 7 packages and lacks the `typecheck` script; `octoberBranch` has them removed and `web/package-lock.json` is 201 lines shorter than master's. So the change exists only on `octoberBranch`.

## 4. Next
- None stated beyond the verdict. Implied: include S-09 (the `web/package.json` and lockfile hunks of `317f8f57e`) in a curated release candidate when TJ approves.

## 5. Blocked / needs TJ
- TJ's release approval. Per the repo's release procedure, S-09 must be cut into a master candidate; it is not a plain merge.
- The static-generation phase of the build is unobserved. Only a build with a reachable Supabase (or the Vercel build itself) would cover it. Note: AGENTS.md treats remote builds as costly and forbids triggering them as routine verification.

## 6. Insights
- Unobserved risk is small: nothing references the removed packages, and the webpack compile (where a missing package would show up) and tsc are clean.
- Dummy-env build failures at "Collecting page data" are an environment artifact, not a regression. Report them separately from dependency errors.
- Local `master` ref is stale (`457435eb3`, 10-15). Use `origin/master` to see what is released.
- Heavy jobs (tsc, build) run under the lock `/private/tmp/fhfh-heavy.lock` (mkdir-based) with `NODE_OPTIONS=--max-old-space-size=8192`.
- npm audit shows 57 vulnerabilities on the lockfile; nobody has triaged them.
