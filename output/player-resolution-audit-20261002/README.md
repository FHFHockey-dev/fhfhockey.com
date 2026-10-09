# Player resolution UI independent verification — 2026-10-02

The original Lomberg → Heinen selection-loss bug is fixed in the current dirty integration. The combined resolution family is not ready to claim complete: 28 browser scenarios produced 13 passes and 15 failures across 10 defect groups. Ten selected existing unit tests passed. No application source, existing tests, classifier, avatar, Lines code, manifests, lockfiles, database records, or Git history were changed by this audit.

## Baseline and provenance

- Repository HEAD: `73af9d051ecc755dd3695f5265bf5837bbfc7a4e`.
- Frozen current source: `/tmp/player-resolution-audit-20261002/baseline/web`. 3,387 tracked and current untracked web files copied from the shared dirty checkout, with credential files, caches, and installed dependencies excluded from the source snapshot. All snapshot hashes are in `source-manifest.json`.
- Dependencies: independent APFS copy of the existing installation, Node 22.11.0, Next 15.5.22, React/React DOM 18.3.1, Playwright 1.60.0, Vitest 3.2.7. Actual Chromium: 148.0.7778.96. See `dependencies.json`.
- Local origin: `http://127.0.0.1:3217`. Dummy Supabase configuration points at unused loopback port 39999. No real environment files, saved browser profile, credentials, or production session were loaded.
- Fresh browser context per scenario, service workers blocked, interception installed before navigation. Every player-name-aliases GET/POST was fulfilled by fixtures; other APIs, non-GET traffic, and external requests were blocked. Source/API review and selected server unit tests used mock query methods only.
- Root AGENTS.md and mise-en-place.md read. No repository/web `.agents` directory or nested web AGENTS.md was found. Browser-verification and Supabase skills were read; no Supabase feature was implemented and no live query was made.
- The initial whole-directory dependency symlink caused duplicate React hooks. Copying identical existing dependencies locally fixed this baseline setup issue without changing application code. Sandbox escalation was automatically approved for localhost listening and normal headless Chromium. No sandbox-disabling flags or security-setting changes were used.

| Surface | Provenance | SHA-256 / role |
| --- | --- | --- |
| `web/pages/db/player-aliases.tsx` | Queue commit `0634e717f`; split commit `ac5728222`; current uncommitted retention fix from task `01a0f724-cb90-701a-acd9-22277eacf0f4` | `52dcbd1e8b1f0f6833974e9babd8f9ed89a9336d7b61a9e9e53782ed88c5168c` |
| `web/pages/db/player-aliases.module.scss` | Committed queue styling and split panel | `cca372304551c3dc1ea92a855922e050a08b4f22fdd693610f237fb225c8b90d` |
| `web/__tests__/pages/db/player-aliases.test.tsx` | Current untracked five-test regression file from dropdown task | `f7a59f02d6ee1ebe6df8d933b09a3e315fd19fc1c356766fb63ad9e33f620d06` |
| `web/pages/api/v1/db/player-name-aliases.ts` | Committed route; split handling from `ac5728222` | `8f398eeaae19c53b1181d2de5da951db3d9087f3c39ff0f8a16d659e6998609d` |
| `_app.tsx`, Layout/Header, auth context/client, shared panel/vars | Current integrated shell and styles included byte-for-byte | Individual hashes in source manifest; adjacent dirty edits preserved |

Relevant source boundaries: selector retention at page lines 233–238; queue load/reset 188–219; lookup 240–257; saves 260–292; queue switching/form 317–421; API GET contract 26–69; split validation/save 96–113; token dispatch 243–270; token scope in `lib/sources/playerAliasReviewToken.ts`.

Supported history was read for both tasks. The dropdown task reported five unit passes and seven mocked browser checks on the same HEAD. Those browser checks returned an unchanged fixture after saves, so they did not establish real pending-only advancement, completion history, or async safety. Queue/split task `01a0c426-1906-7ee2-930a-1899f25af115` reported queue styling, two-player saves and parser changes. This audit reviewed only the resolution UI/API family; it did not resume classifier/parser work.

