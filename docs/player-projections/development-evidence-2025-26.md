# Player Forecasts 2025–26 Development Evidence

Generated 2026-08-02. This is development evidence, not a lockbox result and not promotion evidence.

> Historical note: the lockbox was subsequently opened exactly once on
> 2026-08-04 after a later reviewed artifact passed the development gate. See
> `lockbox-evidence-2025-26.md`. The artifact/checksum described below is the
> earlier development baseline and must not be registered for shadow serving.

## Sealed source audit

- Contract: `player-forecasts-research-v1`
- Contract SHA-256: `9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574`
- Primary season: 2025–26 regular season only
- Development cutoff: games through 2026-01-02
- Unopened lockbox: 2026-01-03 through 2026-04-16
- Historical supplement: 2024–25 regular season
- Games: 2,624; SHA-256 `3f8a3a188975cbfa956420fc570c7b1f2211918ee78db0bd525ae1422e4954dc`
- Skater outcomes: 94,375; SHA-256 `6058a3929dad71feeea45f0f9c9bd75f146750da9c5ce3e9ecc2c6d4da154a27`
- Goalie appearances: 10,492; SHA-256 `ee8ac4151a59e3c9132128346518833110c3ac071a1adc5a32e65298b6742aa4`
- Cutoff-safe skater target rows: 330,050; SHA-256 `8f0f942fc7919eead42a5b41f96ccb3699fae4b50335169ce3b4a66f982c1d51`

The raw goalie rows remain sealed, but they are excluded from modeling because an appearance is not a trustworthy starter label. Playing probability, start probability, and prospective-enriched targets are also excluded. No availability timestamp was synthesized.

## Rolling-origin baseline tournament

Candidate selection used three ordered validation periods inside development: 2025-10-21–11-15, 2025-11-16–12-10, and 2025-12-11–2026-01-02. The winning transparent baseline per target was:

| Target | Selected baseline | Rolling-origin MAE | Validation rows |
| --- | --- | ---: | ---: |
| Assists | last-10 mean | 0.3983 | 19,656 |
| Blocked shots | EWMA 0.05 | 0.7332 | 19,656 |
| Goals | last-10 mean | 0.2616 | 19,656 |
| Hits | EWMA 0.10 | 0.8553 | 19,656 |
| Penalty minutes | career mean | 0.7520 | 19,656 |
| Shots on goal | career mean | 1.0304 | 19,656 |
| Time on ice (seconds) | EWMA 0.20 | 112.8051 | 19,656 |

The artifact is deterministic for an unchanged freeze and has SHA-256 `5320620a580db419efe55d73e9bff518acd5b8b407734ca8ab2633fa6716c4ba`. It is explicitly `lockboxReady=false` and `promotionEligible=false`.

## Gate status

The primary lockbox has not been opened. The evaluator was exercised with the required confirmation token and correctly refused this artifact because candidate model-family comparison, distributions/calibration, historical goalie-start labels, and availability targets are incomplete. A receipt was not created.

Before the single primary evaluation can be authorized, the development stage must add and freeze the preregistered penalized distributional candidates, calibration diagnostics, subgroup checks, and an approved goalie-start-label policy. Any result obtained by changing the model after opening the lockbox must be labeled validation evidence and confirmed prospectively in 2026–27 shadow operation.
