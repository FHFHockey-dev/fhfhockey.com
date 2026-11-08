# Home page game times after DST end (claude, 2026-11-08)

- Scope: homepageTime.test.ts failure (expected '6:07 PM CST', got '7:07 PM CDT'). Owned files: web/components/HomePage/homepageTime*, homepageGameFormatting.ts.
- Where: octoberBranch, canonical checkout.
- Finding: NOT a code bug. Formatter uses Intl with explicit IANA zones (Node 22.23.4 ICU 78.3, tzdata 2026e). The failing case is America/Winnipeg; Edmonton and Vancouver differ too. tzdata 2026b/c/e: BC, Alberta, Manitoba stopped falling back in 2026 (permanent -07/-06/-05). moment-timezone 0.6.0 bundles tzdata 2025b, so the test's oracle is stale. US zones match moment exactly.
- Live check: one GET https://fhfhockey.com/ → 200; game times ship as startTimeUTC JSON and render client-side in the viewer's zone, so the SSR HTML has no rendered clock to compare. US viewers get correct output from Intl; nothing an hour off.
- Fix: test-only. Replace the moment oracle for game times with a fixed table of instants on both sides of 2026-03-08 and 2026-11-01.
- Checks: homepageTime.test.ts 5/5 pass; npm run typecheck exit 0; eslint on the test exit 0.
- Next: report SHA to Chef. Follow-up idea (not done): server code still uses moment-timezone 2025b data, which is wrong for BC/AB/MB after 2026-11-01.
