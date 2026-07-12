# FORGE Command Center Reconciliation Checklist

Status: implementation verification in progress. Complete source-to-render value and six-viewport checks before promotion.

| Module | Source APIs | Source Tables | Rendered Values To Reconcile | Freshness State | Verification Method | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Team Power Terminal | `/api/team-ratings`, `/api/v1/trends/team-ctpi`, `/api/v1/start-chart` | `team_power_ratings_daily`, `team_ctpi_daily`, `games` | Power score, league delta, CTPI, matchup edge, offense, defense, pace, trend, finishing, goalie, variance | Module status plus resolved date | Compare rendered CAR/NJD values against `loadCommandCenterData().modules.teamPower` and focused slate matchup map | Pending visual/data reconciliation |
| Focused Slate + Goalie Context | `/api/v1/start-chart` | `games`, `goalie_start_projections`, `forge_player_projections` | Focused matchup, logos, power edge, pace, fantasy environment, goalie probability, stream grade | Module stale/fallback banner and `resolvedDate` | Compare focused matchup selection against highest computed environment in normalized start-chart games | Pending visual/data reconciliation |
| Top Adds Watchlist | `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, `/api/v1/transactions/ownership-snapshots` | `forge_player_projections`, `yahoo_players` | Rank, player, position, team, ownership, ownership movement, projection, add score, sparkline | Module status and projection `asOfDate` | Compare rendered ranked rows against `rankTopAddsCandidates` with default 25-75 ownership band | Pending visual/data reconciliation |
| Player Insight Core | `/api/v1/sustainability/trends`, `/api/v1/trends/skater-power`, `/api/v1/transactions/ownership-trends` | `sustainability_scores`, `rolling_player_game_metrics`, `yahoo_players` | Trust rows, fade rows, quadrant points, momentum score, status chips | Module status plus sustainability/skater resolved dates | Compare rows against sustainable/unsustainable feeds and skater trend aggregation with default 25-50 ownership band | Pending visual/data reconciliation |
| Goalie Context Panel | `/api/v1/forge/goalies` | `forge_goalie_projections`, `goalie_start_projections` | Starter probability, projected shots against, saves, goals allowed, win/shutout probability, volatility, blow-up risk, recommendation | Module status plus goalie `asOfDate` | Compare rendered rows against normalized goalie rows; confirm uncertainty note remains visible | Pending visual/data reconciliation |

Open gaps before promotion:

- The earlier local `EMFILE`/headless-capture limitation is stale and must be re-tested with the current browser workflow before it can be treated as a blocker.
- Full-suite verification passed on 2026-07-12: 400/400 test files and 1,860/1,860 tests in 23.09s.
- `/forge/dashboard` remains the rollback/reference route until this checklist is completed and the user approves promotion.
