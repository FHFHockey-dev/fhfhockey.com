# PRD: lines_ccc Tweet Ingestion

## Introduction/Overview

Build a new `lines_ccc` ingestion path for locally configured X/Twitter embed sources. The feature should use the existing GameDayTweets lineup ingestion methodology as the baseline, but ingest selected accounts and tweets from our own site-controlled source catalog instead of `gamedaytweets.com`.

The goal is to poll selected public hockey accounts, enrich concrete tweet URLs with X/Twitter oEmbed when possible, parse lineup, practice-line, power-play, goalie-start, injury, return, and transaction signals, reconcile names against roster data, and persist transparent historical rows in Supabase table `public.lines_ccc`.

CCC has a different source shape than GameDayTweets. CCC frequently quote-tweets source accounts and may repost AHL, ECHL, and other non-NHL league content. The implementation must analyze that tweet style before finalizing the SQL table or parser contract.

## Goals

1. Add a local source catalog page at `/twitterEmbeds` for configured public X/Twitter timelines or tweet embeds.
2. Add a dedicated backend/admin ingestion route for `lines_ccc` that can be called by a scheduled poll.
3. Reuse the current GameDayTweets parsing, classification, oEmbed enrichment, roster matching, and historical row-shaping patterns where appropriate.
4. Store structured lineup fields and tweet-specific provenance in `public.lines_ccc`.
5. Preserve honest timestamp semantics: exact timestamps only when derivable; day precision or null otherwise.
6. Avoid regressions in the current `lines_gdl` path.
7. Access and parse quoted tweet content when CCC's own tweet is only a wrapper such as "Kings lines".
8. Ignore non-NHL teams/leagues before row shaping so AHL, ECHL, junior, international, and other league content does not pollute NHL lineup history.

## User Stories

1. As an admin, I want a local page listing embedded X/Twitter sources so the ingestion system has a site-controlled discovery surface.
2. As an admin, I want a scheduled polling route to ingest selected public accounts so lineup-relevant tweets are captured without using a push/webhook integration.
3. As an analyst, I want tweet text, source URL, classification, keyword hits, structure signals, matched names, and unmatched names preserved so parsed results can be audited later.
4. As an analyst, I want structured line, pair, goalie, injury, and metadata fields saved in Supabase so historical lineup signals can be queried consistently with other `lines_*` tables.
5. As a developer, I want shared oEmbed and tweet parsing helpers so `lines_ccc` and `lines_gdl` stay consistent without copy-pasted logic.

## Functional Requirements

1. Create `web/pages/twitterEmbeds/index.tsx`.
2. The initial page must embed the `CcCMiddleton` timeline:

   ```html
   <a class="twitter-timeline" href="https://x.com/CcCMiddleton">
     Posts by CcCMiddleton
   </a>
   <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>
   ```

3. The page should be structured so more handles or specific tweet URLs can be added later without changing ingestion logic.
4. Create a dedicated admin ingestion route for `lines_ccc`, for example `web/pages/api/v1/db/update-lines-ccc.ts`.
5. The route must be designed for scheduled polling, not push/webhook delivery.
6. The route should support a poll cadence target of every 1-2 minutes, while deduping by tweet URL or tweet id so repeated polls are safe.
7. The ingestion route must load configured sources from local code/config and should not rely only on timeline widget rendered text.
8. When concrete tweet URLs are available, the backend must prefer per-tweet oEmbed enrichment using `publish.twitter.com/oembed` or `publish.x.com/oembed`.
9. The timeline oEmbed endpoint may be used for discovery/catalog validation, but not as the only source of parseable tweet text.
10. Before creating the SQL migration, run a CCC-specific source analysis pass using recent timeline examples and at least the known quote tweet `https://x.com/CcCMiddleton/status/2047489659752886286`.
11. The analysis pass must document:
    - direct CCC tweet patterns
    - quote tweet patterns
    - repost/retweet patterns if discoverable
    - source accounts commonly quoted
    - NHL team labels used by CCC
    - non-NHL team/league labels that must be rejected
    - which fields are actually available from oEmbed versus browser-rendered cards
