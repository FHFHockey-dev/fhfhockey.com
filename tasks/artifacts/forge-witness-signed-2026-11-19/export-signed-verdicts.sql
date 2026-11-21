-- Read-only export for the offline acceptance audit (audit-signed-verdicts.ts). For each listed game's claim: the
-- signed verdict as stored, and the custody hashes as they are NOW (raw recomputed from the stored packet bytes).
-- Nothing here is trusted by the audit except as input to compare; the signature check uses the source-pinned key.
--   psql -X -At -v games='2026020356,2026020357' -f export-signed-verdicts.sql > signed-verdicts.json
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
with g as (select unnest(string_to_array(replace(:'games', ' ', ''), ','))::bigint as game_id)
select coalesce(json_agg(json_build_object(
  'gameId', g.game_id, 'claimId', c.id,
  'custody', json_build_object('rawSha256', a.raw_sha256, 'packetSha256', encode(sha256(a.packet), 'hex'),
    'canonicalSha256', a.canonical_sha256, 'tsaTokenSha256', w.tsa_token_sha256, 'scheduledStart', c.scheduled_start),
  'signed', forge_witness.signed_verdict_v1(c.id)) order by g.game_id), '[]')
from g left join forge_pregame_capture.claims c on c.game_id = g.game_id and c.policy_id = 'pregame-native-v1'
left join forge_pregame_capture.artifacts a on a.claim_id = c.id
left join forge_pregame_capture.witnesses w on w.claim_id = c.id;
