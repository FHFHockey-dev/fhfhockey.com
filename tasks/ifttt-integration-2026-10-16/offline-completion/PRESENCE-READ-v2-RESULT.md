# Approved presence read — terminal result

TJ approved the new exact one-call statement in `PRESENCE-READ-v2-PROPOSAL.md`. Supabase project `fyhftlxokyjtpndbkfse` returned successfully for query SHA256 `d1781ffff8b36046129c81ff0910c0762a38c21a08fab85b20b1095991665248`: 20 allowlisted catalog records, five absent relations, guard null, SQL payload 3,119 bytes, connector wrapper 4,614 bytes. One call; zero retries or follow-up hosted queries.

The absent public relations are `line_source_captures`, `line_claim_revisions`, `line_claim_relations`, `line_entry_revisions` and `line_pp_decisions`. The other 15 names exist as ordinary relations with RLS enabled. Full flags and standard-role ACL fingerprints are retained in `presence-v2-approved-result.json`, including the unchanged raw connector response. This is metadata evidence only: it does not prove column/function compatibility, complete ACL correctness, deployed consumer behavior, legacy absence or safe migration application.

No application rows, helper bodies, migration history or credentials were read. No application DML/DDL, ingestion, activation, dispatch, replay or corrective operation occurred. Provider-side query logging/metadata compute may have occurred as described in the approved proposal. The earlier package's size guard and stopped second query remain preserved in `CATALOG-READ-RESULT.md`; there is no current denial, pending approval or uncertain outcome for either executed attempt.

The five absent names are concrete prerequisites to reconcile against the staged migration/consumer inventory before rollout. No new hosted action or production correction is authorized by this result. Local disposable storage work continues independently.
