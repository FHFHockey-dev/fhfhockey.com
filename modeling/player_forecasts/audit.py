from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .contract import CONTRACT_SHA256, CONTRACT_VERSION
from .database import readonly_connection


AUDIT_QUERY = """
select 'games' as dataset, count(*)::bigint as rows, min(date)::text as first_date, max(date)::text as last_date
from public.games where "seasonId" = %s and type = 2
union all
select 'skater_game_outcomes', count(*)::bigint, min(g.date)::text, max(g.date)::text
from public."skatersGameStats" s join public.games g on g.id = s."gameId"
where g."seasonId" = %s and g.type = 2
union all
select 'goalie_game_outcomes', count(*)::bigint, min(g.date)::text, max(g.date)::text
from public."goaliesGameStats" s join public.games g on g.id = s."gameId"
where g."seasonId" = %s and g.type = 2
union all
select 'normalized_pbp_events', count(*)::bigint, min(game_date)::text, max(game_date)::text
from public.nhl_api_pbp_events where season_id = %s
union all
select 'normalized_shift_rows', count(*)::bigint, min(game_date)::text, max(game_date)::text
from public.nhl_api_shift_rows where season_id = %s
union all
select 'line_source_snapshots', count(*)::bigint, min(observed_at)::text, max(observed_at)::text
from public.line_source_snapshots
where observed_at >= '2025-09-01' and observed_at < '2026-07-01'
union all
select 'player_status_history', count(*)::bigint, min(observed_at)::text, max(observed_at)::text
from public.player_status_history
where observed_at >= '2025-09-01' and observed_at < '2026-07-01'
order by dataset
"""


def run_audit(database_url: str, season_id: int) -> dict[str, Any]:
    with readonly_connection(database_url) as connection:
        rows = connection.execute(
            AUDIT_QUERY,
            (season_id, season_id, season_id, season_id, season_id),
        ).fetchall()
    datasets = [dict(row) for row in rows]
    by_name = {row["dataset"]: row for row in datasets}
    lineup = by_name.get("line_source_snapshots", {})
    status = by_name.get("player_status_history", {})
    historical_core_ready = all(
        int(by_name.get(name, {}).get("rows") or 0) > 0
        for name in ("games", "skater_game_outcomes", "goalie_game_outcomes", "normalized_pbp_events", "normalized_shift_rows")
    )
    enriched_lockbox_eligible = bool(
        lineup.get("first_date") and str(lineup["first_date"])[:10] <= "2026-01-03"
        and status.get("first_date") and str(status["first_date"])[:10] <= "2026-01-03"
    )
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": CONTRACT_VERSION,
        "contractChecksum": CONTRACT_SHA256,
        "seasonId": season_id,
        "datasets": datasets,
        "historicalCoreReady": historical_core_ready,
        "prospectiveEnrichedLockboxEligible": enriched_lockbox_eligible,
        "availabilityModelLockboxEligible": False,
        "promotionEligible": False,
        "limitations": [
            "historical roster state is mutable and cannot define nonappearance candidates",
            "lineup and status observations begin after the primary lockbox",
            "WGO and NST remain excluded until availability, definition, and rights audits pass",
        ],
    }
