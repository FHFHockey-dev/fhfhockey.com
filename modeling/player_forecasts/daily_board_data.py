"""Read-only daily-board exports. No research holdout access or database writes."""
from __future__ import annotations

import argparse
import hashlib
import math
import re
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from .contract import LOCKBOX_END, LOCKBOX_START, repository_root
from .database import readonly_connection, stream_query
from .io import assert_output_outside_repository, canonical_json, read_jsonl, require_database_url, write_json, write_jsonl

VERSION = "starter-board-dataset-v1"
NORMALIZER_VERSION = "starter-board-history-normalizer-v2"

# Game-time identity comes from recorded shifts, never the current players.team.
# Outcomes establish completed games; nonappearances are deliberately not inferred.
HISTORY_QUERY = '''
with eligible_games as (
  select g.* from public.games g
  where g.type=2 and g.date between %s::date and %s::date
    and not (g.date between '2026-01-03' and '2026-04-16')
    and (select count(distinct o."teamId") from public."gameOutcomes" o
      where o."gameId"=g.id and o.outcome::text in ('WIN','LOSS'))=2
), memberships as (
  select s.game_id,s.player_id,min(s.team_id) as team_id
  from public.nhl_api_shift_rows s join eligible_games g on g.id=s.game_id
  group by s.game_id,s.player_id having count(distinct s.team_id)=1
), derived as (
  select d.game_id,d.player_id,jsonb_agg(to_jsonb(d) order by d.team_id) as rows
  from public.forge_player_game_strength d join eligible_games g on g.id=d.game_id
  group by d.game_id,d.player_id
), strength_shifts as (
  select s.game_id,s.player_id,jsonb_agg(jsonb_build_object(
    'id',s.id,'game_id',s.game_id,'player_id',s.player_id,'team_id',s.team_id,
    'opponent_team_id',s.opponent_team_id,'season_id',s.season_id,'game_date',s.game_date,
    'game_type',s.game_type,'home_or_away',s.home_or_away,
    'team_abbreviation',s.team_abbreviation,'opponent_team_abbreviation',s.opponent_team_abbreviation,
    'total_es_toi',s.total_es_toi,'total_pp_toi',s.total_pp_toi,'total_pk_toi',s.total_pk_toi,
    'updated_at',s.updated_at) order by s.id) as rows
  from public.shift_charts s join eligible_games g on g.id=s.game_id
  where s.total_es_toi is not null or s.total_pp_toi is not null or s.total_pk_toi is not null
  group by s.game_id,s.player_id
)
select g.id as game_id,g.date::text as game_date,g."seasonId" as season_id,
  g."startTime"::text as scheduled_start_at,s."playerId" as player_id,s.position::text as position,
  m.team_id,case when m.team_id=g."homeTeamId" then g."awayTeamId"
    when m.team_id=g."awayTeamId" then g."homeTeamId" end as opponent_team_id,
  m.team_id=g."homeTeamId" as home,
  'skater'::text as population,s.created_at::text as source_recorded_at,
  jsonb_build_object('GOALS',s.goals,'ASSISTS',s.assists,'SHOTS_ON_GOAL',s.shots,
    'HITS',s.hits,'BLOCKED_SHOTS',s."blockedShots",'PENALTY_MINUTES',s.pim,
    'PP_POINTS',s."powerPlayPoints",'toi',s.toi,'pp_toi',s."powerPlayToi",'pk_toi',s."shorthandedToi") as outcomes,
  jsonb_build_object('derived',coalesce(d.rows,'[]'::jsonb),'shifts',coalesce(sc.rows,'[]'::jsonb)) as strength_evidence,g.type as game_type
from eligible_games g join public."skatersGameStats" s on s."gameId"=g.id
left join memberships m on m.game_id=g.id and m.player_id=s."playerId"
left join derived d on d.game_id=g.id and d.player_id=s."playerId"
left join strength_shifts sc on sc.game_id=g.id and sc.player_id=s."playerId"
union all
select g.id,g.date::text,g."seasonId",g."startTime"::text,k.goalie_id,'G',k.team_id,k.opponent_team_id,
  k.team_id=g."homeTeamId",'goalie',k.updated_at::text,
  jsonb_build_object('SHOTS_AGAINST_GOALIE',k.shots_against,'GOALS_AGAINST_GOALIE',k.goals_allowed,
    'SAVES_GOALIE',k.saves,'TIME_ON_ICE_PER_GAME',k.toi_seconds/60.0),null::jsonb,g.type
from eligible_games g join public.forge_goalie_game k on k.game_id=g.id
order by game_date,game_id,player_id
'''

def validate_range(start: str, end: str) -> None:
    if date.fromisoformat(start).isoformat() != start or date.fromisoformat(end).isoformat() != end or start > end:
        raise ValueError("invalid inclusive date range")
    if start <= LOCKBOX_END and end >= LOCKBOX_START:
        raise ValueError("daily-board export cannot access the protected research holdout")

