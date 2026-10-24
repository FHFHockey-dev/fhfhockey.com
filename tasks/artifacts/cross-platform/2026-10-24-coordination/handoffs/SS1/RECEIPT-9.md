# SS1 ticket 9 receipt: single edition request, concurrency-1 harness, date-aware eyebrow

- Lane: SS1 (Claude), ticket 9, same lease. Source: `handoffs/C7/RECEIPT-SS1-8.md` ("Live check vs approval", SS1-8-O3).
- **No live requests in this ticket.** Everything ran on mocks under the deny preload. The deny log (`t9/node-network.jsonl`) holds 1 entry, npm's own `registry.npmjs.org` check.
- Base: octoberBranch @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, plus SS1 … SS1-8, all unchanged.
- Delta: **`SS1-9.patch`** `364a31189a9e76973b4e51d62aabd081be3acedefd44f121ad0e7a88c9595c8f`. It touches 6 files, +159/−9; hashes for 37 files are in `HASHES-9.txt`.
  - Verified in scratch: HEAD + SS1…SS1-9 reproduces all 29 lease files byte-for-byte.
- No Git, no GIT_DIR. No `player-cards` import or edit; :3125 was not touched.
- **The :3110 slot is released.** 0 listeners at 2026-10-24T19:53:52Z. TJ's :3000 was not touched.

## 1. Correction receipt

`RECEIPT-8-CORRECTION.md` is new; RECEIPT-8 is unedited. It states plainly, with the log lines:
- The two live API GETs were **concurrent**, 2 ms apart, so every upstream read ran twice in parallel. **This broke TJ's "concurrency 1".**
- The run made **4 local requests** (2 page and 2 API), not "2 API + 1 warm-up".

## 2. One API call per load (the cause)

- **New `lib/socialShare/editionFetch.ts`:** `fetchEdition(url)` keeps **one in-flight request per edition URL**. A second caller while it is pending gets the same promise. That covers the React strict-mode double mount in dev, a double click, and any repeat trigger.
- Settled requests are forgotten, so "Refresh schedule" still fetches a new edition.
- `SocialShare.tsx`'s `load()` uses it. The existing request-id guard still discards a superseded response.
- This applies in dev and prod alike: one API call per load.

**Proof**
- Unit (`editionFetch.test.ts`): concurrent same-URL callers lead to **1** fetch; after settling, a new fetch happens; different URLs stay separate; a failed request is forgotten.
- **Component test** (`components/SocialShare/SocialShare.test.tsx`): renders the real page component inside **`<StrictMode>`**, which double-mounts in this dev build, and asserts exactly **one** `/api/v1/social-share/…` call.
  - **Negative control:** the same test with `fetchEdition` mocked to call `fetch` directly **fails with 2 calls**. The control file was deleted after the run.
- **E2E #21** against the real Next dev server (strict mode on): a page load makes exactly **1** API request, and an explicit Refresh makes exactly 1 more.

## 3. Concurrency-1 live-check harness (`handoffs/SS1/live-harness/`; not run live)

- `serial-guard.cjs`:
  - **Every counted local GET** (the format's page route and every social-share API call) must start only after the previous one finished, and the total may not exceed the approved cap.
  - An overlapping or over-cap request is **aborted and recorded as a violation**.
  - Tests: `node --test serial-guard.test.cjs`, 2/2 (`t9/harness-test.log`).
- `live-check.cjs`:
  - routes every counted request through the guard (page GETs now count too);
  - refuses non-local browser requests;
  - records status, cache, edition and layer states, counts and timings, with no names;
  - **exits 2 on any violation**.
- `run-live.sh`:
  - refuses to start if :3110 is busy;
  - waits for the port to listen **without an HTTP warm-up GET**;
  - starts the allowlist preload server, runs the check, and stops the whole server process group.
- `live-allow-log.cjs`: the same allowlist (the NHL API and the project's Supabase host; GET/HEAD only on Supabase), with the logged method fixed so NHL calls record "GET", not "FALSE".
- Upstream reads *inside* one API request still run in parallel (`Promise.all` across the Supabase selects). "Concurrency 1" applies to the local GETs; a future approval can say if it should also cover reads within a request.

## 4. Eyebrow from the edition's real date context (SS1-8-O3)

- **New `lib/socialShare/edition.ts`:** `editionLabel()` returns the posting day's name only when the edition was generated, in New York time, on that day of its week (Monday for game-grid, Tuesday for trends, Wednesday for rest-of-week). Otherwise it returns **"Week ahead"**, **"This week"** or **"Past week"**.
- The live Saturday current-week card now reads "THIS WEEK · …", not "MONDAY · …". The Tuesday trend eyebrow uses the same rule.
- Unit tests cover all cases, including a 03:00Z-is-still-Monday-evening edge. E2E #22 checks the label on the grid and pickups cards.

## Pinned PNGs (all 18 asserted in the final run)

| Edition | Status |
| --- | --- |
| **Monday 7** (`7f4cf9c0…`, `d91622b6…`, `2676d8b2…`, `17f84737…`, `46c00e20…`, `c50ad5f8…`, `2b5cd4a3…`) | **unchanged**: the pinned Monday edition is generated on a Monday, so its label stays "Monday" |
| **Wednesday 7** | **new anchors**. The pinned Wednesday edition is now generated on Wednesday 2026-10-28 13:00Z, as it would be live, so it keeps the "Wednesday" label. It was generated on a Monday before, which under the new rule would read "This week". Its check-time footer changes too. |
| **Tuesday 4** | **new anchors**, for the same reason, generated on Tuesday 2026-10-27 13:00Z |

- The new values are in `t9/pinned-env.txt` and `t9/evidence/{wednesday,tuesday}-cards-pinned.sha256`.
- They were identical in a separate repeat run (`t9/pinned-repeat/`).
- Wednesday starts `7dfbb619…`, `6886f629…`, `2880e766…`, `a8e920ec…`, `def9d550…`, `4c1e5ef1…`, `91b281e4…`. Tuesday is `19f368aa…`, `4863603f…`, `94740e90…`, `305daf54…`.

## Checks run

- **Vitest** `lib/socialShare/` + `components/SocialShare/`: **72/72** (`t9/vitest.log`), including the StrictMode component test.
- **Playwright (mocked)** `e2e/social-share.spec.ts`: **22/22**, 39.4 s (`t9/e2e-run.log`, `t9/results.json`).
  - Run in skip-server mode (`PLAYWRIGHT_SKIP_WEB_SERVER=1`) against my own isolated `PLAYWRIGHT_ISOLATED_NEXT=1` :3110 server, under the deny preload, with all 18 pinned hashes asserted.
  - The new tests are #21 (one API call per load) and #22 (date-aware eyebrow).
  - Test 8's alt-text expectation now uses `editionLabel`.
- **Harness:** `node --test` 2/2.
- **CSS pure check:** PURE OK (`t9/css-pure-check.log`).
- **ESLint:** exit 0 (`t9/eslint.log`).
- **Full `tsc --noEmit`** under `/private/tmp/fhfh-heavy.lock`: only the 2 pre-existing out-of-lease Luna errors (`t9/tsc.log`).
- **Not run:** any live request, build or deploy.
