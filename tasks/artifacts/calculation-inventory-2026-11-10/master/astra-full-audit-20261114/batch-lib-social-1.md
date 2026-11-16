# Social goalie calculations: frozen audit batch 1

Pin: `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Seven scoped files, 2,350 lines fully read, 1,744 unique source-offset inventory rows. See `batch-lib-social-1-manifest.json` and `.tsv`. No application edits, real queries, page loads or provider calls. The supplied tests were read in full, not executed.

## Findings

### AFULL-SOCIAL1-01 — P1 — schedule identity omits the report date

- Location: `web/lib/socialShare/modules/creaseShift.ts:77–91,100–103`; caller `creaseShift.sources.ts:83–96`.
- Claim: the regular-season schedule supplies the completed-game membership, dates and completeness of the last-N official-start denominator.
- Evidence: exact frozen `buildCreaseShift`, reconciliation, last-N and official history modules in `social1-probe.cjs`; retained output `social1-probe-output.json`.
- Scenario: two NJD–NYR games are scheduled Oct 1 and Oct 3. Both Oct 1 team reports and that goalie's appearance are incorrectly dated Oct 4. The normalizer sorts those rows by their recorded date. The result is `ready`, with the Oct 1 game selected as NJD's last game, displayed as Oct 4; actual latest schedule membership is the Oct 3 game. The coverage check marks the real Oct 1 night complete using only team and game ID. A reported row for an unrelated team can also survive the final-ID-only filter.
- Fix: reconcile reports on game ID, exact schedule date and scheduled participant, and base both completeness and accepted game rows on that same join. Do not silently rewrite conflicting source dates.
- Readers: Crease Shift card/alt text and shared schedule evidence used by goalie cards. Game Grid's lazy history loader already prefilters exact team/date membership at `creaseShift.sources.ts:66–69`; this scenario does not bypass that stronger loader.
- Test gap: existing trade, missing-game and duplicate-starter tests exercise valid report identity. Add a misdated report and a nonparticipant-team case to the existing suite.

### AFULL-SOCIAL1-02 — P1 — goalie statistics bypass completed-schedule membership

- Location: `web/lib/socialShare/modules/goalieGsax.ts:78–123` and `goaliePeriod.ts:182–195`.
- Claim: only completed regular-season games enter the observations; the finality warning explicitly says an unfinished game is not counted.
- Evidence: exact frozen builders and shared statistic modules in the same probe. Supporting loader/source reads confirm that appearance queries filter season/date, not membership in the final regular-season schedule. `PostStudio.tsx:65–76` displays partial cards; `contract.ts:166,175` blocks their export but permits display.
- Scenario: Oct 1 is unfinished and Oct 3 is final. One goalie has NST xGA/GA 12/2 on Oct 1 and 3/2 on Oct 3. GSAx says the unfinished game is not counted, yet returns 2 appearances and GSAx 11 (5.5 per60); the final-only control returns 1 appearance, GSAx 1 and 1 per60. Goalie of the Period likewise gives that goalie 2 starts and 10 category cells rather than one start and five cells. With the Oct 1 game absent from the regular-season schedule entirely, both builders return `ready` while retaining its observations. This also leaves nonregular-season WGO rows, which the loaders intentionally read, without a downstream game-membership gate.
- Fix: admit goalie appearances through exact completed schedule game/team/date membership before constructing last-N windows, weekly baselines, counts, coverage or ranks; keep missing membership explicit. Use the same admitted rows for finality evidence and statistics. Preserve the separate, labeled NST coverage threshold.
- Readers: GSAx and Goalie of the Period cards, winners/ranks, category baselines, evidence and alt text. Out-of-schedule cases can pass the ready-state export gate; no actual export or live defect is asserted.
- Test gap: both suites' tests titled “does not count a reported game with no final game state” assert only state and warning text. Their numeric assertions do not establish exclusion. Extend those tests to assert accepted game membership, numerator, denominator and ranks.

## Traversal and controls

- `creaseShift.sources.ts` (96): season limits include playoff rows, while schedule reads are type 2; exact-count pagination and per-200-ID finality reads fail closed. Exactly one stored PBP game-end is the retained finality basis, distinct from an actual completion timestamp. Lazy Game Grid history constrains one team, dates, started-by time and exact report identity; current-recorded-results provenance is explicit. No retrospective-as-issued claim.
- `creaseShift.test.ts` (647), `creaseShift.ts` (283): official starts vs relief, trade team binding, unresolved starters, comparison minimum outside overlap, exact cross-product share changes and deterministic tied ordinal ranks. Series denominators intentionally include unresolved completed games, credit no starter, and hold across missing reports; whole-window shares are withheld. Newest incomplete nights trim with a note, older gaps remain partial. Picked teams keep league ranks; color contrast and geometry tests are source-only.
- `goalieGsax.test.ts` (317), `goalieGsax.ts` (182): xGA minus GA, never NST GSAA; minutes-to-seconds once; same goalie/date pairing; minimum appearances and explicit coverage percentage; covered-subset totals are labeled. Sign-preserving per60, worst/best ties, model separation, chosen/week/last-N scopes, source lag, missing xG and empty pools. FHFH model rows are never blended or served as NST xG. Valid one-game arithmetic control passed. No current model or empirical skill qualification.
- `goaliePeriod.test.ts` (569), `goaliePeriod.ts` (256): per-week baselines, custom/month majority-day week ownership and later-side tie, separate game/week cells, min-start admission, starts vs relief, pooled shared ratios, TGV's own eligibility/tie method. Existing zero-baseline TGV behavior remains the previously documented definition caveat, not a reopened tie finding. ADP fallback is explicitly defined and tested: no numeric pick or no Yahoo match counts as the all-season highest average pick rounded up to ten; unread Yahoo evidence yields unavailable. Separate best/worst board means, ambiguity-safe mapping, category labels and exact alt-text counts checked. Partial-newest-night trimming retains its period label and note.

Bounded context-only reads: goalie ledger adapters/readers, GSAx/period sources, card admission and previously audited shared pure modules. They receive no new scope credit. These checks concern frozen source only, not Claude's capture or later Rankings release.

## Execution receipt

The first probe assertion used unsorted synthetic reports, unlike the actual normalizer; corrected fixture ordering before interpreting the result. The corrected probe passed. A subsequent meaningful extension added absent-schedule ready-state cases and passed. Inert module-descriptor/settings stubs are explicit; unused calendar/source dependencies throw. No actual app imports, environment values, I/O services, Vitest, browser rendering or server starts.
