"""Pure, offline SoS candidate v1. No I/O, clocks, services or application imports.

See CONTRACT.md. All input timestamps are timezone-aware. Input completeness is
an explicit caller attestation, not something this calculator can discover.
"""
from collections import Counter
from datetime import datetime, timezone
from fractions import Fraction as F
from math import isfinite, sqrt

from record_core import Game, RecordSOS, credits, MODES, OUTCOMES

VERSION = "fhfh-sos-candidate-v1"


def instant(value):
    if not isinstance(value, str):
        raise ValueError("Timestamp must be an ISO string with timezone")
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid ISO timestamp") from exc
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError("Timezone required")
    return dt.astimezone(timezone.utc)


def fraction(value):
    # Decimal strings avoid binary float artifacts; reject NaN/Inf and booleans.
    if isinstance(value, bool):
        raise ValueError("Boolean is not a numeric parameter")
    try:
        return F(str(value))
    except (ValueError, ZeroDivisionError) as exc:
        raise ValueError("Finite numeric parameter required") from exc


def native(value):
    """JSON-ready public boundary; core arithmetic remains exact fractions."""
    if isinstance(value, F):
        return float(value)
    if isinstance(value, dict):
        return {k: native(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [native(v) for v in value]
    return value


class LedgerRecordSOS(RecordSOS):
    def __init__(self, teams, rows, mode, kappa, mu):
        games = [Game(r["id"], r["home"], r["away"], r["outcome"]) for r in rows]
        super().__init__(teams, games, mode, kappa, mu)
        self.point_ledger = {r["id"]: (F(r["home_points"], 2), F(r["away_points"], 2))
                             for r in rows if "home_points" in r}

    def entries(self, team):
        for game in self.games:
            values = (self.point_ledger.get(game.game_id, credits(game, self.mode))
                      if self.mode == "points_credit" else credits(game, self.mode))
            if game.home == team:
                yield game.away, values[0]
            elif game.away == team:
                yield game.home, values[1]


def components(teams, games):
    edges = {t: set() for t in teams}
    for g in games:
        edges[g.home].add(g.away)
        edges[g.away].add(g.home)
    unseen, result = set(teams), []
    while unseen:
        todo, found = [min(unseen)], set()
        while todo:
            team = todo.pop()
            if team not in found:
                found.add(team)
                todo.extend(edges[team] - found)
        unseen -= found
        result.append(sorted(found))
    return result


def colley(teams, games, mode="final_win", excluded=()):
    """Published binary Colley; regulation-equivalent ties are a named extension.

    C=2I+graph Laplacian, b=1+(wins-losses)/2. Points credit is rejected because
    its OT credits are non-complementary. Exclusion removes nodes AND games.
    The SPD solve uses Cholesky, not unanchored recursive neighbor averaging.
    """
    if mode not in {"final_win", "regulation_equivalent"}:
        raise ValueError("Colley needs complementary credits; no points-credit fit")
    excluded = set(excluded)
    teams = sorted(set(teams) - excluded)
    games = sorted((g for g in games if g.home not in excluded and g.away not in excluded),
                   key=lambda g: g.game_id)
    index, n = {t: i for i, t in enumerate(teams)}, len(teams)
    c = [[2.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    b, counts = [1.0] * n, Counter()
    ids = set()
    for g in games:
        if g.game_id in ids or g.home == g.away or g.home not in index or g.away not in index or g.outcome not in OUTCOMES:
            raise ValueError("Invalid/duplicate Colley fixture")
        ids.add(g.game_id)
        i, j = index[g.home], index[g.away]
        y = float(credits(g, mode)[0])
        c[i][i] += 1; c[j][j] += 1
        c[i][j] -= 1; c[j][i] -= 1
        b[i] += y - 0.5; b[j] -= y - 0.5
        counts[g.home] += 1; counts[g.away] += 1
    l = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            v = c[i][j] - sum(l[i][k] * l[j][k] for k in range(j))
            l[i][j] = sqrt(v) if i == j else v / l[j][j]
    z, r = [0.0] * n, [0.0] * n
    for i in range(n):
        z[i] = (b[i] - sum(l[i][j] * z[j] for j in range(i))) / l[i][i]
    for i in reversed(range(n)):
        r[i] = (z[i] - sum(l[j][i] * r[j] for j in range(i + 1, n))) / l[i][i]
    residual = max((abs(sum(c[i][j] * r[j] for j in range(n)) - b[i]) for i in range(n)), default=0)
    if residual > 1e-9 or not all(isfinite(v) for v in r):
        raise ArithmeticError("Colley numerical check failed")
    return {"ratings": dict(zip(teams, r)), "games": {t: counts[t] for t in teams},
            "components": components(teams, games), "residual_max": residual,
            "interpretation": "regularized outcome index centered at .5; may exceed [0,1]; not a probability"}


def ranks(values, decimals=10):
    """Competition ranks, hardest/highest first; rounded tie buckets, no ID tiebreak."""
    clean = {t: round(float(v), decimals) for t, v in values.items() if v is not None}
    return {t: None if t not in clean else 1 + sum(v > clean[t] for v in clean.values())
            for t in values}


def calculate(payload):
    """Evaluate one season, one frozen cutoff, one explicit past/future horizon.

    Raises on malformed/conflicting input. Incomplete source coverage produces
    null metrics, never subset renormalization or a silent neutral/zero fallback.
    """
    teams = tuple(payload["teams"])
    if len(teams) < 2 or len(set(teams)) != len(teams) or any(not isinstance(t, str) or not t for t in teams):
        raise ValueError("At least two unique canonical team IDs required")
    teams = tuple(sorted(teams))
    season = payload["season"]
    lo, hi = instant(season["start"]), instant(season["end"])
    cutoff = instant(payload["as_of"])
    begin, end = instant(payload["horizon"]["start"]), instant(payload["horizon"]["end"])
    kind = payload["horizon"]["kind"]
    if not lo <= begin < end <= hi or not lo <= cutoff <= hi:
        raise ValueError("Split horizons/cutoffs at season boundaries")
    if kind not in {"past_retrospective", "future_as_of"}:
        raise ValueError("Supported modes: past_retrospective, future_as_of")
    if (kind == "past_retrospective" and end > cutoff) or (kind == "future_as_of" and begin < cutoff):
        raise ValueError("Horizon is inconsistent with cutoff and mode")
    cfg = payload["config"]
    mode, kappa, mu = cfg["mode"], fraction(cfg["kappa"]), fraction(cfg["prior_mean"])
    if mode not in MODES or kappa < 0 or not 0 <= mu <= 1:
        raise ValueError("Invalid outcome/prior config")
    if mode != "points_credit" and mu != F(1, 2):
        raise ValueError("Final-win/regulation-equivalent league prior must be .5")
    if instant(cfg["prior_known_at"]) >= cutoff:
        raise ValueError("Prior must be declared/known before cutoff")
    if mode == "points_credit" and cfg.get("points_per_win") != 2:
        raise ValueError("This points mode supports only explicit two-point ledger systems")
    history = payload["history"]
    if instant(history["as_of"]) != cutoff:
        raise ValueError("History completeness attestation must match cutoff")
    covered = set(history["complete_teams"])
    if not covered <= set(teams):
        raise ValueError("Unknown team in history completeness attestation")
    rows, result_ids, raw_by_id = [], set(), {}
    ignored = Counter()
    for r in history["results"]:
        gid, h, a = r["id"], r["home"], r["away"]
        if not isinstance(gid, str) or not gid or gid in result_ids or h == a or h not in teams or a not in teams:
            raise ValueError("Duplicate/invalid/unknown-team result")
        result_ids.add(gid); raw_by_id[gid] = r
        if r["season"] != season["id"]:
            raise ValueError("Do not pool seasons; split inputs explicitly")
        s, f, known = instant(r["start"]), instant(r["end"]), instant(r["available_at"])
        if not lo <= s < f <= known or s >= hi:
            raise ValueError("Invalid result event/availability timeline")
        if r["outcome"] not in OUTCOMES:
            raise ValueError("Unsupported outcome (historical ties need separate contract)")
        if ("home_points" in r) != ("away_points" in r):
            raise ValueError("Both point-ledger values are required")
        if "home_points" in r and any(type(r[k]) is not int or not 0 <= r[k] <= 2 for k in ("home_points", "away_points")):
            raise ValueError("Point ledger must contain integer credits from 0 to 2")
        if r["phase"] != "regular":
            ignored["non_regular"] += 1
        elif known >= cutoff or f >= cutoff:
            ignored["not_known_before_cutoff"] += 1
        else:
            rows.append(r)
    rows.sort(key=lambda r: r["id"])
    model = LedgerRecordSOS(teams, rows, mode, kappa, mu)
    schedule = payload.get("schedule")
    fixture_by_team = {t: [] for t in teams}
    unresolved_by_team = {t: [] for t in teams}
    schedule_issues, schedule_age = [], None
    if kind == "past_retrospective":
        selected = [r for r in rows if begin <= instant(r["start"]) < end]
    else:
        if schedule is None:
            raise ValueError("Future horizon needs a retained schedule snapshot")
        observed = instant(schedule["observed_at"])
        if observed >= cutoff:
            raise ValueError("Schedule snapshot must be known strictly before cutoff")
        if not instant(schedule["start"]) <= begin < end <= instant(schedule["end"]):
            schedule_issues.append("schedule_horizon_not_covered")
        if not set(schedule["complete_teams"]) <= set(teams):
            raise ValueError("Unknown team in schedule completeness attestation")
        schedule_age = (cutoff - observed).total_seconds()
        seen, selected = set(), []
        for r in schedule["fixtures"]:
            gid, h, a = r["id"], r["home"], r["away"]
            if not isinstance(gid, str) or not gid or gid in seen or h == a or h not in teams or a not in teams:
                raise ValueError("Duplicate/invalid/unknown-team scheduled fixture")
            seen.add(gid)
            if r["season"] != season["id"]:
                raise ValueError("Schedule crosses seasons; split it explicitly")
            start, known = instant(r["start"]), instant(r["known_at"])
            if not lo <= start < hi or known > observed:
                raise ValueError("Fixture outside season or newer than retained snapshot")
            if gid in raw_by_id:
                old = raw_by_id[gid]
                if (h, a, start) != (old["home"], old["away"], instant(old["start"])):
                    raise ValueError("Conflicting identity/time across schedule and results")
                if instant(old["available_at"]) < cutoff and begin <= start < end:
                    raise ValueError("Final result cannot be an upcoming fixture")
            if r["status"] not in {"scheduled", "cancelled", "postponed", "unknown", "in_progress", "final"}:
                raise ValueError("Unknown schedule status vocabulary")
            if r["phase"] != "regular" or not begin <= start < end or start <= cutoff:
                continue
            if r["status"] in {"in_progress", "final"}:
                raise ValueError("An unstarted future fixture cannot be in progress/final")
            if r["status"] in {"unknown", "postponed"}:
                unresolved_by_team[h].append(gid); unresolved_by_team[a].append(gid)
            elif r["status"] == "scheduled":
                selected.append(r)
    for r in sorted(selected, key=lambda r: r["id"]):
        fixture_by_team[r["home"]].append((r["id"], r["away"]))
        fixture_by_team[r["away"]].append((r["id"], r["home"]))
    history_ok = covered == set(teams)
    fit = colley(teams, model.games, mode) if history_ok and mode != "points_credit" else None
    result = {"version": VERSION, "as_of": payload["as_of"], "season": season,
              "horizon": payload["horizon"], "config": cfg.copy(),
              "cohort": list(teams), "history_games": len(rows), "history_ids": [r["id"] for r in rows],
              "ignored_results": dict(ignored), "missing_history_teams": sorted(set(teams) - covered),
              "schedule_age_seconds": schedule_age, "quality_colley": fit,
              "context": "neutral venue; no home/away/rest/goalie/volume adjustment",
              "uncertainty": "No calibrated intervals; prior share, coverage, connectivity and stability diagnostics only",
              "teams": {}}
    for focal in teams:
        fixtures = fixture_by_team[focal]
        issues = ([] if history_ok else ["incomplete_history_cohort"]) + schedule_issues
        if kind == "future_as_of" and focal not in schedule["complete_teams"]:
            issues.append("incomplete_schedule")
        if unresolved_by_team[focal]:
            issues.append("unresolved_fixture_status")
        record = model.score(focal, [opp for _, opp in fixtures])
        if kind == "past_retrospective":
            record["window"] = "past_fixture_list"
        # An explicit outer list preserves the selected horizon. It intentionally
        # suppresses RPI; own-result quality is never mislabeled schedule strength.
        direct, rpi_sos = record["owp"], record["sos"]
        challeng = colley(teams, model.games, mode, {focal}) if history_ok and mode != "points_credit" else None
        cmean = (sum(challeng["ratings"][opp] for _, opp in fixtures) / len(fixtures)
                 if challeng and fixtures else None)
        state = "incomplete" if issues else "no_fixtures" if not fixtures else "computable"
        if issues:
            direct = rpi_sos = cmean = None
        colley_prior = (sum(challeng["games"][opp] == 0 for _, opp in fixtures) / len(fixtures)
                        if challeng and fixtures else None)
        result["teams"][focal] = {
            "state": state, "issues": issues, "fixture_count": len(fixtures),
            "fixture_ids": [gid for gid, _ in fixtures], "opponents": [opp for _, opp in fixtures],
            "unresolved_fixture_ids": unresolved_by_team[focal],
            "unique_opponents": len(set(opp for _, opp in fixtures)),
            "direct_sos": direct, "rpi_sos": rpi_sos, "colley_sos": cmean,
            "record_components": record if history_ok and not issues else None,
            "colley_excluding_focal": challeng if not issues else None,
            "colley_prior_only_fixture_share": colley_prior if not issues else None,
            "rpi_sos_state": "incomplete" if issues else record["state"],
            "own_record": model.rate(focal) if history_ok else None,
        }
    for metric in ("direct_sos", "rpi_sos", "colley_sos"):
        values = {t: r[metric] for t, r in result["teams"].items()}
        ranking = ranks(values)
        for t, r in result["teams"].items():
            r[metric + "_rank"] = ranking[t]
    result["ranking_policy"] = "Competition ranks within non-null supplied cohort; higher=harder; ties at 10 decimals. Computable is not qualified."
    return native(result)


def faced_then(payload, pregame_snapshots):
    """Replay retained pregame snapshots; never reinterpret current ratings as then.

    Each entry is {fixture_id, snapshot}. A one-fixture future horizon and a cutoff
    strictly before kickoff are mandatory. Missing prior snapshots remain null.
    This is a pure aggregator; acquiring/reconstructing snapshots is out of scope.
    """
    target = calculate(payload)
    if payload["horizon"]["kind"] != "past_retrospective":
        raise ValueError("Faced-then target must specify a past horizon")
    by_id = {}
    for entry in pregame_snapshots:
        gid, snap = entry["fixture_id"], entry["snapshot"]
        if gid in by_id:
            raise ValueError("Duplicate pregame snapshot")
        if (set(snap["teams"]) != set(payload["teams"]) or snap["season"] != payload["season"] or
                snap["config"] != payload["config"] or snap["horizon"]["kind"] != "future_as_of"):
            raise ValueError("Replay needs identical cohort, season and metric configuration")
        original = next((r for r in payload["history"]["results"] if r["id"] == gid), None)
        if original is None or instant(snap["as_of"]) >= instant(original["start"]):
            raise ValueError("Replay cutoff must be strictly before fixture kickoff")
        retained = [r for r in snap["schedule"]["fixtures"] if r["id"] == gid]
        if len(retained) != 1 or any(retained[0][k] != original[k] for k in ("home", "away", "season")) or instant(retained[0]["start"]) != instant(original["start"]):
            raise ValueError("Pregame snapshot identity/time must match historical fixture")
        calculated = calculate(snap)
        for team in (original["home"], original["away"]):
            if calculated["teams"][team]["fixture_ids"] != [gid]:
                raise ValueError("Replay must isolate exactly the named fixture")
        by_id[gid] = calculated
    out = {"version": VERSION, "interpretation": "faced_then_retained_pregame", "teams": {}}
    for team, row in target["teams"].items():
        ids = row["fixture_ids"]
        missing = [gid for gid in ids if gid not in by_id]
        metrics = {}
        for metric in ("direct_sos", "rpi_sos", "colley_sos"):
            vals = [by_id[gid]["teams"][team][metric] for gid in ids if gid in by_id]
            metrics[metric] = (sum(vals) / len(ids) if ids and not missing and row["state"] != "incomplete"
                               and all(v is not None for v in vals) else None)
        out["teams"][team] = {"fixture_ids": ids, "missing_pregame_snapshots": missing, **metrics}
    return out