12. For quote tweets, the parser must not stop at CCC wrapper text if the wrapper only says things like `Kings lines`.
13. For quote tweets, resolve outbound `t.co` links when present and identify whether they point to another X/Twitter status URL.
14. When a quoted status URL is resolved, call oEmbed for the quoted status separately and parse that quoted tweet text as the primary lineup content.
15. Store both the wrapper tweet provenance and quoted tweet provenance when a quote tweet is parsed.
16. If the quoted tweet cannot be resolved or fetched, reject the candidate unless CCC's wrapper text alone contains enough NHL lineup content to parse honestly.
17. The parser must apply an NHL-only filter before persisting structured rows.
18. The NHL-only filter must accept content only when it can map the tweet to a known NHL team by one or more of:
    - NHL team abbreviation
    - NHL full team name
    - NHL location or short name
    - official/common NHL account handle references
    - roster match density against an NHL roster
19. The NHL-only filter must reject content when it strongly indicates AHL, ECHL, junior, college, international, or other non-NHL teams/leagues.
20. The NHL-only filter should preserve rejection metadata for audit, including detected league/team hints and rejection reason.
21. Ambiguous tweets should be rejected or stored with `status = 'rejected'`; they must not be coerced into an NHL team.
22. The implementation must inspect and preserve relevant behavior from:
    - `web/lib/sources/lineupSourceIngestion.ts`
    - `web/pages/api/v1/db/update-lineup-source-provenance.ts`
    - `web/lib/sources/lineupSourceIngestion.test.ts`
23. Reuse or factor shared helpers for:
    - oEmbed HTML parsing
    - `<br>` to newline preservation
    - posted label extraction from the last link when available
    - day-precision date label parsing
    - keyword hit detection
    - tweet classification
    - structured line/pair extraction
    - roster name normalization, initials, and alias overrides
    - historical line row shaping
24. Do not remove or weaken `fetchGameDayTweetOEmbedData(...)` behavior.
25. Preserve the current GameDayTweets classifications and apply them to `lines_ccc` where applicable:
    - `lineup`
    - `practice_lines`
    - `power_play`
    - `goalie_start`
    - `injury`
    - `other`
26. Parse and store line combinations when tweets contain three-player forward lines.
27. Parse and store defense pairs when tweets contain two-player pairings.
28. Parse and store goalies when tweets identify starters or goalie order.
29. Parse and store power-play units in metadata/raw payload when detected. The fixed `lines_*` tables do not currently have dedicated PP unit columns, so PP structures should remain auditable in JSON unless a separate normalized PP table is later approved.
30. Parse injuries, returns, recalls, signings, and related transaction-style statuses when possible and store them in `injured_*` fields and/or metadata depending on structure confidence.
31. Cross-reference parsed names against current roster/player data before storing structured player id fields.
32. If no clean structured groups exist, fall back to ordered roster hits from tweet text, matching current GDT behavior.
33. Persist both raw mirrored/discovered text and enriched oEmbed text when available.
34. Persist metadata including:
    - raw text
    - enriched text source
    - tweet URL
    - tweet id when derivable from URL
    - quoted tweet URL and quoted tweet id when applicable
    - quoted tweet text when fetched
    - resolved `t.co` URLs
    - source handle / author when available
    - keyword hits
    - structure signals
    - matched player ids
    - matched names
    - unmatched names
    - detected NHL team hints
    - detected non-NHL league/team hints
    - classification
    - posted label
    - posted timestamp when derivable
    - timestamp precision
35. If exact tweet timestamp is not available, the route must not fabricate one.
36. The route must upsert rows into `public.lines_ccc` using `capture_key` as the conflict target.
37. The route response should include a concise operational summary:
    - sources processed
    - tweets discovered
    - tweets parsed
    - quote tweets resolved
    - non-NHL tweets rejected
    - rows upserted
    - skipped/duplicate count
    - parse rejection reasons where practical

## Non-Goals

1. Do not implement X Account Activity API, webhooks, or push ingestion.
2. Do not scrape private or authenticated X content.
3. Do not depend on browser-rendered timeline widget DOM as the only backend source.
4. Do not infer unsupported exact tweet timestamps.
5. Do not change the selected-source ranking behavior for `lines_nhl`, `lines_dfo`, or `lines_gdl`.
6. Do not remove the current GameDayTweets oEmbed enrichment path.
7. Do not build a full admin UI for source management in this pass.
8. Do not store AHL, ECHL, junior, college, international, or other non-NHL lineup rows as NHL history.
9. Do not treat CCC's wrapper text as sufficient when the useful lineup content is inside a quoted tweet.

## Design Considerations

The `/twitterEmbeds` page can be minimal. It should render the configured timeline embeds and make the source account visibly inspectable. It is a source catalog/discovery page, not a marketing page.

Initial source:

