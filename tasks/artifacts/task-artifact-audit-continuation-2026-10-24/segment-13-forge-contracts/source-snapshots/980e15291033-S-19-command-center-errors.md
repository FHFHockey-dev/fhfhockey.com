# S-19: Command Center module errors no longer render request details (2026-10-18)

Source: audit G5b, problem 3 in `tasks/artifacts/super-goal-audit-2026-10-17/findings/G5b-forge-dashboards-trends.md`. The ticket called it "problem 4", but the matching text is listed as item 3.

All changes are local and uncommitted. There was no network, push or deploy, and no FORGE serving, slice or `start-chart.ts` file was touched.

## Changes

- `web/lib/dashboard/clientFetchCache.ts`: a non-OK response now throws `Error("Request failed.")` instead of ``Request failed (${status}) for ${url}``. Outside production, the status and URL are logged with `console.warn("Dashboard request failed", { status, url })`. This also covers the other `fetchCachedJson` consumers in `lib/dashboard/dataFetchers.ts`.
- `web/components/forge-command-center/CommandCenterShell.tsx` (`ModuleState`):
  - An `error` module renders the fixed `<contract label> is unavailable right now.` (for example "Goalie Context is unavailable right now."). This is the same containment pattern the legacy `components/forge-dashboard` cards use ("Team power is unavailable right now."). `module.error` is never rendered, so errors from other sources (thrown 4xx/422 messages, parse errors) are contained too.
  - The stale/partial warning no longer falls back to `module.error`.
- `web/__tests__/pages/forge/command-center.test.tsx`: asserts the three safe per-module messages and that no `Request failed` text renders.
- `web/lib/dashboard/commandCenterData.test.ts`: the dependency-failure case now asserts that the error is exactly `"Request failed."` with no status or `/api/` path.

## Checks

- `npx vitest run __tests__/pages/forge/command-center.test.tsx lib/dashboard`: passed, 10 files, 57 tests.
- `npx vitest run lib/dashboard/commandCenterData.test.ts __tests__/pages/FORGE.test.tsx __tests__/pages/forge`: passed, 7 files, 46 tests.
- `npx tsc --noEmit` (8 GB heap, heavy lock): exited 2 with two errors, both in `pages/api/v1/db/ingest-projection-inputs.ts:668,670` (`PbpResponse`/`ShiftChartsPayload` types). That file is another session's in-progress work, and none of the changed files have errors.
- Prettier: `CommandCenterShell.tsx` was formatted. `clientFetchCache.ts` was already not Prettier-clean at HEAD, so I kept its existing style rather than reformat the file.
- Not run: lint, full Vitest, and a browser check (pending, since dev servers are off).
