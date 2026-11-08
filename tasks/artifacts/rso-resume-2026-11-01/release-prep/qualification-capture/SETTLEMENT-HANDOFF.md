# Offline E3 settlement normalization

Implemented the missing saved-data settlement adapter supporting consolidated RSO task **2.3** and FORGE-QUAL's E3 specification. This is an isolated preparation artifact; the retained FORGE-QUAL tooling, scientific scope, application candidate and production remain unchanged.

`normalize-settlement.mjs` reads an approved saved capture descriptor, normalized issued population and saved `forge_player_game_strength` rows. It emits checker-compatible settlement rows to stdout and an audit to stderr. It opens no network/database connection and writes no file itself.

The capture descriptor contains `date`, an explicit timezone-bearing `observedAt`, the frozen `gameIds`, and an explicit positive integer `settlementVersion`. Version 1 is the original capture; a repair must use a new version and new output paths. Existing files are not to be overwritten. The saved strength rows use the schema's `game_id`, `player_id`, `shots_es`, `shots_pp`, `shots_pk`, and `updated_at` fields.

The adapter:

- Requires prospective dates after the sealed October 23–30 block, horizon 1, SHOTS_ON_GOAL and matching issued game/date/player identity.
- Refuses a capture before D+1 noon in **America/New_York**, including daylight-saving changes. This is a lower-bound check, not proof the prescribed scheduled read occurred on time.
- Computes actual SOG only from three known, nonnegative integer ES/PP/PK counts. Complete observed zeros remain zero. A missing row/component/clock or pregame source record remains unknown with an explicit reason; absence never becomes a non-dresser zero.
- Preserves `updated_at` as `recordedAt`, records capture time separately, and rejects future updates, ambiguous timezones, impossible calendar timestamps, duplicate identities, foreign games and malformed counts. All four clocks (capture, source, issue and scheduled) use the existing production `timestampMicros` parser; chronology retains PostgreSQL microseconds.
- Preserves every issued row. Additional source rows are counted in the audit, without creating forecast opportunities or changing the evaluation population.

The 10,000-row local input ceiling is a defensive parser limit, **not** a new scientific population or an approved database query budget. Game completion, affirmative non-dresser evidence, original issuance/admission and protocol timing still require their own evidence. The audit explicitly grants no qualification and does not establish final game status. This tool neither chooses an accuracy cohort nor computes metrics.

## Verification

**18 synthetic tests pass under both UTC and America/New_York**, including the actual integrity checker and CLI, null versus observed zero, missing fields, duplicates, wrong target/horizon/game/date, invalid/future clocks, New York winter/daylight time, explicit repair versions and unissued source rows. Six new regressions failed against the audited source before correction: four impossible month-end clocks, a non-leap February 29, and microsecond chronology. Evidence: `timestamp-review-fix/after.json` and `REVIEW-RESPONSE.md` in that directory. The original 12-test receipt remains historical. No live or sealed payload was read.

The standalone Node entry point loads the repository's existing pure TypeScript timestamp parser through `timestamp-parser.cjs` and the already installed `web/node_modules/ts-node`. It does not install dependencies or load application clients, environment files or credentials.

From the repository root:

```sh
node --test tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/normalize-settlement.test.mjs
```

For a **previously authorized, already saved** capture, use fresh output names and shell no-clobber protection:

```sh
(
  set -C
  node tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/normalize-settlement.mjs \
    capture.json issued.json strength.json > settlement.v1.json 2> settlement.v1.audit.json
)
```

Pass `settlement.v1.json` to the existing integrity checker's `--settlement` argument alongside the same issued/readback/scope files. Review the audit and unknown rows before any metric work. The command does not authorize new inputs, production queries, source repair or acceptance.