def _minutes(value: Any) -> float | None:
    if not isinstance(value, str) or not re.fullmatch(r"\d+:[0-5]\d", value):
        return None
    try:
        minutes, seconds = map(int, value.split(":"))
        return minutes + seconds / 60 if minutes >= 0 and 0 <= seconds < 60 else None
    except ValueError:
        return None


def _nonnegative_number(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def _strength_outcomes(row: dict[str, Any], outcomes: dict[str, Any]) -> dict[str, Any]:
    """Audit stored derived components against shifts, historical identity and box totals.

    This certifies agreement among captured reconstruction sources, not historical
    availability or independent replay of the complete NHL play-by-play source.
    """
    status = {"usage": "unavailable", "rates": "unavailable", "reasons": []}
    strengths = (("EV", "es"), ("PP", "pp"), ("PK", "pk"))
    for prefix, _ in strengths:
        outcomes[f"{prefix}_TOI"] = None
        for target in ("GOALS", "ASSISTS", "SHOTS_ON_GOAL"):
            outcomes[f"{prefix}_{target}"] = None
    evidence = row.get("strength_evidence") or {}
    derived, shifts = evidence.get("derived", []), evidence.get("shifts", [])
    if not isinstance(derived, list) or not isinstance(shifts, list) or len(derived) != 1 or len(shifts) != 1:
        status["reasons"].append("missing_or_ambiguous_strength_sources")
        return status
    d, shift = derived[0], shifts[0]
    identity = ("game_id", "game_date", "player_id", "team_id", "opponent_team_id")
    if (not isinstance(d, dict) or not isinstance(shift, dict)
        or any(type(row.get(key)) is not int or row[key] <= 0 for key in ("game_id", "player_id", "team_id", "opponent_team_id", "season_id"))
        or any(row.get(key) is None or d.get(key) != row[key] or shift.get(key) != row[key] for key in identity)
        or row["team_id"] == row["opponent_team_id"] or shift.get("season_id") != row.get("season_id")
        or type(row.get("game_type")) is not int or row["game_type"] != 2
        or shift.get("game_type") not in (None, str(row["game_type"])) or type(row.get("home")) is not bool
        or shift.get("home_or_away") != ("home" if row["home"] else "away")
        or not all(isinstance(shift.get(key), str) and re.fullmatch(r"[A-Z]{2,3}", shift[key])
            for key in ("team_abbreviation", "opponent_team_abbreviation"))):
        status["reasons"].append("strength_identity_conflict")
        return status
    try:
        recorded = [datetime.fromisoformat(source["updated_at"].replace("Z", "+00:00")) for source in (d, shift)]
        if any(value.tzinfo is None for value in recorded) or type(shift.get("id")) is not int or shift["id"] <= 0:
            raise ValueError("source provenance missing")
    except (KeyError, TypeError, ValueError, AttributeError):
        status["reasons"].append("strength_source_provenance_missing")
        return status
    status["provenance"] = {"derivedRecordedAt": d["updated_at"], "shiftRecordedAt": shift["updated_at"],
        "shiftRowId": shift["id"], "evidenceHash": hashlib.sha256(canonical_json(evidence).encode()).hexdigest(),
        "classification": "stored_source_reconciliation", "gameTypeSource": "games.type",
        "missingShiftMetadata": ["game_type"] if shift.get("game_type") is None else []}
    seconds = [d.get(f"toi_{suffix}_seconds") for _, suffix in strengths]
    shift_minutes = [_minutes(shift.get(f"total_{suffix}_toi")) for _, suffix in strengths]
    total = outcomes.get("TIME_ON_ICE_PER_GAME")
    if (not all(_nonnegative_number(value) for value in seconds) or not _nonnegative_number(total)
        or any(value is None for value in shift_minutes)
        or any(abs(value - minutes * 60) > 1e-8 for value, minutes in zip(seconds, shift_minutes))
        or abs(sum(seconds) - total * 60) > 1.00000001):
        status["reasons"].append("strength_usage_accounting_mismatch")
        return status
    status["usage"] = "verified"
    for (prefix, _), value in zip(strengths, seconds):
        outcomes[f"{prefix}_TOI"] = value / 60
    counts = {target: [d.get(f"{source}_{suffix}") for _, suffix in strengths]
        for target, source in (("GOALS", "goals"), ("ASSISTS", "assists"), ("SHOTS_ON_GOAL", "shots"))}
    if (any(not _nonnegative_number(value) or value != int(value) for values in counts.values() for value in values)
        or any(not _nonnegative_number(outcomes.get(target)) or sum(values) != outcomes[target] for target, values in counts.items())
        or counts["GOALS"][1] + counts["ASSISTS"][1] != outcomes.get("PP_POINTS")
        or any(seconds[index] == 0 and any(values[index] > 0 for values in counts.values()) for index in range(3))
        or any(counts["GOALS"][index] > counts["SHOTS_ON_GOAL"][index] for index in range(3))):
        status["reasons"].append("strength_category_accounting_mismatch")
        return status
    status["rates"] = "verified"
    for target, values in counts.items():
        for (prefix, _), value in zip(strengths, values):
            outcomes[f"{prefix}_{target}"] = value
    return status

def normalize_history(row: dict[str, Any]) -> dict[str, Any]:
    value = dict(row)
    outcomes = dict(value["outcomes"])
    if value["population"] == "skater":
        outcomes["TIME_ON_ICE_PER_GAME"] = _minutes(outcomes.pop("toi", None))
        # These columns are ingestion placeholders, including syntactically valid
        # 00:00 values. Preserve them for audit, never infer EV by subtraction.
        value["legacy_strength_times"] = {key: outcomes.pop(key, None) for key in ("pp_toi", "pk_toi")}
        value["strength_status"] = _strength_outcomes(value, outcomes)
    if any(isinstance(item, (int, float)) and item < 0 for item in outcomes.values()):
        raise ValueError("negative observed count or usage")
    value.update(outcomes=outcomes, contractVersion=VERSION, normalizerVersion=NORMALIZER_VERSION, settlement_status="final",
        evidence_classification="historical_reconstruction",
        historical_team_membership_verified=value.get("team_id") is not None and value.get("opponent_team_id") is not None,
        participation_label_eligible=False, goalie_start_label_eligible=False)
    # Ingestion times are preserved verbatim, not rewritten into historical arrivals.
    value["row_hash"] = hashlib.sha256(canonical_json(value).encode()).hexdigest()
    return value

def freeze_history(rows: list[dict[str, Any]], output: Path, start: str, end: str) -> dict[str, Any]:
    validate_range(start, end)
    assert_output_outside_repository(output, repository_root())
    normalized = [normalize_history(row) for row in rows]
    seen = set()
    for row in normalized:
        identity = row["game_id"], row["player_id"]
        if identity in seen or not start <= row["game_date"] <= end:
            raise ValueError("duplicate outcome or row outside export bounds")
        seen.add(identity)
    normalized.sort(key=lambda row: (row["game_date"], row["game_id"], row["player_id"]))
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    count, checksum = write_jsonl(output / "history.jsonl", normalized)
    manifest = {"contractVersion": VERSION, "createdAt": datetime.now(timezone.utc).isoformat(),
        "start": start, "end": end, "rows": count, "games": len({row["game_id"] for row in normalized}),
        "files": {"history.jsonl": {"rows": count, "sha256": checksum}},
        "membershipMissingRows": sum(not row["historical_team_membership_verified"] for row in normalized),
        "sourceQueryHash": hashlib.sha256(HISTORY_QUERY.encode()).hexdigest(),
        "normalizerVersion": NORMALIZER_VERSION,
        "normalizerHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "strengthUsageVerifiedRows": sum(row.get("strength_status", {}).get("usage") == "verified" for row in normalized),
        "strengthRatesVerifiedRows": sum(row.get("strength_status", {}).get("rates") == "verified" for row in normalized),
        "strengthMissingShiftGameTypeRows": sum("game_type" in row.get("strength_status", {}).get("provenance", {}).get("missingShiftMetadata", []) for row in normalized),
        "strengthExclusions": dict(Counter(reason for row in normalized for reason in row.get("strength_status", {}).get("reasons", []))),
        "promotionEligible": False,
        "limitations": ["Archived final outcomes are historical reconstruction, not recorded pregame features.",
            "No negative participation labels or goalie starts inferred from box-score absence or minutes played.",
            "Legacy box-score PP/PK time placeholders never establish strength usage. Verified strength means stored-source reconciliation, not independent raw-source replay.",
            "Goalie win/shutout labels require official player-level settlement and are unavailable in this export."]}
    write_json(output / "manifest.json", manifest)
    for name in ("history.jsonl", "manifest.json"):
        (output / name).chmod(0o600)
    return manifest

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-jsonl", type=Path, help="Previously retrieved rows from HISTORY_QUERY; avoids handling a database credential.")
    args = parser.parse_args()
    validate_range(args.start, args.end)
    assert_output_outside_repository(args.output, repository_root())
    if args.source_jsonl:
        rows = list(read_jsonl(args.source_jsonl))
    else:
        with readonly_connection(require_database_url()) as connection:
            rows = list(stream_query(connection, "daily_board_history", HISTORY_QUERY, (args.start, args.end)))
    print(canonical_json(freeze_history(rows, args.output, args.start, args.end)))

if __name__ == "__main__":
    main()