```ts
const twitterEmbedSources = [
  {
    handle: "CcCMiddleton",
    url: "https://x.com/CcCMiddleton",
    label: "Posts by CcCMiddleton"
  }
];
```

## Technical Considerations

The current `publish.x.com/oembed` timeline call for `https://x.com/CcCMiddleton` returns timeline widget HTML, not individual tweet text. Therefore, reliable ingestion should resolve concrete tweet URLs first and then call per-tweet oEmbed for text extraction.

For `https://x.com/CcCMiddleton/status/2047489659752886286`, per-tweet oEmbed returns CCC's wrapper text (`Kings lines`) and a `t.co` URL, but not the quoted Zach Dooley tweet text. The `t.co` URL resolves to `https://twitter.com/dooleylak/status/2047489041999020180`. The parser therefore needs a quote-tweet resolution step: expand links, detect quoted status URLs, fetch oEmbed for the quoted status, and parse the quoted tweet body as the primary lineup text.

Current repo patterns to preserve:

1. `fetchGameDayTweetOEmbedData(...)` calls oEmbed, parses the first `<p>`, replaces `<br>` with `\n`, and uses the last `<a>` for posted date/source URL.
2. `classifyGameDayTweet(...)` uses keyword arrays and regex structure signals.
3. `buildGameDayTweetsLineupSourceFromTweet(...)` validates roster hits, requires enough matched players for lineup candidates, extracts structured groups, and falls back to ordered roster hits.
4. `toHistoricalLineSourceRow(...)` stores ordered line/pair/goalie columns, raw payload, metadata, and `tweet_posted_at` for GDT rows.

Implementation should consider factoring tweet-specific helpers into a shared module, for example `web/lib/sources/tweetLineupParsing.ts`, while keeping exported compatibility wrappers for existing GDT tests.

## Schema Analysis Requirements

Do not create the final `lines_ccc` migration until CCC's recent tweet style has been sampled and the quote-tweet/non-NHL filtering behavior is proven with fixtures. The implementation pass should first produce a short schema recommendation based on real CCC examples, especially quote tweets and non-NHL reposts.

The table should still mirror the `lines_gdl` storage philosophy, but it likely needs first-class fields for quote tweet provenance and NHL filter decisions.

## Provisional SQL/Table Direction

After the analysis pass, create a migration such as `web/sql/ratings/007_create_lines_ccc.sql`. The starting candidate is:

```sql
CREATE TABLE IF NOT EXISTS public.lines_ccc (
  capture_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tweet_posted_at TIMESTAMPTZ NULL,
  tweet_id TEXT NULL,
  tweet_url TEXT NULL,
  quoted_tweet_id TEXT NULL,
  quoted_tweet_url TEXT NULL,
  quoted_author_handle TEXT NULL,
  quoted_author_name TEXT NULL,
  source_handle TEXT NULL,
  author_name TEXT NULL,
  detected_league TEXT NULL,
  nhl_filter_status TEXT NOT NULL DEFAULT 'accepted',
  nhl_filter_reason TEXT NULL,
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_abbreviation TEXT NOT NULL,
  team_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'lines_ccc',
  source_url TEXT NULL,
  source_label TEXT NULL,
  status TEXT NOT NULL DEFAULT 'observed',
  classification TEXT NOT NULL DEFAULT 'other',
  line_1_player_ids BIGINT[] NULL,
  line_1_player_names TEXT[] NULL,
  line_2_player_ids BIGINT[] NULL,
  line_2_player_names TEXT[] NULL,
  line_3_player_ids BIGINT[] NULL,
  line_3_player_names TEXT[] NULL,
  line_4_player_ids BIGINT[] NULL,
  line_4_player_names TEXT[] NULL,
  pair_1_player_ids BIGINT[] NULL,
  pair_1_player_names TEXT[] NULL,
  pair_2_player_ids BIGINT[] NULL,
  pair_2_player_names TEXT[] NULL,
  pair_3_player_ids BIGINT[] NULL,
  pair_3_player_names TEXT[] NULL,
  goalie_1_player_id BIGINT NULL,
  goalie_1_name TEXT NULL,
  goalie_2_player_id BIGINT NULL,
  goalie_2_name TEXT NULL,
  scratches_player_ids BIGINT[] NULL,
  scratches_player_names TEXT[] NULL,
  injured_player_ids BIGINT[] NULL,
  injured_player_names TEXT[] NULL,
  raw_text TEXT NULL,
  enriched_text TEXT NULL,
  quoted_raw_text TEXT NULL,
  quoted_enriched_text TEXT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lines_ccc_status_check
    CHECK (status = ANY (ARRAY['observed'::text, 'rejected'::text, 'superseded'::text, 'duplicate'::text])),
  CONSTRAINT lines_ccc_classification_check
    CHECK (classification = ANY (ARRAY[
      'lineup'::text,
      'practice_lines'::text,
      'power_play'::text,
      'goalie_start'::text,
      'injury'::text,
      'other'::text
    ])),
  CONSTRAINT lines_ccc_nhl_filter_status_check
    CHECK (nhl_filter_status = ANY (ARRAY[
      'accepted'::text,
      'rejected_non_nhl'::text,
      'rejected_ambiguous'::text
    ]))
);

CREATE UNIQUE INDEX IF NOT EXISTS lines_ccc_tweet_team_unique_idx
  ON public.lines_ccc (tweet_id, team_id)
  WHERE tweet_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lines_ccc_quoted_tweet_team_unique_idx
  ON public.lines_ccc (quoted_tweet_id, team_id)
  WHERE quoted_tweet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lines_ccc_snapshot_date_idx
  ON public.lines_ccc (snapshot_date DESC, team_id);

CREATE INDEX IF NOT EXISTS lines_ccc_game_idx
  ON public.lines_ccc (game_id, team_id);

CREATE INDEX IF NOT EXISTS lines_ccc_tweet_url_idx
  ON public.lines_ccc (tweet_url)
  WHERE tweet_url IS NOT NULL;

COMMENT ON TABLE public.lines_ccc IS
  'Historical locally configured X/Twitter NHL lineup signal snapshots with explicit line, pair, goalie, quote tweet provenance, raw text, NHL filter decisions, and metadata.';

COMMENT ON COLUMN public.lines_ccc.tweet_posted_at IS
  'Tweet posted date/time when derivable from oEmbed or source text. May be day precision only; exact time must not be fabricated.';
```

