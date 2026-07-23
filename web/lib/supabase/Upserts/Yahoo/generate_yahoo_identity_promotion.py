"""Generate the audited DR-011 Yahoo identity promotion migration.

The generator reads legacy mapping evidence and emits only stable identifiers,
independent name scores, and match classifications. It never writes database
rows itself; applying the generated SQL remains a separate reviewed action.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Iterable

from dotenv import load_dotenv
from supabase import Client, create_client

from player_name_matcher import (
    MIN_FIRST_NAME_SCORE,
    MIN_LAST_NAME_SCORE,
    normalize_given_names,
    normalize_name,
    score_name_parts,
    split_name_first_last,
)


GENERATOR_VERSION = "dr011-yahoo-name-review-v2"
REVIEW_ACTOR = "user_approved:dr_011_bulk_review_90_50_v2"
GENERATION_MODES = ("incremental", "recompute-all")


def fetch_all(
    client: Client,
    table: str,
    columns: str,
    *,
    page_size: int = 1000,
    order_by: tuple[str, ...] = (),
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        query = client.table(table).select(columns)
        for column in order_by:
            query = query.order(column)
        page = (
            query.range(start, start + page_size - 1).execute().data
            or []
        )
        rows.extend(page)
        if len(page) < page_size:
            return rows
        start += page_size


def fetch_all_by_numeric_text_prefix(
    client: Client,
    table: str,
    columns: str,
    partition_column: str,
    *,
    page_size: int = 1000,
) -> list[dict[str, Any]]:
    """Fetch a no-primary-key table without unstable offset pagination."""

    def fetch_prefix(prefix: str) -> list[dict[str, Any]]:
        response = (
            client.table(table)
            .select(columns, count="exact")
            .like(partition_column, prefix + "%")
            .range(0, page_size - 1)
            .execute()
        )
        count = response.count or 0
        if count <= page_size:
            return response.data or []
        rows: list[dict[str, Any]] = []
        for digit in "0123456789":
            rows.extend(fetch_prefix(prefix + digit))
        return rows

    rows: list[dict[str, Any]] = []
    for digit in "0123456789":
        rows.extend(fetch_prefix(digit))
    return rows


def _identifier_sort_key(value: str) -> tuple[int, int | str]:
    return (0, int(value)) if value.isdigit() else (1, value)


def _nickname_equivalent(source_name: str, candidate_name: str) -> bool:
    source_first, _ = split_name_first_last(source_name)
    candidate_first, _ = split_name_first_last(candidate_name)
    return (
        normalize_name(source_first) != normalize_name(candidate_first)
        and normalize_given_names(source_name)
        == normalize_given_names(candidate_name)
    )


def build_manifest(
    mapping_rows: Iterable[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    pair_rows: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
    for row in mapping_rows:
        nhl_text = str(row.get("nhl_player_id") or "").strip()
        yahoo_player_id = str(row.get("yahoo_player_id") or "").strip()
        if not nhl_text.isdigit() or not yahoo_player_id:
            continue
        pair_rows[(int(nhl_text), yahoo_player_id)].append(row)

    yahoo_degree = Counter(yahoo_id for _, yahoo_id in pair_rows)
    metrics = Counter(
        source_rows=sum(len(rows) for rows in pair_rows.values()),
        distinct_pairs=len(pair_rows),
    )
    manifest: list[dict[str, Any]] = []

    for (nhl_player_id, yahoo_player_id), rows in pair_rows.items():
        if yahoo_degree[yahoo_player_id] != 1:
            metrics["ambiguous_pairs"] += 1
            continue

        scored_rows: list[tuple[float, int, int, str, str]] = []
        exact_normalized = False
        nickname_equivalent = False
        for row in rows:
            source_name = str(row.get("nhl_player_name") or "")
            candidate_name = str(row.get("yahoo_player_name") or "")
            last_score, first_score = score_name_parts(
                source_name,
                candidate_name,
            )
            scored_rows.append(
                (
                    (last_score * 0.7) + (first_score * 0.3),
                    last_score,
                    first_score,
                    source_name,
                    candidate_name,
                )
            )
            exact_normalized = exact_normalized or (
                normalize_name(source_name) == normalize_name(candidate_name)
            )
            nickname_equivalent = nickname_equivalent or _nickname_equivalent(
                source_name,
                candidate_name,
            )

        _, last_score, first_score, _, _ = max(
            scored_rows,
            key=lambda scored: scored[:3],
        )
        if (
            last_score < MIN_LAST_NAME_SCORE
            or first_score < MIN_FIRST_NAME_SCORE
        ):
            metrics["single_candidate_failures"] += 1
            continue

        if exact_normalized:
            match_kind = "exact_normalized"
        elif nickname_equivalent:
            match_kind = "nickname_equivalent"
        else:
            match_kind = "fuzzy_qualified"

        manifest.append(
            {
                "nhl_player_id": nhl_player_id,
                "yahoo_player_id": yahoo_player_id,
                "last_name_score": last_score,
                "first_name_score": first_score,
                "match_kind": match_kind,
            }
        )
        metrics["single_candidate_qualified"] += 1
        metrics[f"qualified_{match_kind}"] += 1

    manifest.sort(
        key=lambda row: (
            _identifier_sort_key(row["yahoo_player_id"]),
            row["nhl_player_id"],
        )
    )
    metrics["ambiguous_yahoo_ids"] = sum(
        degree > 1 for degree in yahoo_degree.values()
    )
    return manifest, dict(sorted(metrics.items()))


def manifest_sha256(manifest: list[dict[str, Any]]) -> str:
    canonical = json.dumps(
        manifest,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def select_manifest_for_mode(
    manifest: list[dict[str, Any]],
    *,
    mode: str,
    baseline_manifest: Iterable[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Select new/changed candidates or an explicit complete recompute.

    Removed baseline identities are reported for review and never emitted as a
    deletion or supersession. The rendered SQL separately fails closed on
    verified/manual identity conflicts.
    """
    if mode not in GENERATION_MODES:
        raise ValueError(f"Unsupported generation mode: {mode}")
    if mode == "recompute-all":
        return list(manifest), {"recompute_rows": len(manifest)}
    if baseline_manifest is None:
        raise ValueError("Incremental mode requires a baseline manifest.")

    baseline_rows = list(baseline_manifest)
    baseline_by_yahoo_id = {
        str(row["yahoo_player_id"]): row
        for row in baseline_rows
    }
    if len(baseline_by_yahoo_id) != len(baseline_rows):
        raise ValueError("Baseline manifest contains duplicate Yahoo IDs.")
    current_by_yahoo_id = {
        str(row["yahoo_player_id"]): row
        for row in manifest
    }
    selected = [
        row
        for row in manifest
        if baseline_by_yahoo_id.get(str(row["yahoo_player_id"])) != row
    ]
    metrics = {
        "incremental_new_or_changed": len(selected),
        "incremental_unchanged": len(manifest) - len(selected),
        "removed_requires_review": len(
            set(baseline_by_yahoo_id) - set(current_by_yahoo_id)
        ),
    }
    return selected, metrics


