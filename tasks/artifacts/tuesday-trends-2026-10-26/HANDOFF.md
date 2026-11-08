# Tuesday Trends: lane TT handoff (2026-10-26)

**Status:** usable Tuesday edition implemented and verified locally against offline fixtures and one approved genuine-data capture plus its re-run. **Not pushed, not deployed.** Production behavior is unverified until TJ approves a release.

## Commits on octoberBranch (local only)
| SHA | Content |
|---|---|
| `82490cd45` | Native-data loader (`trendSources.ts`) wired into the Tuesday branch of `server.ts`; four defined sections; unknown PP stays unknown; pct-point movers; export snapshot token |
| `c5829aa9e` | "PCT PTS" label, writer-level freshness fix, first genuine capture plus offline render |
| `8e755dab8` | Recent Form `recent-form-v1-early`, deployment columns by TOI sign, integer movers, approved re-run |

Web files (13, all in lease TT): `web/lib/socialShare/{trendSources,trendSources.test,trends,trends.test,trendsFixture,server,export,types,schedule.test}.ts`, `web/components/SocialShare/{SocialShare.tsx,SocialShare.test.tsx,SocialShare.module.scss}`, `web/e2e/social-share.spec.ts`. Since the base `cd73cbd69`, only TT commits have touched these files. **Import closure vs origin/master:** only these TT files differ, so a Tuesday-only release candidate on top of origin/master needs no other lane's commits.

## Reused vs changed
- **Reused unchanged:** Monday's frame (`CardHeader`, chips, count colours, footer legend, source line and watermark, 1080 html-to-image export); auth gate (`requireSocialShareAccess`, `SocialShareAccessGate`, read-only); private/no-store API; per-user edition memory and URL selection; the `bounded()` and chunk patterns from `playerSources.ts`.
- **Changed:**
  - Tuesday now reads native data. Before any read, validation runs and the schedule must be ready.
  - Each source fails closed per section, with the reason shown.
  - Only shown players leave the server.
  - The export token is checked between the click and the capture.

## Sections (definitions in `CONTRACT.md`, also printed in each footer)
1. **Recent Form `recent-form-v1-early`** (TJ rule):
   - P/GP over the last 5 appearances vs the preceding 5, with no overlap; all 10 appearances must be in the current season.
   - Missing data is never counted as zero.
   - Labelled "Early season · small sample". Descriptive only: not BLSH, not a streak.
   - Changing the window needs a new version id and a documented or reviewed transition.
   - If empty, the other three cards still export.
2. **Ownership movers:** percentage-point change in Yahoo rostered % (latest date vs the last date on or before 5 days earlier, both dates shown). It is labelled "PCT PTS" and "not adds/drops"; a missing observation is not 0%.
3. **Deployment:**
   - Total, EV and PP TOI/GP, L5 vs season.
   - Line and PP-unit change, comparing the last game with the game before.
   - The column follows the TOI sign when the change is at least 1:00. Otherwise it follows the role direction, and mixed-direction role-only rows are left out.
   - "PP ?" means unknown; "off PP" appears only with `powerPlayCombinations` evidence.
4. **Rate standouts:** SOG/60, iCF/60 and ixG/60. Each shows the L5 rate and Δ/60 vs season; minimums are 50 L5 minutes and 10+ GP.

No goalie-start claims (Tuesday is skaters-only). No `PROJECTIONS_*`, BLSH or `goalie_start_projections` reads.

## Verification
| Kind | Evidence | Result |
|---|---|---|
| Offline fixtures | Vitest `lib/socialShare` + `components/SocialShare` (re-run by chef) | 221/221 |
| Offline fixtures | E2E behind the real gate, isolated :3110 (worker) | 33/33. All 9 Monday and 9 Wednesday PNG pins byte-identical; Tuesday pins changed by design |
| Static | eslint 0, CSS pure OK (worker). Full tsc: 0 social-share errors; 3 errors in other lanes' dirty files | pass for TT scope |
| Genuine data | Capture `genuine/` (11 statements, 0 errors) and re-run `genuine/run-2/` (11 statements, 0 errors, all four sections ready, 439 Recent Form qualifiers, 0 "PP ?", fresh as of Oct 26, 6:15 AM EDT). Rendered locally; every export token matches its snapshot | pass |
| Screens | `screens/OFFLINE-FIXTURE-*` and `genuine/run-2/screens/GENUINE-DATA-*` (desktop, phone, 1080 PNG) | reviewed by chef |
| Deployed | — | **not run** (no push or deploy approved) |

## Production reads used
`READ-APPROVAL.md` (TJ pop-ups): the ceiling plus the `players` addendum. Both approved runs are used up. **Any further production read needs new approval.**

## Open gaps / follow-ups
- **Ottawa logo:** the dirty `web/public/teamLogos/OTT.png` in the working tree (TJ's) changes the Ottawa cells of 3 Monday/Wednesday pins. It matches only when the committed logo is served (`SOCIAL_SHARE_LOGO_OVERRIDE_DIR`, see RECEIPT-1).
- **Live behavior:** the live API path calls the NHL schedule before the trend reads. The genuine capture called `loadTrendLayer` directly. Post-deploy, verify with one bounded refresh by TJ and a Vercel log read.
- **Ownership coverage:** about 575 Yahoo rows per date. The 10-04 cron note on partial coverage still applies; untracked players simply do not appear.
- **Thursday:** the format registry, renderer and `[format]` routes are free for an exact Codex lease. The Tuesday output contract is in `CONTRACT.md`.
- **Push:** origin/octoberBranch is 11 commits behind HEAD (RSO/FORGE/Astra work as well as TT). A release must be built Tuesday-only from exact blobs on origin/master, gated, and pushed only with TJ's approval and the Vercel project inventory.

## Receipts
`RECEIPT-1.md`, `RECEIPT-2.md`, `RECEIPT-3.md`, `READ-PLAN.md`, `READ-APPROVAL.md`, `CONTRACT.md`. Diaries: `tasks/diaries/2026-10-26-claude-tuesday-trends-{chef,worker}.md`.
