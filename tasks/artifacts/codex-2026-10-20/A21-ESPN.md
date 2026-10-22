# A-21 — ESPN odds provider decision memo

## Decision

**Keep ESPN odds isolated as an optional market-odds source while the cause is unverified. Do not change schedules, retry policy, provider choice, FORGE/RSO logic, or essential game-prediction coverage from this audit alone.** The supplied A-21 operational summary reports 42 ESPN-related failures in 14 days (about 3/day); it does not establish that those are 42 HTTP 403s. A 403/provider-access explanation remains a hypothesis. No ESPN read or provider call was authorized or made here.

If a provider owner confirms that ESPN access is unavailable or disallowed, take the **source-access** branch: record that decision and make only this optional market-odds source unavailable; preserve unrelated forecasts, ingest health, and report coverage. If evidence instead shows intermittent transport failures, take the **network-error** branch: distinguish fetch/timeout failures from HTTP responses and propose a bounded request timeout/retry policy for separate approval. Do not treat the current evidence as grounds for retries or schedule changes.

## Local evidence

- `web/lib/game-predictions/espnOdds.ts:587–610` fetches each requested date concurrently with `Promise.all`, checks `response.ok`, and throws `EspnOddsHttpError` with status/date for non-2xx responses. There is no `AbortSignal`/timeout in this fetch path. A failure for any date rejects the `Promise.all` batch.
- `web/pages/api/v1/game-predictions/ingest-espn-odds.ts:92–108` maps an `EspnOddsHttpError` with status 403 to `ESPN_ODDS_ACCESS_DENIED`; other HTTP statuses become `ESPN_ODDS_UPSTREAM_HTTP_ERROR`. This provides an explicit HTTP 403 classification, but says nothing about current provider policy or why the status occurred.
- The local source contains no equivalent ESPN-specific wrapper for a network-level `fetch` rejection; the route’s ESPN-specific catch rethrows errors that are not `EspnOddsHttpError`. A network failure therefore must not be inferred from an HTTP status label (or vice versa).
- The handoff names A-21 as an open decision and lists ESPN market odds under game-prediction ingestion; it does not contain fresh provider-side evidence. The 42/14-day count and “403” possibility are owner-supplied audit context, not independently refreshed production evidence.

## Decision gate and next evidence

The decision owner should first reconcile the 42 failures by the stored/error classification already available: count confirmed 403 responses separately from other HTTP statuses, fetch rejections/timeouts, and unknown/unclassified failures; establish whether the counts represent failed dates, invocations, or another unit. Then obtain an owner-authorized confirmation of source access/terms if a 403 pattern is present. **Without that split, source access remains UNKNOWN.** No scheduler change is proposed.

Keep ESPN market odds explicitly separate from model/forecast health: these observations are sportsbook-market data, not FORGE player projections or the Roster Schedule Optimizer’s roster recommendation inputs. An unavailable ESPN source must not be recoded as zero odds or used to invalidate unrelated forecast or RSO coverage.

## Scope and ownership

This is a report-only decision aid for the Claude owner. It does not authorize a provider request, a production read, a schedule or retry change, instrumentation, a source swap, or a release decision. If the source-access branch is chosen, require a separately recorded owner decision and narrowly scoped change/validation plan.