def _sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def render_migration(
    manifest: list[dict[str, Any]],
    metrics: dict[str, int],
    manifest_hash: str,
    *,
    expected_pending_count: int | None = None,
) -> str:
    values = ",\n".join(
        "    ("
        f"{row['nhl_player_id']}, "
        f"{_sql_text(row['yahoo_player_id'])}, "
        f"{row['last_name_score']}, "
        f"{row['first_name_score']}, "
        f"{_sql_text(row['match_kind'])}"
        ")"
        for row in manifest
    )
    expected_count = len(manifest)
    remaining_pending = (
        expected_pending_count
        if expected_pending_count is not None
        else metrics["single_candidate_failures"] + metrics["ambiguous_yahoo_ids"]
    )

    return f"""-- DR-011: promote the explicitly approved Yahoo identity matches.
-- Generator: {GENERATOR_VERSION}
-- Manifest SHA-256: {manifest_hash}
-- Approved rule: last name >= {MIN_LAST_NAME_SCORE}, first name >= {MIN_FIRST_NAME_SCORE},
-- exactly one FHFH candidate per Yahoo player ID. Ambiguous IDs are excluded.

alter table public.fhfh_player_external_identities
    add column if not exists verified_by_system text null;

alter table public.fhfh_player_identity_review_queue
    add column if not exists reviewed_by_system text null;

comment on column public.fhfh_player_external_identities.verified_by_system is
    'Stable service/editorial rule identifier when verification is not performed by an auth.users account.';

comment on column public.fhfh_player_identity_review_queue.reviewed_by_system is
    'Stable service/editorial rule identifier when review is not performed by an auth.users account.';

update public.fhfh_player_external_identities
set verified_by_system = case
    when provider = 'nhl' then 'system:nhl_primary_key_backfill_v1'
    else 'system:legacy_verified_mapping_backfill_v1'
end
where verification_status = 'verified'
  and verified_by is null
  and nullif(btrim(verified_by_system), '') is null;

alter table public.fhfh_player_external_identities
    drop constraint if exists fhfh_player_external_verification_actor_valid;
alter table public.fhfh_player_external_identities
    add constraint fhfh_player_external_verification_actor_valid
    check (
        verification_status <> 'verified'
        or (
            verified_at is not null
            and (
                verified_by is not null
                or nullif(btrim(verified_by_system), '') is not null
            )
        )
    );

alter table public.fhfh_player_identity_review_queue
    drop constraint if exists fhfh_player_identity_review_resolution_valid;
alter table public.fhfh_player_identity_review_queue
    add constraint fhfh_player_identity_review_resolution_valid
    check (
        status <> 'resolved'
        or (
            resolution_action is not null
            and reviewed_at is not null
            and (
                reviewed_by is not null
                or nullif(btrim(reviewed_by_system), '') is not null
            )
        )
    );

create temporary table if not exists approved_yahoo_identity_matches (
    nhl_player_id bigint not null,
    yahoo_player_id text primary key,
    last_name_score smallint not null check (last_name_score between 0 and 100),
    first_name_score smallint not null check (first_name_score between 0 and 100),
    match_kind text not null check (
        match_kind in ('exact_normalized', 'nickname_equivalent', 'fuzzy_qualified')
    )
) on commit drop;

truncate table approved_yahoo_identity_matches;

insert into approved_yahoo_identity_matches (
    nhl_player_id,
    yahoo_player_id,
    last_name_score,
    first_name_score,
    match_kind
) values
{values};

do $validate_manifest$
declare
    invalid_count bigint;
begin
    if (select count(*) from approved_yahoo_identity_matches) <> {expected_count} then
        raise exception 'DR-011 manifest row count drifted from {expected_count}';
    end if;

    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    where approved.last_name_score < {MIN_LAST_NAME_SCORE}
       or approved.first_name_score < {MIN_FIRST_NAME_SCORE};
    if invalid_count <> 0 then
        raise exception 'DR-011 manifest contains % below-threshold rows', invalid_count;
    end if;

    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    left join public.fhfh_player_identities identity
      on identity.nhl_player_id = approved.nhl_player_id
    where identity.id is null;
    if invalid_count <> 0 then
        raise exception 'DR-011 manifest has % missing FHFH identities', invalid_count;
    end if;

    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    where (
        select count(distinct btrim(legacy.nhl_player_id))
        from public.yahoo_nhl_player_map legacy
        where btrim(legacy.yahoo_player_id) = approved.yahoo_player_id
    ) <> 1
    or not exists (
        select 1
        from public.yahoo_nhl_player_map legacy
        where btrim(legacy.yahoo_player_id) = approved.yahoo_player_id
          and btrim(legacy.nhl_player_id) = approved.nhl_player_id::text
    );
    if invalid_count <> 0 then
        raise exception 'DR-011 manifest has % legacy identity conflicts', invalid_count;
    end if;

    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    join public.fhfh_player_identities identity
      on identity.nhl_player_id = approved.nhl_player_id
    left join public.fhfh_player_identity_review_queue review
      on review.dedupe_key = 'yahoo-player-id:' || approved.yahoo_player_id
     and review.review_type = 'external_mapping'
    where review.id is null
       or cardinality(review.candidate_fhfh_player_ids) <> 1
       or review.candidate_fhfh_player_ids[1] <> identity.id
       or not (
            review.status = 'pending'
            or (
                review.status = 'resolved'
                and review.source_evidence->>'review_manifest_sha256'
                    = '{manifest_hash}'
            )
       );
    if invalid_count <> 0 then
        raise exception 'DR-011 manifest has % review-queue conflicts', invalid_count;
    end if;

    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    join public.fhfh_player_identities identity
      on identity.nhl_player_id = approved.nhl_player_id
    where exists (
        select 1
        from public.fhfh_player_external_identities mapping
        where mapping.provider = 'yahoo'
          and mapping.source_provenance->>'yahoo_player_id'
                = approved.yahoo_player_id
          and mapping.fhfh_player_id <> identity.id
    )
    or not exists (
        select 1
        from public.fhfh_player_external_identities mapping
        where mapping.provider = 'yahoo'
          and mapping.fhfh_player_id = identity.id
          and mapping.source_provenance->>'yahoo_player_id'
                = approved.yahoo_player_id
          and (
              mapping.verification_status = 'review_required'
              or (
                  mapping.verification_status = 'verified'
                  and mapping.source_provenance->>'review_manifest_sha256'
                        = '{manifest_hash}'
              )
          )
    );
    if invalid_count <> 0 then
        raise exception 'DR-011 manifest has % staged-mapping conflicts', invalid_count;
    end if;
end
$validate_manifest$;

update public.fhfh_player_external_identities mapping
set
    verification_status = 'verified',
    match_method = case approved.match_kind
        when 'exact_normalized' then 'approved_exact_name_v1'
        when 'nickname_equivalent' then 'approved_nickname_90_50_v1'
        else 'approved_fuzzy_90_50_v1'
    end,
    match_confidence = round(
        ((approved.last_name_score * 0.7)
          + (approved.first_name_score * 0.3))::numeric / 100,
        4
    ),
    verified_at = coalesce(mapping.verified_at, statement_timestamp()),
    verified_by_system = '{REVIEW_ACTOR}',
    source_provenance = mapping.source_provenance || jsonb_build_object(
        'review_rule', '{GENERATOR_VERSION}',
        'review_manifest_sha256', '{manifest_hash}',
        'last_name_score', approved.last_name_score,
        'first_name_score', approved.first_name_score,
        'match_kind', approved.match_kind,
        'review_actor', '{REVIEW_ACTOR}'
    )
from approved_yahoo_identity_matches approved
join public.fhfh_player_identities identity
  on identity.nhl_player_id = approved.nhl_player_id
where mapping.provider = 'yahoo'
  and mapping.fhfh_player_id = identity.id
  and mapping.source_provenance->>'yahoo_player_id' = approved.yahoo_player_id
  and (
      mapping.verification_status = 'review_required'
      or (
          mapping.verification_status = 'verified'
          and mapping.source_provenance->>'review_manifest_sha256'
                = '{manifest_hash}'
      )
  );

update public.fhfh_player_identity_review_queue review
set
    status = 'resolved',
    resolution_action = 'approved_bulk_match_90_50_v1',
    resolved_fhfh_player_id = identity.id,
    resolution_notes = 'User-approved DR-011 bulk review: unique Yahoo candidate, last name >= 90, first name >= 50.',
    reviewed_by_system = '{REVIEW_ACTOR}',
    reviewed_at = coalesce(review.reviewed_at, statement_timestamp()),
    source_evidence = review.source_evidence || jsonb_build_object(
        'review_rule', '{GENERATOR_VERSION}',
        'review_manifest_sha256', '{manifest_hash}',
        'last_name_score', approved.last_name_score,
        'first_name_score', approved.first_name_score,
        'match_kind', approved.match_kind,
        'review_actor', '{REVIEW_ACTOR}'
    )
from approved_yahoo_identity_matches approved
join public.fhfh_player_identities identity
  on identity.nhl_player_id = approved.nhl_player_id
where review.review_type = 'external_mapping'
  and review.dedupe_key = 'yahoo-player-id:' || approved.yahoo_player_id
  and (
      review.status = 'pending'
      or (
          review.status = 'resolved'
          and review.source_evidence->>'review_manifest_sha256'
                = '{manifest_hash}'
      )
  );

do $verify_promotion$
declare
    invalid_count bigint;
begin
    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    join public.fhfh_player_identities identity
      on identity.nhl_player_id = approved.nhl_player_id
    where exists (
        select 1
        from public.fhfh_player_external_identities mapping
        where mapping.provider = 'yahoo'
          and mapping.fhfh_player_id = identity.id
          and mapping.source_provenance->>'yahoo_player_id'
                = approved.yahoo_player_id
          and (
              mapping.verification_status <> 'verified'
              or mapping.verified_by_system <> '{REVIEW_ACTOR}'
              or mapping.source_provenance->>'review_manifest_sha256'
                    <> '{manifest_hash}'
          )
    );
    if invalid_count <> 0 then
        raise exception 'DR-011 left % approved players incompletely promoted', invalid_count;
    end if;

    select count(*) into invalid_count
    from approved_yahoo_identity_matches approved
    left join public.fhfh_player_identity_review_queue review
      on review.dedupe_key = 'yahoo-player-id:' || approved.yahoo_player_id
     and review.review_type = 'external_mapping'
    where review.status <> 'resolved'
       or review.reviewed_by_system <> '{REVIEW_ACTOR}'
       or review.source_evidence->>'review_manifest_sha256'
            <> '{manifest_hash}';
    if invalid_count <> 0 then
        raise exception 'DR-011 left % approved reviews unresolved', invalid_count;
    end if;

    if (
        select count(*)
        from public.fhfh_player_identity_review_queue review
        where review.review_type = 'external_mapping'
          and review.dedupe_key like 'yahoo-player-id:%'
          and review.status = 'pending'
    ) <> {remaining_pending} then
        raise exception 'DR-011 remaining pending review count drifted from {remaining_pending}';
    end if;
end
$verify_promotion$;
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest-output", type=Path)
    parser.add_argument("--mode", choices=GENERATION_MODES, default="recompute-all")
    parser.add_argument("--baseline-manifest", type=Path)
    parser.add_argument("--expected-count", type=int, required=True)
    parser.add_argument("--expected-pending-count", type=int)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repository_root = Path(__file__).resolve().parents[5]
    load_dotenv(repository_root / "web" / ".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Server-side Supabase credentials are required.")
    if not args.output.exists():
        raise SystemExit("Create the migration with `supabase migration new` first.")
    if args.output.read_text(encoding="utf-8").strip() and not args.force:
        raise SystemExit("Output migration is not empty; pass --force to replace it.")

    client = create_client(url, key)
    mapping_rows = fetch_all_by_numeric_text_prefix(
        client,
        "yahoo_nhl_player_map",
        "nhl_player_id,yahoo_player_id,nhl_player_name,yahoo_player_name",
        "yahoo_player_id",
    )
    manifest, metrics = build_manifest(mapping_rows)
    baseline_manifest = None
    if args.mode == "incremental":
        if args.baseline_manifest is None or args.expected_pending_count is None:
            raise SystemExit(
                "Incremental mode requires --baseline-manifest and "
                "--expected-pending-count."
            )
        baseline_manifest = json.loads(
            args.baseline_manifest.read_text(encoding="utf-8")
        )
        if not isinstance(baseline_manifest, list):
            raise SystemExit("Baseline manifest must be a JSON array.")
    selected_manifest, selection_metrics = select_manifest_for_mode(
        manifest,
        mode=args.mode,
        baseline_manifest=baseline_manifest,
    )
    metrics.update(selection_metrics)
    if not selected_manifest:
        raise SystemExit("Selected manifest is empty; no migration is required.")
    if len(selected_manifest) != args.expected_count:
        raise SystemExit(
            f"Selected manifest has {len(selected_manifest)} rows, expected "
            f"{args.expected_count}; refusing to write migration."
        )
    manifest_hash = manifest_sha256(selected_manifest)
    args.output.write_text(
        render_migration(
            selected_manifest,
            metrics,
            manifest_hash,
            expected_pending_count=args.expected_pending_count,
        ),
        encoding="utf-8",
    )
    if args.manifest_output is not None:
        args.manifest_output.write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(
        json.dumps(
            {
                "manifest_sha256": manifest_hash,
                "metrics": metrics,
                "output": str(args.output),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
