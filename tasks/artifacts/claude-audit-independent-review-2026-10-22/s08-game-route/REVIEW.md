# S08 stats game route — independent review, 2026-10-22

**Qualified acceptance of the pinned bounded correction. No blocking defect demonstrated within this packet.** This is not whole-S08, S11, provider/data freshness, backend security, or release acceptance. Parent owns integration.

## Verified behavior

- Client and server accept one ten-digit, nonzero-leading string ID. Missing, malformed, ambiguous/multiple or single-element arrays, zero-leading, overlong, and fullwidth-digit inputs do not fetch; invalid server params return `notFound`. This verifies shape and scalar identity, not existence at the provider or the validity of every ten-digit number.
- The actual boxscore API returns `{success:true,data}` or HTTP-200 `{success:false,message,data:null}`. The corrected local fetcher recognizes the latter and produces the safe failure message. Successful null/empty results settle as unavailable instead of remaining loading. HTTP failures and JSON parsing failure also settle safely without rendering private diagnostic detail. Shared API handlers remain unchanged.
- Boxscore admission requires a success envelope and the requested numeric game ID. A different game's boxscore cannot set identity or start a schedule fetch. Matching boxscore identity/status takes precedence over season-series context; matching rail identity still supports partial-boxscore player data.
- Tests use actual installed SWR, with a fresh cache per mount and stable cache during route changes. Late A success/error cannot end B loading, inject A players, start A's schedule lookup after navigation, or set B's warnings. A→B→A also retains current A when old B succeeds or fails. Changing to an invalid ID clears prior panels and prevents a pending rail from restoring them. Late schedule odds from a different date cannot become the current game's probabilities.
- A valid boxscore is visible while rail is pending or failed. Valid matching rail/team statistics remain visible when boxscore or its JSON parsing fails. Failed odds leave game data intact and the market unavailable. This verifies independent panels with valid current identity; it does not establish identity from arbitrary team statistics alone.
- Missing/invalid market odds no longer become 50/50 or score-share probabilities; the American/decimal positive controls preserve the prior normalization. Known zero scores remain labelled `Score`. Missing or one-sided strength values do not draw an equal-strength bar. Genuine zero player counts remain zero and null counts display `-`; same-name players with distinct IDs remain separate.
- Head-to-head results include `OVER`; missing scores and both zero/nonzero ties produce `Result unavailable`, not a winner. Valid unequal nonnegative scores retain a winner. Missing last-ten/head-to-head context is not fabricated as 0–0–0 or a first meeting.

The actual source delta was inspected. It changes local admission, failure/loading/status handling, probability/unknown display, and head-to-head winner guards. Existing player-ID keys, ranking tie-breakers, goalie participation selection, shared APIs, CSS, and accepted statistics/timeline files are outside the implementation delta.

## Independent checks

Fresh isolated snapshot: `/tmp/fhfh-queue-check-tucc0hgy/isolation/snapshot/web`. Node **22.11.0**, npm **10.9.0**, Vitest **3.2.7**. Used the established source-copy recipe, cleared synthetic environment, isolated home/tmp, socket/HTTP(S)/unmocked-fetch denial, and only synthetic fetch responses. Next router/head and the search child were mocked. No test ran with the canonical checkout as its root.

| Check | Result | Evidence |
| --- | --- | --- |
| Owner route cases | **37 passed** | [tests.log](tests.log) |
| Independent ID/race/error/unknown cases | **12 passed** | [fixture](reviewStatsGame.test.tsx), [tests.log](tests.log) |
| Route/owner-test scoped TypeScript plus import closure | **Passed**, exit 0 | [config](tsconfig.s08.json), [log](typecheck.log) |
| Route/owner-test ESLint | **Passed**, exit 0, no diagnostics | [log](lint.log) |
| Changed application files `git diff --check` | **Passed**, exit 0 | [end](hash-verification-end.json) |
| Two candidate, ten unchanged dependency, seventeen accepted preservation pins | All match before/after | [start](hash-verification-start.json), [end](hash-verification-end.json) |
| Reverse application of packet in private copy | Exact before route reproduced; added test removed | [start](hash-verification-start.json) |

Owner baseline `33 failed / 4 passed` evidence was inspected, not rerun or counted as independent results. This review executes **49 cases** once; no unrelated suite was repeated. Synthetic tests disable SWR retry/focus revalidation to keep failures bounded; the production SWR policy is unchanged and was not load-tested.

Commands used existing A7–A9 `run-tests.sh`/`run-check.sh` wrappers with the snapshot above: the two named route test files, `npm exec --offline -- tsc --noEmit --project tsconfig.s08.json`, and `npm exec --offline -- eslint --report-unused-disable-directives-severity warn 'pages/stats/game/[gameId].tsx' __tests__/pages/statsGame.test.tsx`. Diff checking was read-only in the canonical checkout.

## Candidate identity

Branch `octoberBranch`, snapshot/final HEAD `d77602cf7fbdd4549588127603ebf0b535138b99`. Acceptance is tied to the working-tree hashes, not a claim that HEAD contains this uncommitted correction.

| Candidate | SHA-256 |
| --- | --- |
| `web/pages/stats/game/[gameId].tsx` | `dc4f19d8ee1b688a34a816a562fc5e4c01d4bac0e862cd91f272b06b2fa6156f` |
| `web/__tests__/pages/statsGame.test.tsx` | `09807279a24a8fe98bd57e802103e894e21411fa1896b2d437fad7ba4d36b88a` |
| Owner `CANDIDATE.json` | `1ea145d67726c45bd953cbee58a22be730372ee01e33aa0742960274b39da4b3` |
| Owner `packet.patch` | `d9f67b3d17b1577d4f2f96a9e90c2dd16c3cd1d91f567a10f5ca775d176630b1` |

The reverse-patch route hash is `8260a28ebd3bf1b1789d2e544ea1961a24458f59ab109c0358c3b6cfade26b62`. All four P03 and thirteen A7–A9 accepted pins remained unchanged. Ten inspected dependencies/context files, including the corrected P04 search component, also remain unchanged.

## Limits and handoff

Not verified: real browser navigation/visual/AT behavior, server runtime, live provider existence or payloads, cache freshness, production retries/revalidation/traffic, bookmaker/source comparability, model qualification, arbitrary malformed nested provider data, duplicate/missing player IDs, goalie participation correctness, or broad ranking formulas. The fixtures establish request-key isolation and guarded current identity, not an independent identity proof for every right-rail field.

The unchanged head-to-head date display still constructs a `Date` from `game.gameDate` and formats it in the host locale. No date-identity/timezone acceptance is granted to this separate route by the calendar packet. Likewise this packet does not resolve the calendar's finality/WGO-grain/zero-score/RWROW holds.

No application or owner-artifact edits, environment/credential reads, network/provider/production calls, browser, dependency installation, build, commit, push, or deployment. No denied, blocked, pending, or uncertain action; all processes completed.
