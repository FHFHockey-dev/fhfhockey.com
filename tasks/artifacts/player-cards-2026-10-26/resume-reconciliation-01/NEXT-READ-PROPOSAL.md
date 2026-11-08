# Smallest next source read — proposal only, not executed

Purpose: obtain the complete official season appearance list for the already investigated player before proposing league-wide reads. Current admitted bytes contain only five ingestion observations and cannot establish history.

- Source: official NHL public player game-log endpoint, the same route pattern already used at web/pages/api/v1/db/update-nst-gamelog.ts:1960.
- Exact route: https://api-web.nhle.com/v1/player/8476453/game-log/20262027/2 (Nikita Kucherov, season2026–27, regular season).
- Budget: one sequential GET, concurrency1, one execution, no retries/redirect following/pagination/fan-out. Request timeout5seconds, process bound15seconds, body cap2MiB, gameLog cap100rows. Stop and report any limit/error; no second request.
- Read only: no database query, API refresh/cron/ingestion/backfill, credentials, private-account/league data or writes. Persist only returned public game data and capture time/hash locally. No paid model/provider processing.
- Inspect identity/season/type, duplicate/missing games and endpoint completeness semantics before admitting an appearance-history claim. The endpoint's date must retain provider-game-date until independently joined and verified; do not relabel it UTC.
- Historical target remains the original Oct24 00:00UTC cutoff for comparison; newly captured data are retrospective and do not prove what was known then. Later games must not enter that cutoff without independently verified finality/date semantics.

This request settles only a bounded history input. It does not request actual-game-end endpoints, source-metric reads, a roster-wide database scan or rank-population acquisition. Those need separately specified source paths/limits after this response and finality-source discovery; no existing endpoint has yet been shown to return an authoritative actual UTC end time. Provider metric/null-zero definitions can continue to be traced offline. The old five-game SQL authorization has already been consumed and is not reused.