## Passed coverage

- Integrated page loads and controls render without page exceptions or framework overlays after dependency isolation.
- Both Lomberg-first and Heinen-first retain their own visible options across the second search and a zero-result search, with no duplicate options. Split submits exactly the expected two IDs and aliases.
- Ordinary Match player retains its selection; clearing one split selector does not clear the other or the ordinary selector.
- Sidebar and pending-name dropdown switching clear unsaved ordinary/split selections, returning is clean, and no POST occurs.
- Reload abandons unsaved work; selecting again and retrying works. There is no dedicated Cancel button; cancellation was exercised by clearing, switching, and reloading.
- Pending-only responses advance after a split; Ignore advances and a final Ignore reaches the empty state and zero count.
- Failed split and ordinary saves display the mocked error, preserve choices, and succeed on retry.
- Ordinary alias and Ignore carry the review token; both succeed against a token-required fixture.
- Native select typeahead (`r` for Ryan, `d` for Danton), Enter and Tab reach the split save button at all three tested widths. At 768px, controls also fit the viewport.

Existing Vitest results: five dropdown/UI tests passed; five selected API identity/lookup tests passed, four unrelated tests skipped. These server tests do not cover split transaction behavior or live authorization. Commands and outcomes are in `unit-results.json`.

## Reproducible defects and minimal recommendations

1. **P1 — stale lookup selects a player for a different review item.** Enable membership review, search NHL ID 8479066, hold its lookup GET, switch from Lomberg-Heinen to Soucy-Andrae, then release the response. Match player changes from blank to Ryan Lomberg and the import/save action becomes available for the new row. Changing the search to Heinen while that lookup is in flight also applies the obsolete Ryan result. Page 240–257 has no request/item/search validity check; switching clears IDs but not lookup state. Capture an operation generation, selected row and search; discard mismatched responses and invalidate/clear lookup on switch or search change.

2. **P1 — duplicate clicks issue duplicate mutations.** Hold a split, ordinary alias or Ignore POST, then double-click its button. Each action emits two identical POSTs instead of one. The UI has no save guard or busy state. Add a synchronous in-flight guard shared by mutation actions and disable the corresponding controls through save/refresh. Server pending-status/idempotency enforcement is a separate useful safety layer; this audit did not exercise real writes.

3. **P1 — split omits the review token.** Open `?reviewToken=fixture-review-token` and split Lomberg-Heinen. The POST has no reviewToken, and the token-required fixture rejects it. Ordinary alias and Ignore include the token and pass. Page line 290 should reuse the same token forwarding as those actions. The real route reads POST tokens from the body at lines 249–259; token-only reviewers would fall back to the admin gate. Actual production auth rejection was not tested.

4. **P2 — failed Ignore is an unhandled rejection.** Return HTTP 500 `{success:false,message:"Mock save failed"}` for Ignore. Browser records `Error: Mock save failed` as an unhandled rejection; no recoverable status appears. Its click handler invokes `ignoreName()` without the error catch present on split/ordinary save. Apply the same explicit error handling.

5. **P2 — save success followed by refresh failure leaves Loading stuck.** Let split POST succeed, then fail the reload GET with `Mock refresh failed`. Status shows the refresh error, but Loading remains visible. `loadData()` sets loading before await and clears it only on success; the initial effect catch does not cover post-save refreshes. Use `finally` for loading, distinguish saved-but-refresh-failed from a failed mutation, and offer a read retry without re-posting the completed save.

6. **P2 — delayed save destroys a draft on the next item.** Hold split POST for A, switch to B, select Soucy, release A's POST. The refresh resets B's Soucy choice to blank. Either prevent switching while mutation/refresh is in flight, or apply/reset results only when the reviewer is still on the captured row and draft generation.

