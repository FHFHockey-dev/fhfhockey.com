# Live FORGE pregame release package, November 19, 2026

**Status:** local and production-schema-copy rehearsals only. Nothing was pushed, and production data, migrations and cron are unchanged. The base is master `66ce25aa3`.

The package adds one approved, game-scoped live run per game:

```
capture → independent verdict (verifier package) → one publication → both RSO readers traced to that claim
```

Production's flags (compute off, serving off) and the daily run are unchanged.

## How it runs (T = puck drop of the approved game; release deployed at the exact SHA)

1. **Approve and arm.** Run `approve-and-arm.sql` as postgres with `-v game -v player -v release -v approver -v capture_at -v publish_at -v close_at`.
   - It inserts one `forge_pregame_capture.live_runs` row (game, center player, release SHA, approver), arms it, and schedules three one-shot jobs: `forge-live-capture-<game>`, `forge-live-publish-<game>` and `forge-live-close-<game>`.
   - It refuses unless job 408 is off (checked before and after), cron runs in UTC, the Vault `cron_secret` exists, only one run is open, the schedule is ready and unchanged, no custody exists for the game, and the time is before T−64.
2. **Capture** (fire at or before T−66). `live_fire_v1` sends one `net.http_get` to `https://fhfhockey.com/api/v1/db/forge-live-capture`, in WGO's shape: Vault `cron_secret` as Bearer, 240,000 ms.
   - The route binds through `forge_live_capture_begin_v1(VERCEL_GIT_COMMIT_SHA)`. It refuses when nothing is armed, on a release mismatch or a stop, after the T−64 claim window, or after a schedule change.
   - It then runs master's v1 capture inside `withForgeEnv({compute, serving, canary: this game})`.
   - The custody tables decide the outcome (`forge_live_capture_finish_v1`).
3. **Verdict** (by T−60) comes from the separate verifier package (`refs/rc/forge-witness-verifier-20261119`): `arm-witness-verify.sql`, route `/api/v1/db/forge-witness-verify`, schema `forge_witness`. This package only calls its interface:
   - `forge_witness.publication_gate_v1(claim, raw, canonical, token)`, which returns `{accepted, reason, verifiedAt, deadline}`;
   - `forge_witness.require_accepted_v1(...)`, which raises `witness_verdict_required`.
4. **Publish** (fire after T−60, at least 3 min before T).
   - `forge_live_publish_begin_v1` requires the same release, a qualified capture, and `publication_gate_v1` accepting the exact claim with all three stored hashes. Otherwise it returns `awaiting_verdict`, or ends the run once the verdict deadline has passed.
   - The real FORGE publisher publishes once from that claim.
   - Inside `forge_pregame_publish_v1`'s own transaction, a `BEFORE INSERT` trigger on `forge_pregame_capture.publications` (`require_live_verdict_v1`) checks the stage, claim, release and pre-puck-drop conditions, then `PERFORM`s `forge_witness.require_accepted_v1`.
   - Both real RSO readers then read the committed revision in the same scope. `forge_live_publish_finish_v1` records success only if exactly that claim's publication committed and both readers name that claim and revision.
5. **Close** (at or after T). `live_close_v1` records anything unfinished as unresolved, never retried. Before T it does nothing. Every terminal path unschedules this game's jobs.

**Fail-closed:** a dead or absent operator Mac changes nothing. Jobs fire once and self-unschedule, the begin RPCs and the trigger refuse outside their windows, and close ends the run.

**Stop:** `stop.sql`. **Disarm all:** `disarm.sql`. **Receipt:** `readback.sql` (cron runs → pg_net responses → custody → verdict → publication → readers). **Rollback:** `rollback.sql`, which refuses while a run is open or after a live publication.

## Access

| Caller | Credential | Reach |
| --- | --- | --- |
| Supabase Cron (`postgres`) | Vault `cron_secret`, sent as Bearer to the routes | `live_fire_v1`, `live_close_v1` |
| `/forge-live-capture`, `/forge-live-publish` | `CRON_SECRET` (`invokedByCron`); **service role**, the existing production capture pattern (`hostedGame`/`runner` already capture with it) | `forge_live_*_v1` RPCs, the custody RPCs, `forge_pregame_publish_v1`, readers |
| Verifier | its own NOLOGIN owner and role (verifier package) | `forge_witness` only |

`withForgeEnv` is entered only by these two routes and the sandbox route; a repository-scan test enforces that.

## Displacement fence

**Without a fence:** a newer one-game publication would be served by:
- `runs/latest`;
- `forge/players` and `forge/goalies` (including the goalie grid);
- `externalInputProof`'s latest-run requirement;
- the RSO daily bridge;
- `run-projection-accuracy`;
- game-predictions;
- the Yahoo starter board.

**With the fence:** each of these applies only outside a `withForgeEnv` request, so the run's own readback still sees its publication.

