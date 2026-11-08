# SS1 ticket 19 receipt: SS1-17+18 installed in canonical, plus REL-SS1-LOW-YEAR-R1

- **Lane:** SS1 (Claude), working in the canonical checkout `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, HEAD `2f2b43230`. Lease: `CLAUDE-LEASES.json` lane SS1, `canonical_write_paths` (35 pins).
- **No Git by me:** I used `patch`, not `git apply` (only `git apply --check` for the dry run). The orchestrator commits.
- **Read-only security files are byte-identical to HEAD:** `SocialShareAccessGate.tsx` + test, `access.ts` + test, `pages/social-share/[format].tsx`, `pages/api/v1/social-share/[format].ts`, `contexts/AuthProviderContext/index.tsx`.
- **No live reads.** Isolated server **:3110** (`PLAYWRIGHT_ISOLATED_NEXT=1` → `.next-playwright`); :3150 (WiGO) untouched. **Released:** 0 listeners at 2026-10-25T16:33:40Z.

## 1. Install

- **Pins before install:** all **35/35** lease pins matched both the working tree and HEAD.
- **Patch:** `handoffs/SS1/outbox-t17-t18/SS1-17+18-combined.patch`, sha256 `6b37c4526b019b6333e8830cdf79024ba4280d98b1107435902813d63072c798` (as expected). `git apply --check` passed, then I applied it with `patch -p1`.
- **After install:** all 38 social lib, component and spec files equal the verified ticket-18 snapshot `/private/tmp/fhfh-ss1-t18/web` byte-for-byte (38/38).

## 2. REL-SS1-LOW-YEAR-R1 (year 0000–0999)

**Cause**
- `calendarWeekStart` formats the local date with `Intl`, which doesn't produce a four-digit year below 1000. The invalid `Date` then made `toISOString()` throw a raw **RangeError** ("Invalid time value").
- The URL path was already guarded: HEAD's `isCalendarDate` requires `[1-9]\d{3}`.
- **The week date input still crashed:** `changeWeek` only regex-checked the value before calling `calendarWeekStart`.

**Fix**
- **`schedule.ts` `calendarWeekStart`:** if the local date isn't `YYYY-MM-DD`, it now throws the same clean `Error("Invalid as-of timestamp.")` instead of a RangeError.
- **`SocialShare.tsx`, new `safeWeekStart`:** wraps `calendarWeekStart` and returns null on failure.
  - **URL `?week=`:** if the date is not a valid calendar date or its Monday can't be computed, the **default week** is used.
  - **Week input:** a typed year 0000–0999, or any date the calendar can't represent, is **ignored**. The controlled input keeps the current week, and no request is made.
- **Boundary:** 1000-01-01 still works. It's a Wednesday whose Monday is 0999-12-30, and the server's season check rejects that week as before, so it shows a handled message. 1000-01-06 is the first Monday of year 1000.

**Tests**
- `schedule.test.ts` (+1):
  - 0000-01-03, 0001-01-01, 0099-01-05, 0999-01-07 and 0999-12-31 throw `Error("Invalid as-of timestamp.")`;
  - 1000-01-01 → 0999-12-30, 1000-01-06 → 1000-01-06, 1000-01-07 → 1000-01-06, 9999-12-31 → 9999-12-27.
- `SocialShare.test.tsx` (+2):
  - **URL fallback:** `?week=0999-12-31` added to the existing impossible-week cases (default week, no throw).
  - **New week-input test:** typing 0000-01-03, 0999-12-31 and 0099-02-30 does not throw, keeps 2026-10-19 and makes no request. Typing 1000-01-07 snaps to 1000-01-06 and makes one request.

## 3. Streak comment

- `streak.ts` line 9 now reads "rules proposed by SS1 and confirmed by TJ 2026-10-25". It previously said "proposal".

## Checks run

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **175/175** (`t19/vitest.log`), up from 172.
- **Playwright e2e behind the real access gate:** **30/30** in run A, run B and the final pinned run, using the fictional `.invalid` editor session from SS1-14.
  - Runs on the canonical spec against isolated :3110, with the deny preload `outbox-t17-t18/net-deny.cjs`. The Node deny log has 1 entry: npm's registry check.
- **PNG pins:** all 22 asserted. They are **byte-identical to ticket 18's pins** (`t19/pinned-env.txt` equals the t18 outbox `pinned-env.txt`). This ticket changed no pixels.
- **CSS pure check:** PURE OK. **ESLint** on the social lib, components and spec: exit 0.
- **Full `tsc --noEmit`** (8 GB heap, shared heavy lock): **exit 0**, so the scoped social-share check is clean too.
- **Not run:** any live request, build, deploy or Git write.

## Exact changed paths (for the orchestrator's commit)

**Source**, versus HEAD `2f2b43230`. Post-install sha256 values are in `HASHES-19.txt`.

| | Path | sha256 (12) |
| --- | --- | --- |
| M | web/components/SocialShare/SocialShare.module.scss | fe9a6e5a6b5b |
| M | web/components/SocialShare/SocialShare.test.tsx | 726c9ae41f14 |
| M | web/components/SocialShare/SocialShare.tsx | f281fda7c2f8 |
| M | web/e2e/social-share.spec.ts | 1de493e264bc |
| M | web/lib/socialShare/pickupsFixture.ts | 8042741fa0c5 |
| M | web/lib/socialShare/playerSources.test.ts | ffef95e6cf3e |
| M | web/lib/socialShare/playerSources.ts | 336677470f7e |
| M | web/lib/socialShare/players.test.ts | da553357a3fa |
| M | web/lib/socialShare/players.ts | 2493af219ea7 |
| M | web/lib/socialShare/schedule.test.ts | e652c21ff98d |
| M | web/lib/socialShare/schedule.ts | f6047772763a |
| M | web/lib/socialShare/server.ts | ab891bc171bb |
| A | web/lib/socialShare/streak.test.ts | 65f87c923d1b |
| A | web/lib/socialShare/streak.ts | c94bf9b7a9cc |
| M | web/lib/socialShare/types.ts | c8b2471aad2d |

**Evidence (lease handoffs folder):**
- `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/RECEIPT-19.md`
- `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/HASHES-19.txt`
- `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/t19/`: logs, run-a, run-b, evidence PNGs, pins and the runner.

The isolated build output `web/.next-playwright` is ignored build output, not for commit.
