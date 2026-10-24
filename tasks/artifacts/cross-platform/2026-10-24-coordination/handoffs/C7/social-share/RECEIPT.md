# C7 SITE-SOCIAL-SHARE — isolated fixture browser run (evidence only)

**Reviewer:** Claude C7 lane session. Read-only on all application source. Writes went only to this folder. No posting, sharing, export of a private league, or rights/content decision. No Git writes. `GIT_DIR` was unset. No FHFH production Supabase read occurred; see run 1.

**Verdict:** the existing `web/e2e/social-share.spec.ts` (SHA-256 `e702827e4175ba8df2b60af9e64d8fb9d0aebb81f33b514d862d1bdc14fa4bb1`, git-clean, unchanged after the run) **passes 7/7 in real Chromium** against an isolated local fixture server on :3110. This is **accepted for the synthetic fixture scope only**. It is not publication rights, live NHL data qualification or production acceptance.

**Finding SS-1 (tooling, for the Playwright config owner):** the exact assigned command cannot run without production reads.
- `playwright.config.ts` probes readiness at `url: baseURL`, which is `/`.
- The homepage `getServerSideProps` (`pages/index.tsx:501-502`) fetches `api.nhle.com` and the production Supabase project `fyhftlxokyjtpndbkfse.supabase.co` using `web/.env.local`.
- Every social-share e2e run therefore makes production Supabase reads just to decide the server is ready, even though the spec itself only visits `/social-share/*`.
- Smallest fix, not made here: point the webServer `url` at a static or fixture route, or document the `PLAYWRIGHT_SKIP_WEB_SERVER` path for this spec.

## Environment

- Node 22.11.0, `@playwright/test` 1.60.0, cached Chromium 1223. **No install was run.**
- Next 15.5.22 `dev:stable` with `PLAYWRIGHT_ISOLATED_NEXT=1` (distDir `.next-playwright`) on **:3110 only**. Next honours the last `-p`. Nothing was on :3000, :3100, :3105 or :3110 before or after either run.
- Every Node process (Playwright runner, npm, Next and its workers) ran under `c7-net-deny-log.cjs`. It denies and logs every non-loopback connection, fetch or DNS lookup, so `.env.local` credentials could not leave the machine. I self-tested it before use: loopback was allowed, and external fetch and https were denied.
- The spec itself aborts every non-localhost browser request and mocks `/api/v1/social-share/**` with fictional fixture schedules.

## Runs (both original logs kept)

**Run 1 — assigned command** (`run-social-share.sh`, `run1-original-webserver-timeout.log`, `results-run1.json`, `node-network-run1.jsonl`)
- Command: `PLAYWRIGHT_PORT=3110 npx playwright test e2e/social-share.spec.ts`, plus `--reporter=list,json --trace=on --output=<this folder>/test-results` and `SOCIAL_SHARE_EVIDENCE_DIR=<this folder>/evidence`.
- Result: **exit 1, 0 tests run.** The output was `Error: Timed out waiting 120000ms from config.webServer.`
- Cause: the `/` SSR fetches were denied, so `/` returned 500 for 120 s.
- Denied server-side attempts:
  - 148 × `api.nhle.com`
  - **74 × `fyhftlxokyjtpndbkfse.supabase.co` (production; none reached it)**
  - 1 × `registry.npmjs.org`

**Run 2 — repo-documented skip-server mode** (`run2-skip-webserver.sh`, `run2.log`, `server-run2.log`, `results.json`, `node-network-run2.jsonl`)
- I started the same isolated server myself: `PLAYWRIGHT_ISOLATED_NEXT=1 npm run dev:stable -- -p 3110`, under the deny preload.
- Readiness was checked with `curl` on `/social-share/game-grid` (HTTP 200 after about 4 s).
- Then: `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 PLAYWRIGHT_PORT=3110 npx playwright test e2e/social-share.spec.ts --reporter=list,json --trace=on --output=…/test-results`
- Result: **exit 0, 7 passed, 0 failed, 0 flaky, 13.5 s.** The server log shows no errors.

| # | Test (spec line) | Result |
| --- | --- | --- |
| 1 | default summary, recalculated dates and actual PNG match one frozen edition (70) | pass |
| 2 | Wednesday excludes Wednesday; mobile controls and detail PNG preserve selected games (141) | pass |
| 3 | long text and missing logo stay inside the square and export with a branded fallback (177) | pass |
| 4 | failed refresh preserves only a nonexportable preview and retries the same selection (189) | pass |
| 5 | partial, stale and valid zero-game sources do not publish rankings (219) | pass |
| 6 | export font failures are explicit and retry without refetching schedule data (238) | pass |
| 7 | edition expiry disables export and unsupported formats stay explicitly gated (252) | pass |

## External-request list (run 2)

- **Node (server and runner), from `node-network-run2.jsonl`:** 1 × `registry.npmjs.org` (Next version check), denied. No Supabase or NHL traffic, because the social-share SSR makes no data fetch.
- **Browser, from 7 `trace.zip` network logs:** 264 localhost requests. All external requests were **aborted by the spec** (status −1) and never fulfilled:
  - 99 × `fonts.googleapis.com`
  - 11 × `img.buymeacoffee.com`
  - 11 × `cdn.vercel-insights.com`
  - 10 × `va.vercel-scripts.com`
- No request was made to any posting, sharing or social service.

## Evidence

- `evidence/`: downloaded 1080×1080 PNGs (`default-fixture`, `team-fixture`, `long-name-no-logo-fixture`, `recovered-export-fixture`), screenshots (`fixture-desktop`, `fixture-mobile`, `fixture-zoom`, `default-fixture-preview`), `fixture-fidelity.json` and `fixture-zoom.json`.
- `test-results/*/trace.zip`: 7 full traces with screenshots and network. Total folder size is about 25 MB.

## Limits and observations (not failures)

- Google Fonts were blocked, so rendering used local and fallback fonts. Social-share export fonts are local (`/fonts/social-share/`), and test 6 exercises their failure path.
- Fidelity is `differentPixels` 0.0139, under the spec's 0.02 limit with about 30% headroom.
- At 200% CSS zoom, `socialContentFits: true` but `pageFits: false`: the shared navbar overflows. The spec deliberately asserts only social content; the navbar is outside social ownership.
- Synthetic fixtures only, with a mocked API. The real `/api/v1/social-share/[format]` route and live NHL schedule data were not exercised. Production was not touched.
- This is a desktop Chromium project only, with no WebKit/Firefox runs or real touch devices. The 320 px and 390 px mobile cases ran in desktop Chromium with viewport resizing.

## Slot

The :3110 isolated slot is **released**. At 15:20:57Z the server process group was terminated; after that there were 0 listeners on :3110, 0 on :3000, and 0 processes left in the group. The `.next-playwright` build output remains as the slot's normal artifact.

Diary: `/Users/tim/Code/fhfhockey.com/tasks/diaries/2026-10-24-claude-c7-luna-local-review.md` (ticket 2 section).
