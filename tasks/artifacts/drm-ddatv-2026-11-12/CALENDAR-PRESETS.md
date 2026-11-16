# Calendar preset implementation receipt

- Changed only `web/pages/drm.tsx` and its existing `web/__tests__/pages/drm.test.tsx`; historical-source inventory and working diary are separate local artifacts. No commits or external actions.
- L7/L14/L30 URL values now mean inclusive calendar days anchored to America/New_York today, capped at selected season-type end and clamped at start. Season to date uses the same cap; future season types return an empty scope. No fixed game IDs or minimum games requirement.
- Dates derive during render before fetch effects, preventing old URL dates from being fetched on preset/season changes. URL dates mirror that scope. Hydration/season identity and aggregate request guards remain; manual dates enter exact Custom mode. Team, opponent, venue, mode and source controls remain restorable.
- Page tests: **25 passed**; cover Eastern boundary/DST/leap day, short early-season windows with one game, no future games, historical cap, filters, restored season races and late aggregate responses. Scoped ESLint: **passed**, zero warnings. Final owned-path `git diff --check`: **passed**. Node 22.23.4. No broad TypeScript, build, browser, network, DB or shift checks performed by this worker.
- Other DRM data readers/utilities and all shift paths remain untouched. Historical source coverage and true observed-unit comparisons remain separate work.