## Test Requirements

1. Add targeted tests for shared oEmbed parsing with `<br>` preservation.
2. Add classification tests for lineup, practice lines, power play, goalie start, injury, and other tweets.
3. Add roster normalization tests covering initials such as `N. Foligno`.
4. Add alias override tests covering `JEEk -> Joel Eriksson Ek`.
5. Add structured extraction tests for forward lines, defense pairs, and goalies.
6. Add fallback ordered roster-hit tests for tweets without clean line breaks.
7. Add `lines_ccc` row-shaping tests that verify:
   - `tweet_id`
   - `tweet_url`
   - `quoted_tweet_id`
   - `quoted_tweet_url`
   - `source_handle`
   - `classification`
   - `nhl_filter_status`
   - `tweet_posted_at`
   - raw/enriched text
   - quoted raw/enriched text
   - metadata fields
   - player id arrays
8. Add tests for expanding a `t.co` URL from a CCC wrapper tweet into a quoted X/Twitter status URL.
9. Add tests proving quoted tweet text is used as the primary parse text when CCC's wrapper text is incomplete.
10. Add tests that reject AHL, ECHL, and other non-NHL team examples even when they contain line-combination-like structure.
11. Add route-level tests or mocked integration coverage for dedupe/upsert behavior.
12. Run existing `lineupSourceIngestion.test.ts` to confirm no `lines_gdl` regression.

## Success Metrics

1. `lines_ccc` ingestion can parse and upsert at least one valid structured row from a mocked per-tweet oEmbed payload.
2. Repeated polls of the same tweet do not create duplicate rows.
3. Existing GDT tests continue to pass.
4. Rows preserve raw/enriched text and transparent parse metadata.
5. No exact timestamp is stored unless the source provides enough information to support it.
6. Quote tweets where CCC only provides a short label can still be parsed by resolving and fetching the quoted tweet.
7. Non-NHL lineup-style tweets are rejected before being persisted as observed NHL rows.

## Open Questions

1. Which source configuration format should be used after the first hardcoded `CcCMiddleton` source: local TypeScript constant, JSON file, or database-backed admin config?
2. Should non-lineup signals such as transactions and injuries stay in `lines_ccc` metadata only, or should they also feed the existing player status history pipeline later?
3. Should power-play units eventually get dedicated columns or a separate normalized table?
4. Should `lines_ccc` rows participate in `source_provenance_snapshots`, or remain a standalone historical source table for this pass?
5. What exact scheduled runner will call the admin route in production, and where should the 1-2 minute cadence be configured?
6. Should rejected non-NHL tweets be inserted as `status = 'rejected'` audit rows, or only counted/logged in route metadata?