| Module | Change |
| --- | --- |
| `lib/projections/forgeScopeProbe.ts` (new) | Dependency-free scope probe, safe in client bundles; it defaults to "not scoped", which means fenced. `forgeEnvScope.ts` installs it. |
| `lib/projections/externalInputProof.ts` | A `qualified_pregame_receipt` snapshot proves nothing. This covers every proof-gated reader: forge and projections routes, the RSO bridge, the goalie grid, start-chart and game-predictions. |
| `lib/projections/releasedRunFence.ts` + `apiHelpers.ts` + `pages/api/v1/runs/latest.ts` | New `excludePregamePublications` (`metrics->pregame_publication IS NULL`) for the two readers that pick a run without a proof: `requireLatestSucceededRunId` (accuracy) and `runs/latest`. |
| `lib/projections/gameRevisions.ts` | `loadForgeGameRevisions` drops `pregameObservationRequired` revisions (Yahoo board). |

**Rehearsed after publication:**

| Check | Outside the scope | Inside the scope |
| --- | --- | --- |
| `runs/latest` | 404 (never serves the pregame run alone) | the claim |
| Proof | false | true |
| Revisions | 0 | 1 |

Planning revisions and `forge/forecasts` stay off because the serving flag is off.

## Migrations (apply order: publication → verifier → live run)

| File | SHA-256 |
| --- | --- |
| `supabase/migrations/20261118135813_forge_pregame_publication.sql` (verbatim, matches APPROVAL.md) | `4a70657ae3e0841f6fac1e66ee608ed866c5152b83a23dd10a83f5b435373f97` |
| verifier package migration | owned by forge-verifier |
| `supabase/migrations/20261119230000_forge_live_pregame_run.sql` | `b546ea3e6fb8622fe9c60c043bb67e4b85e01f2e5b23602fd90e776b8c2f3619` |

There are no Vercel environment changes and no flag changes.

**Release admission:** the producer closure changes from master's `78655939…` to `ca6534eb2c1c8352ad75a0be0d304abd0ffc524bebc380cd3b4644ed4fed1704` (verified: 243 modules, 0 findings). Listing it needs the separate allowlist commit, approved by TJ.

## Rehearsals

- **Local (`check_live.py`, PostgreSQL 15 + PostgREST 16.6, production flags; platform without the publication objects, then the repository migration files applied; verifier stub per the agreed interface).** See `LOCAL-REHEARSAL.json`.
  - Capture 200 qualified.
  - Publication without a verdict is refused (`awaiting_verdict`) and consumes nothing.
  - After the accepted verdict, publication 200 succeeded: Daily 2.965 at C#1, Detailed `missing_participation` on the same revision.
  - Duplicate GETs return `none_armed` and `none_ready`. One publication. Jobs self-removed; job 408 off.
  - The displacement table above held.
  - Final run on `5133f5968`: capture 200 in 222 ms; publish 200 in 5,250 ms (publish 5,202, readers 42); claim `a8439134…`, revision `807b03c0…`.
  - The routes were called directly; the local `net.http_get` stub records the request but sends nothing, so `httpResponses` is empty there. A hosted run reads them from `net._http_response`.
  - One optional read failed on fixture data only: the fixture's `nhl_team_data` has no `season_id` (production's view has it), so the bridge skipped team priors, as designed for optional inputs.
- **Production schema copy (`PRODCOPY-LIFECYCLE.txt`).** Chef's `pg_dump --schema-only` of production was loaded on stubs. 527 of 538 relations loaded; the remainder depend on `internal_stats`, which is outside the dump.
  - Publication migration → verifier stub → live migration all apply cleanly.
  - Approve/arm for 2026020358 succeeds with job 408 left off.
  - Fences:
    - publish before capture: refused;
    - close before puck drop: no-op;
    - capture fires once, then `already_fired`;
    - begin: `release_mismatch` with a wrong SHA, `started` with the right one;
    - stop: jobs go 3 → 0, then fire and begin refuse;
    - schedule moved: `schedule_changed`.
  - Rollback refuses while open, succeeds after stop, and the migration re-applies.
  - The full capture → publish chain needs fixture data, so it ran on the local platform above.

## Tonight (from master policy: read 120 s, required 240 s, skew 2 s; claim ack T−60)

| Game | Puck | Latest dispatch | Claim by | Verdict by | Publish and readers before |
| --- | --- | --- | --- | --- | --- |
| 2026020356 | 02:00Z | 00:53:58 | 00:56:00 | 01:00:00 | 02:00:00 |
| 2026020357 | 02:40Z | 01:33:58 | 01:36:00 | 01:40:00 | 02:40:00 |
| 2026020358 | 03:00Z | 01:53:58 | 01:56:00 | 02:00:00 | 03:00:00 |
