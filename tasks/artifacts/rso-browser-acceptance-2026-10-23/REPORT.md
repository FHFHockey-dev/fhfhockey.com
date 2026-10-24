# RSO browser acceptance (CR-REL-04 / R6): status

**Waiting for the candidate SHA.** The harness is ready and has been validated on a commit that is not the candidate. Nothing here is acceptance yet.

No frozen candidate is published in `release-integration-2026-10-23/`. `production-model-prototype/FIXED-SNAPSHOT.json` is labelled "DRAFT … NOT accepted or ready to push", and PARENT-REVIEW.md says the final SHA still needs parent review.

## What the harness checks

Each check runs at desktop 1440×900 and mobile 375×812 (Pixel 5, touch) in Playwright Chromium. All data is fictional and served from intercepted routes.

| Check | Spec (harness/) | Pass means |
|---|---|---|
| Task 10 | `rso-p07-acceptance.spec.ts` › complete/partial | Slot grid shows expected FP for a skater (2.5), and expected plus if-starts FP for a goalie (1.8 / 3.0), from an authorized current read |
| P07 partial | same test | Skater missing one weighted stat shows "—" (not the 1.2 partial sum). Goalie missing one per-start stat shows if-starts "—" (not 5.0) while its expected 1.4 stays |
| P07 unreviewed | › serialized forecast | A data-route row that claims its own allowedUses, outside the bridge revisions and with no reviewed binding, shows "—" (not 2.1) |
| Nonce | › nonce mismatch | A wrong echoed nonce withholds every value ("—"). Reloading the same fixture with the right nonce restores 2.5 / 1.8 / 3.0 |
| Goalie (badge-only) | › Yahoo goalie marks | Provider-snapshot marks show ✓/✗ with "FORGE's start chance unchanged", and points stay at the prior (3.0 / 3.5, if starts 5.0). No "start chance 100%/0%" appears |
| Goalie (server-confirmed) | › trusted server read | Skipped under badge-only. If the release owner picks server-confirmed, it fails until it is extended to the candidate's trusted-read contract |
| P04 | `p04-search-acceptance.spec.ts` | A stale "Ma" response cannot replace the "Mack" results. Links are native hrefs. Hover and touch make **no** `router.prefetch` call. ArrowDown/ArrowUp/Escape work. A plain click or tap calls `router.push('/stats/player/<id>')` and clears the input |

The run also executes the candidate's own `e2e/roster-schedule-optimizer.spec.ts` and any e2e spec that mentions PlayerSearchBar, then records their results.

Why P04 uses a spy: `router.prefetch` is a no-op under `next dev`, so network traffic cannot show a prefetch. The spec wraps `window.next.router.prefetch`/`push`. `useRouter()` delegates to them, and so do next/link's hover and touch handlers.

## How it runs

```
tasks/artifacts/rso-browser-acceptance-2026-10-23/harness/run-acceptance.sh <commit-or-tree>
```

- **Export:** `git -C <repo> archive <id> web` into the scratchpad. Nothing is read from the moving checkout, and no refs, index or `GIT_DIR` are touched.
- **Dependencies:** `web/node_modules` is a symlink to the canonical install. The run is **blocked** if the candidate's `package-lock.json` hash differs from the installed one.
- **Server:** `next dev -H 127.0.0.1 -p 3117` runs from the export with `PLAYWRIGHT_ISOLATED_NEXT=1` under `env -i`, so no shell secrets are inherited. Supabase, CMS, serverless and puppeteer URLs point at `http://127.0.0.1:9`. That overrides the production URLs committed in `.env.development`.
- **Server checks:** the harness refuses ports 3000/3105 and any occupied port, then checks that the listener's cwd is the export.
- **Browser:** every non-local request is aborted, and unmocked `/api/**` returns 503.
- **Current-read mock:** answers both `GET data` (`X-RSO-Read-Nonce`) and `POST yahoo-current-data` (body nonce plus echoed scope). The second route is Codex's in-progress trusted-Yahoo path.
- **Output:** `RECEIPT-<sha12>.json` and `screenshots/<sha12>/` land here. The receipt records sha256 of the key files read from the export, the harness hashes, every test with project, viewport, start time, duration, result and error, and the screenshot hashes.
- **Flags:** `--goalie-policy server-confirmed` switches the goalie expectation. `--validation` files a non-candidate run under `harness-validation/`. The server is stopped on exit.

## Harness validation on HEAD `2a5092d37` (NOT the candidate)

Receipt: `harness-validation/RECEIPT-2a5092d37cb8.json`, sha256 `8f21b3df238ed0a6a627aaf2b6d2ad7343f05a8be0ec318478b013ba141bfc11`. Lockfile matched; server stopped afterwards.

| Check | Desktop | Mobile | Reading |
|---|---|---|---|
| Task 10 + P07 partial | pass | pass | HEAD has P07 R2 and task 10 committed |
| P07 unreviewed serialized row | pass | pass | |
| Nonce mismatch + echo control | pass | pass | |
| Goalie badge-only | fail | fail | Correct negative control: HEAD still applies provider-snapshot marks (5.0 / 0.0, "start chance 100%"). The P07 correction that removes this is uncommitted |
| P04 | fail | fail | Correct negative control: HEAD's PlayerSearchBar still uses Link, so hover/touch call `router.prefetch` (2 calls on desktop, 3 on mobile). The prefetch correction (component `ddd48a75…`) is uncommitted |

The candidate's own `roster-schedule-optimizer.spec.ts` on HEAD: **3 pass, 41 fail, 22 min**.

- **Failure causes:** the failures come from UI drift in the spec, not from the environment. The spec looks for `#rso-plan-details > summary`, "Show schedule-capacity assignment"/"Show lineup analysis", and the old default Itinerary/"Individual player weekly schedule" table. HEAD opens on "By position" and shows plan details through a button.
- **Passing cases:** the refresh, healthy-IR and Yahoo-goalie cases pass on the same server.
- **Consequence:** this is R6/CR-RSO-02 work. If the candidate ships this spec unchanged, those failures will repeat. The receipt keeps their results, but they are not counted against P07, task 10 or P04.

## Needed from the release owner with the candidate

1. **Candidate SHA:** the exact commit or tree SHA. A file snapshot or tarball is not enough: the harness exports with `git archive`.
2. **Goalie policy:** confirm badge-only, or name server-confirmed plus its trusted-read contract.
3. **Lockfile:** a candidate that changes `package-lock.json` is blocked until dependencies are installed for it.