7. **P2 — older queue response restores an ignored item.** Save A and hold its GET snapshot showing B pending. Switch to B, Ignore it, hold its GET snapshot showing no rows. Deliver the empty newest response first: empty state appears. Deliver the older response second: B returns as pending and the remaining count becomes 1 despite both mocked mutations succeeding. `loadData()` accepts all response orders. Add a latest-request generation check (and optionally abort obsolete reads). The final harness clones each fixture response at request time, reproducing genuinely different historical snapshots.

8. **P2 — resolved progress is absent with the actual GET contract.** Save the first of two pending rows. The next item and remaining count 1 appear, but “1 resolved in this queue” never appears. API lines 42–48 filter to pending, while page `resolvedNames` is derived only from freshly returned rows. Keep session-local completion history while merging pending refreshes, or return explicit authorized completion metadata. Do not rely on fixtures that retain resolved rows. The displayed queue count is also the loaded page size, capped at 50 by default, not a verified global total.

9. **P2 — item-scoped deep link cannot advance to the broader queue.** Open `?unresolvedId=fixture-0`, resolve it, then return the route's item-filtered pending results. The UI becomes empty despite B remaining pending elsewhere. A valid single-item token instead returns the resolved original row because the route skips pending filtering for valid tokens. Preserve single-item token scope and show a completion state; for an authorized queue-scoped workflow, explicitly load the queue after finishing the item. Do not silently broaden token authority.

10. **P2 — split validation/layout defects.** `Alpha-Beta-Gamma` matches `/^\S+-\S+$/`, rendering three selectors backed by a two-element tuple. Selecting Alpha and Beta enables Save while Gamma is blank; the handler would map the absent third value to NaN/null, and the real API rejects anything other than two parts. Restrict split eligibility and validation to exactly two nonempty parts. Separately, at 320px and 390px, review inputs/selects extend to x=485 and the second split selector extends to x=468, beyond both viewport widths. The document reports no horizontal overflow because the shell clips it, so scrollWidth-only checks miss the problem. Add `min-width:0` to grid items/controls, use `minmax(0,1fr)` columns, and stack split fields on narrow screens. Screenshots and control bounds substantiate clipping; keyboard focus itself passed.

## Reproduction and limits

The final `verify.cjs` harness accepts an optional case-name regex. It defaults to the still-preserved isolated baseline's local `baseline/web/node_modules`; execute it from `/tmp/player-resolution-audit-20261002` while the baseline server is running. The durable copy here is evidence; to run it here, supply an adjacent baseline or copy it back to the preserved temporary folder.

```sh
cd /tmp/player-resolution-audit-20261002/baseline/web
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:39999 NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=mock-local-anon SUPABASE_URL=http://127.0.0.1:39999 SUPABASE_SERVICE_ROLE_KEY=mock-local-service CMS_URL=http://127.0.0.1:39999 npm run dev:stable -- -H 127.0.0.1 -p 3217
```

```sh
node /tmp/player-resolution-audit-20261002/verify.cjs
# Focus one defect without repeating passing checks:
node /tmp/player-resolution-audit-20261002/verify.cjs 'Stale NHL|Out-of-order'
```

macOS sandbox may require the same supported escalation used in this audit. The local server was stopped after testing. No build, commit, merge, push, deployment or migration occurred. No dependency upgrade is needed for the tested UI defects. Use independent copied dependencies for a frozen baseline rather than linking the whole node_modules directory; keep npm/lockfile and Node 22.11.0 authority.

`receipt.json` consolidates the latest execution of each of 28 unique scenarios. Initial ArrowDown/Space native-popup probes failed in this headless macOS runtime; verified typeahead superseded those harness failures. They are not counted as UI keyboard defects. Console resource failures from blocked fonts/analytics and intentionally failed mock endpoints are expected; the Ignore rejection is recorded separately. External fonts were deliberately unavailable, so layout measurements use the browser's local font fallbacks.

All four resolution-family source/test hashes still match their initial values (`source-integrity.json`). Other agents may continue changing unrelated files; this audit preserved them. Live authentication, deployed source parity, real split-save/database atomicity and production behavior remain unverified gates. Local findings are sufficient to recommend the focused changes above without making a production request or save.
