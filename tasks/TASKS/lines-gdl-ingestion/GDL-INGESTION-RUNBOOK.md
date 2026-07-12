# GDL Suite Ingestion Runbook

## IFTTT applets

Create one X/Twitter-to-Webhooks applet for each account. Use `POST`, content type `application/json`, and the matching deployed secret in the `x-fhfh-ifttt-secret` header. Do not put secrets in the URL or this document.

| Watched account | Webhooks URL | Secret environment variable |
|---|---|---|
| `GameDayGoalies` | `https://fhfhockey.com/api/v1/sources/ifttt/gamedaygoalies-tweet?process=true` | `IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET` |
| `GameDayLines` | `https://fhfhockey.com/api/v1/sources/ifttt/gamedaylines-tweet?process=true` | `IFTTT_GAMEDAYLINES_WEBHOOK_SECRET` |
| `GameDayNewsNHL` | `https://fhfhockey.com/api/v1/sources/ifttt/gamedaynewsnhl-tweet?process=true` | `IFTTT_GAMEDAYNEWSNHL_WEBHOOK_SECRET` |

Use this body shape with the corresponding IFTTT ingredients:

```json
{
  "source_account": "GameDayLines",
  "username": "{{UserName}}",
  "text": "{{Text}}",
  "link_to_tweet": "{{LinkToTweet}}",
  "created_at": "{{CreatedAt}}",
  "tweet_embed_code": "{{TweetEmbedCode}}"
}
```

Change only `source_account` for the other two applets. The receiver stores the raw event before attempting `process=true`; a processor failure leaves the event pending/retryable and does not reject the webhook.

## Bounded catch-up and cron safety net

The processor defaults to the `gdl_suite` source group and today's date. It processes at most `limit` pending events (1–100) in oldest-first order. Repeat until `summary.eventsLoaded` is zero:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://fhfhockey.com/api/v1/db/update-line-sources?sourceGroup=gdl_suite&limit=100"
```

For a controlled reprocess, add `date=YYYY-MM-DD`, `reprocess=true`, and either `sourceKey=<key>` or `tweetId=<id>`. Reprocessing is still bounded by `limit` and event/source filters.

Recommended safety net: schedule the default catch-up request every 10 minutes after the three applets and deployed secrets are verified. Keep it inactive until the additive `lineCombinations` provenance migration is applied. The schedule should invoke:

```text
POST /api/v1/db/update-line-sources?sourceGroup=gdl_suite&limit=100
```

## Operator queries

Pending and failed raw events:

```sql
select source_key, source_account, processing_status, count(*)
from public.line_source_ifttt_events
where processing_status in ('pending', 'failed')
group by source_key, source_account, processing_status
order by source_key, processing_status;
```

Recent accepted and rejected snapshots:

```sql
select snapshot_date, source_key, source_account, team_abbreviation,
       classification, status, nhl_filter_status, nhl_filter_reason,
       tweet_id, source_url, observed_at
from public.line_source_snapshots
order by observed_at desc
limit 100;
```

First-arrival candidates for one date (application ordering additionally falls back from `tweet_posted_at` to `observed_at`, then source/tweet/capture keys):

```sql
select snapshot_date, team_id, game_id, classification, source_key,
       tweet_posted_at, observed_at, tweet_id, capture_key
from public.line_source_snapshots
where snapshot_date = current_date
  and status = 'observed'
  and nhl_filter_status = 'accepted'
order by snapshot_date, team_id, game_id, classification,
         coalesce(tweet_posted_at, observed_at), source_key, tweet_id, capture_key;
```

Canonical lineup provenance after synchronization:

```sql
select "gameId", "teamId", cardinality(forwards) as forwards,
       cardinality(defensemen) as defensemen, cardinality(goalies) as goalies,
       source_kind, source_key, source_url, source_capture_key, observed_at
from public."lineCombinations"
where observed_at >= now() - interval '24 hours'
order by observed_at desc;
```

Unresolved-name queue by source:

```sql
select source, metadata->>'sourceAccount' as source_account,
       metadata->>'parserReason' as parser_reason, team_abbreviation,
       raw_name, tweet_id, source_url, created_at
from public.lineup_unresolved_player_names
where status = 'pending'
order by created_at desc;
```

## Verification and recovery

- A healthy webhook returns HTTP 200 with `processingStatus` equal to `pending` or `processed_attempted`.
- A failed immediate processor attempt must still leave the raw event stored as `pending`; use the catch-up request rather than replaying or editing the event manually.
- `summary.lineCombinationSync.failures` must be empty after the migration is applied. Ineligible or incomplete snapshots remain source evidence and do not mutate canonical arrays.
- Rejected and ambiguous snapshots must never appear as first-arrival winners or canonical lineup writes.
- Full lineup/practice writes require 12 unique forward IDs and 6 unique defense IDs. Goalie-start writes require at least one canonical goalie ID and preserve existing skater arrays.

## Unresolved-name email, alias, and reprocess checklist

Use one controlled GDL event containing a deliberately unrecognized alias for a real rostered player. Keep its source key and tweet ID so every step can be tied to the same event.

1. Process the event and use the unresolved-name query above to confirm one pending row preserves `source`, `source_account`, `source_url`, `tweet_id`, team context, `parser_reason`, and the original raw name. Do not continue if the event is rejected for an unrelated parser/team reason.
2. While authenticated through the deployed admin path, send `POST /api/v1/db/send-player-name-alias-review`. Confirm HTTP 200, `success: true`, a non-null `emailId`, and receipt at `PLAYER_ALIAS_REVIEW_EMAIL` (or the configured cron-report recipient). Do not record the signed review URL in repository artifacts.
3. Open the email's signed `/db/player-aliases` link. Confirm the page shows the same source, team, tweet ID, source URL, context, and unresolved alias; choose the canonical player and save.
4. Confirm the unresolved row is `resolved` with `resolved_player_id` and `resolved_alias_id`, and confirm `lineup_player_name_aliases` contains the normalized alias/player mapping.
5. Reprocess only the controlled event with `POST /api/v1/db/update-line-sources?sourceGroup=gdl_suite&tweetId=<tweet-id>&reprocess=true&limit=1` using the protected cron/admin path.
6. Confirm the event leaves the unresolved state, the resulting snapshot resolves the canonical player, no duplicate pending unresolved row is created, and any eligible first-arrival or `lineCombinations` behavior follows the normal accepted-row rules. Preserve only row IDs/counts and status evidence, never secrets or signed review tokens.
