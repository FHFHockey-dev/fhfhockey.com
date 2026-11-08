"""Pure, evidence-only PPP composition. No file, network, or application access."""
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json

METHOD = "official_later_exact_player_summary_PPP"
FP_FIELDS = ("goals", "assists", "shots", "hits", "blocked_shots", "pp_points")


def need(condition, reason):
    if not condition:
        raise ValueError(reason)


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     allow_nan=False).encode()).hexdigest()


def stamp(value):
    need(isinstance(value, str), "invalid_timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    need(parsed.tzinfo is not None and parsed.utcoffset() is not None, "naive_timestamp")
    return parsed.astimezone(timezone.utc)


def index_unique(values, key):
    need(all(type(v[key]) is int for v in values), "invalid_identity_type")
    result = {v[key]: v for v in values}
    need(len(result) == len(values), "duplicate_identity")
    return result


def evidence_flags(row):
    fields = row["fields"]
    unknown = [k for k in FP_FIELDS if fields[k]["state"] == "unknown"]
    different = [k for k in FP_FIELDS if fields[k]["state"] == "different"]
    need(all(fields[k]["state"] in ("matched", "unknown", "different") for k in FP_FIELDS),
         "invalid_field_state")
    track = row["tracks"]["fantasyPoints"]
    need(type(track["identityExposureFinalityMatched"]) is bool, "invalid_identity_flag")
    return dict(allSelectedOperandsMatched=not unknown and not different,
                unknownFields=unknown, differentFields=different,
                identityExposureFinalityMatched=track["identityExposureFinalityMatched"],
                corroboratedForThisRow=track["identityExposureFinalityMatched"] and not unknown and not different)


def validate_selection(original_rows, source_rows, contexts, original_profiles, capture_at):
    """Bind the full selected identity and original metrics, without computing scores."""
    rows = index_unique(original_rows, "sourceId")
    sources = index_unique(source_rows, "id")
    index_unique(contexts, "playerId")
    index_unique(original_profiles, "playerId")
    selected = [sid for p in contexts for sid in p["sourceIds"]]
    need(len(selected) == len(set(selected)) == len(rows) == len(sources), "selected_scope_or_duplicates")
    need(set(selected) == set(rows) == set(sources), "selected_identity_drift")
    need(len(contexts) == len(original_profiles), "profile_count_drift")
    for row in original_rows:
        source = sources[row["sourceId"]]
        need((row["playerId"], row["gameId"], row["date"]) ==
             (source["player_id"], source["game_id"], source["date"]), "selected_row_identity_drift")
        need(source["season_id"] == 20262027, "outside_current_season")
        need(row["scoringAdmission"] is False and row["fullProfileQualified"] is False,
             "row_admission_not_allowed")
        need(row["tracks"]["fantasyPoints"] == evidence_flags(row), "original_row_flags_drift")
    for context, profile in zip(contexts, original_profiles):
        need(context["capturedAtUTC"] == capture_at, "profile_capture_drift")
        for key in ("playerId", "name", "team", "sourceIds", "dates", "selectedRecords", "appearances",
                    "seconds", "shots", "sourceDiscrepancies", "lastRecordAgeDays", "metricBasis"):
            need(context[key] == profile[key], "profile_identity_or_metric_drift")
        ids = context["sourceIds"]
        need(len(ids) == context["selectedRecords"] > 0, "profile_selected_count_drift")
        need([sources[sid]["date"] for sid in ids] == context["dates"], "profile_date_order_drift")
        need(all(sources[sid]["player_id"] == context["playerId"] for sid in ids), "profile_player_drift")
        need(sum(sources[sid]["games_played"] for sid in ids) == context["appearances"], "appearance_drift")
        need(sum(sources[sid]["toi_per_game"] for sid in ids) == context["seconds"], "seconds_drift")
        need(sum(sources[sid]["counts"]["shots"] for sid in ids) == context["shots"], "shots_drift")
        metrics = {m["key"]: m for m in context["metrics"]}
        for key in ("fantasyPoints", "rawPoints"):
            need(profile["tracks"][key]["capturedMetric"] == metrics[key], "captured_metric_drift")
        need(profile["capturedGameScore"] == metrics["wigoGameScore"], "captured_gamescore_drift")
        need(profile["fullProfileQualified"] is False and profile["productionAdopted"] is False and
             profile["combinedScore"] is None and profile["buySellLabel"] is None and
             profile["baselineComparison"] is None and profile["confidenceProbability"] is None,
             "profile_admission_not_allowed")
    return rows, sources


def validate_comparison(proof, before, source, captured_at, as_of):
    sid = source["id"]
    need((proof["sourceId"], proof["playerId"], proof["gameId"], proof["date"], proof["team"]) ==
         (sid, source["player_id"], source["game_id"], source["date"], source["team_abbrev"]),
         "proof_identity_drift")
    need(proof["priorSidecar"] == before, "prior_sidecar_drift")
    need(proof["sourceRowSHA256"] == canonical_hash(source), "source_row_hash_drift")
    need(proof["sourceCaptureAtUTC"] == captured_at, "source_capture_drift")
    need(stamp(captured_at) <= stamp(as_of), "composition_precedes_capture")
    observed = stamp(proof["observedAtUTC"])
    need(observed <= stamp(as_of), "evidence_after_composition")
    precedes = observed < stamp(captured_at)
    need(proof["observationPrecedesCapture"] is precedes, "chronology_flag_drift")
    need(proof["originalPublicationUTC"] is None, "publication_time_not_established")
    need(proof["sourceValuesChanged"] is False and proof["scoringAdmission"] is False and
         proof["wholeProfileQualification"] is False and proof["currentFieldStateUnchanged"] is True,
         "proof_admission_not_allowed")
    need(before["fields"]["pp_points"]["state"] == "unknown", "requires_original_unresolved_PPP")
    for value in (source["counts"]["pp_points"], proof["capturedPPP"], proof["nativePPP"]):
        need(type(value) is int and value >= 0, "invalid_PPP_operand")
    need(source["counts"]["pp_points"] == proof["capturedPPP"] == proof["nativePPP"] and
         proof["comparison"] == "match" and proof["reason"] is None, "PPP_comparison_drift")
    need(type(source["games_played"]) is int and source["games_played"] == 1 and
         type(source["toi_per_game"]) in (int, float) and source["toi_per_game"] > 0,
         "invalid_source_exposure")
    exposure = proof["exposureComparison"]
    need(exposure["captured"] == source["toi_per_game"], "captured_exposure_drift")
    need(type(exposure["native"]) in (int, float) and exposure["native"] > 0, "invalid_native_exposure")
    exposure_matches = Decimal(str(exposure["native"])) == Decimal(str(source["toi_per_game"]))
    need(exposure["state"] == ("match" if exposure_matches else "different"), "exposure_flag_drift")
    combined = proof["priorCombined"]
    need((combined["sourceId"], combined["playerId"], combined["gameId"], combined["date"]) ==
         (sid, source["player_id"], source["game_id"], source["date"]), "combined_identity_drift")
    box = combined["boxQualification"]
    need(box["TOI"]["wgo"] == source["toi_per_game"], "prior_exposure_operand_drift")
    for field in FP_FIELDS[:-1]:
        need(box["counts"][field]["wgo"] == source["counts"][field], "prior_count_operand_drift")
    for field in ("goals", "assists", "shots"):
        comparison = proof["countComparisons"][field]
        need(type(comparison["native"]) is int and comparison["native"] >= 0 and
             comparison["captured"] == source["counts"][field], "native_count_operand_drift")
        need(comparison["state"] == ("match" if comparison["captured"] == comparison["native"] else "different"),
             "count_flag_drift")
    holds = []
    if before["exposureState"] != "matched":
        holds.append("prior_exposure_hold_preserved")
    if box["gameFinality"] != "final":
        holds.append("prior_finality_unknown")
    if not exposure_matches:
        holds.append("direct_exposure_unmatched")
    if any(proof["countComparisons"][k]["state"] != "match" for k in ("goals", "assists")):
        holds.append("direct_goals_or_assists_unmatched")
    if precedes:
        holds.append("observation_precedes_source_capture")
    need(proof["admissionHolds"] == holds, "admission_holds_drift")
    need(proof["laterMatchingEvidenceCandidate"] is (not holds), "candidate_flag_drift")
    if not holds:
        need(observed > stamp(captured_at), "later_evidence_must_follow_capture")
        need(before["exposureReasons"] == [] and
             before["tracks"]["fantasyPoints"]["identityExposureFinalityMatched"] is True,
             "prior_identity_exposure_finality_hold")
        need(all(proof["countComparisons"][k]["state"] == "match" for k in ("goals", "assists", "shots")),
             "unmatched_overlapping_native_count")
    return holds


def compose_rows(original_rows, source_rows, comparisons, captured_at, as_of, bindings):
    """Authenticate files outside this helper, then fail closed on every proof operand."""
    rows = index_unique(original_rows, "sourceId")
    sources = index_unique(source_rows, "id")
    index_unique(comparisons, "sourceId")
    need(set(rows) == set(sources), "selected_identity_drift")
    result = deepcopy(original_rows)
    index = {r["sourceId"]: r for r in result}
    decisions = []
    for proof in comparisons:
        sid = proof["sourceId"]
        need(sid in rows, "proof_outside_selected_scope")
        before = rows[sid]
        need(before["scoringAdmission"] is False and before["fullProfileQualified"] is False,
             "row_admission_not_allowed")
        need(before["tracks"]["fantasyPoints"] == evidence_flags(before), "original_row_flags_drift")
        holds = validate_comparison(proof, before, sources[sid], captured_at, as_of)
        decisions.append(dict(sourceId=sid, state="held_unchanged" if holds else "later_field_evidence_composed",
                              admissionHolds=deepcopy(holds), comparisonSHA256=canonical_hash(proof),
                              scoringAdmission=False, wholeProfileQualification=False))
        if holds:
            continue
        row = index[sid]
        need("laterPPPEvidence" not in row, "already_composed")
        row["fields"]["pp_points"] = dict(state="matched", method=METHOD, official=proof["nativePPP"])
        row["tracks"]["fantasyPoints"] = evidence_flags(row)
        row["laterPPPEvidence"] = dict(
            priorFieldEvidence=deepcopy(before["fields"]["pp_points"]),
            priorSidecarSHA256=canonical_hash(before), comparisonSHA256=canonical_hash(proof),
            sourceId=sid, playerId=proof["playerId"], gameId=proof["gameId"],
            date=proof["date"], team=proof["team"], sourceRowSHA256=proof["sourceRowSHA256"],
            capturedPPP=proof["capturedPPP"], nativePPP=proof["nativePPP"],
            sourceCaptureAtUTC=captured_at, observedAtUTC=proof["observedAtUTC"],
            composedAtUTC=as_of, originalPublicationUTC=proof["originalPublicationUTC"],
            nativeEvidence=deepcopy(proof["nativeEvidence"]), acceptedInputBindings=deepcopy(bindings),
            evidenceScope="later_literal_PPP_corroboration_only",
            sourceValuesChanged=False, sourceFreshnessEstablished=False, sourceRevisionEstablished=False,
            currentRecommendationQualified=False, scoringAdmission=False, wholeProfileQualification=False)
    return result, decisions


def fp_window(profile, rows):
    """Update only field-evidence aggregation; never refresh or recompute a captured metric."""
    selected = [rows[sid] for sid in profile["sourceIds"]]
    track = deepcopy(profile["tracks"]["fantasyPoints"])
    matched = sum(r["tracks"]["fantasyPoints"]["corroboratedForThisRow"] for r in selected)
    track.update(
        matchedSelectedRecords=matched, selectedRecords=len(selected),
        allSelectedCountsAndExposureMatched=matched == len(selected),
        unresolvedBySourceId={str(r["sourceId"]): deepcopy(r["tracks"]["fantasyPoints"]["unknownFields"])
                              for r in selected if r["tracks"]["fantasyPoints"]["unknownFields"]},
        differencesBySourceId={str(r["sourceId"]): deepcopy(r["tracks"]["fantasyPoints"]["differentFields"])
                               for r in selected if r["tracks"]["fantasyPoints"]["differentFields"]},
        exposureHeldSourceIds=[r["sourceId"] for r in selected if r["exposureState"] != "matched"],
        methodCounts=dict(Counter(r["fields"]["pp_points"].get("method", "unresolved") for r in selected)))
    return track


def compose_profiles(original_profiles, original_rows, rows):
    original = index_unique(original_rows, "sourceId")
    changed = index_unique(rows, "sourceId")
    result = deepcopy(original_profiles)
    for profile in result:
        need(fp_window(profile, original) == profile["tracks"]["fantasyPoints"], "old_window_reconstruction_drift")
        profile["tracks"]["fantasyPoints"] = fp_window(profile, changed)
    return result
