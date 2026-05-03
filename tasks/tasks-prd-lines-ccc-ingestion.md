## Relevant Files

- `tasks/TASKS/prd-lines-ccc-ingestion.md` - Source PRD for the implementation plan.
- `web/pages/twitterEmbeds/index.tsx` - New local source catalog page for selected X/Twitter embeds.
- `web/pages/twitterEmbeds/index.module.scss` - Styles for local tweet-card fallback rendering when X timeline widgets are unavailable or rate-limited.
- `web/lib/sources/lineupSourceIngestion.ts` - Existing GDT parsing, oEmbed, classification, roster matching, and row-shaping patterns to preserve or factor from.
- `web/lib/sources/lineupSourceIngestion.test.ts` - Existing regression coverage for GDT behavior that must continue passing.
- `web/lib/sources/tweetLineupParsing.ts` - Likely new shared helper module for reusable tweet/oEmbed parsing and CCC-specific quote handling.
- `web/lib/sources/tweetLineupParsing.test.ts` - Focused tests for oEmbed parsing, quote expansion, classification, NHL filtering, and structured extraction.
- `web/lib/sources/linesCccIngestion.ts` - New CCC ingestion/domain module with `lines_ccc` row shaping.
- `web/lib/sources/linesCccIngestion.test.ts` - Focused tests for CCC row shaping, dedupe keys, quote-tweet behavior, and non-NHL rejection.
- `web/pages/api/v1/db/update-lines-ccc.ts` - New admin polling route shell for `lines_ccc` ingestion.
- `web/pages/api/v1/sources/ifttt/ccc-tweet.ts` - New IFTTT webhook receiver for CCC tweet discovery events.
- `web/sql/ratings/007_create_lines_ccc.sql` - New Supabase migration for `public.lines_ccc` after CCC source analysis confirms schema shape.
- `web/sql/ratings/008_create_lines_ccc_ifttt_events.sql` - New Supabase migration for raw IFTTT CCC tweet discovery queue rows.
- `web/sql/ratings/014_create_tweet_pattern_review_items.sql` - New manual tweet-pattern review queue table for corpus polling, category assignment, and evidence highlights.
- `web/sql/ratings/015_add_review_assignments_to_tweet_pattern_review_items.sql` - Adds multi-assignment JSON storage so one tweet can carry multiple player-linked review decisions.
- `web/sql/ratings/016_create_news_feed_funnel.sql` - Creates the distilled news-card funnel, player join rows, and manual keyword phrase storage.
- `web/lib/newsFeed.ts` - Shared news-feed helpers for card normalization, team theming, published-feed loading, and player-flag lookups.
- `web/components/NewsFeed/NewsCard.tsx` - Reusable distilled news card used for preview and feed rendering.
- `web/components/NewsFeed/NewsCard.module.scss` - Shared dark news-card styling aligned to the FHFH design system.
- `web/lib/sources/tweetPatternReview.ts` - Shared pattern-review category suggestions, review-text shaping, evidence normalization, and dedupe helpers.
- `web/pages/api/v1/db/tweet-pattern-review.ts` - Admin review-queue API for syncing stored tweets into the corpus-review queue and saving manual classifications.
- `web/pages/api/v1/db/news-feed-items.ts` - Admin API for saving draft/published news cards and manual keyword phrases tied to reviewed tweets.
- `web/pages/db/tweet-pattern-review.tsx` - Tweet-by-tweet manual pattern-analysis UI inspired by the player-alias review page.
- `web/pages/news/index.tsx` - New distilled `/news` feed surface for published cards with search and filter controls.
- `web/pages/news/index.module.scss` - System-styled dense layout for the published `/news` feed.
- `web/pages/lines/index.tsx` - Lines landing page now consumes published news flags per player from the new funnel.
- `web/styles/Lines.module.scss` - Adds player news-pill styling to the lines landing page rows.

### Notes

- Do the CCC source-analysis/fixture pass before creating the final SQL migration.
- Keep existing `lines_gdl` behavior intact; run the existing lineup ingestion tests after helper extraction.
- Use mocked oEmbed and `t.co` responses in tests rather than depending on live X/Twitter availability.
- The `/twitterEmbeds` page needs an explicit `window.twttr.widgets.load(...)` call after hydration/script load; otherwise the fallback link text can remain visible even when cookies are unblocked.
- Local `/twitterEmbeds` verification showed `widgets.js` loads, but X's timeline hydration request can return `429`; this means the local page may show fallback text even when our widget markup is correct.
- `publish.twitter.com/oembed` responses checked for CCC wrapper, quoted Dooley tweet, and timeline oEmbed did not include `x-rate-limit-limit`, `x-rate-limit-remaining`, or `x-rate-limit-reset`; ingestion needs internal backoff/caching rather than relying on X rate-limit headers.
- Live GameDayTweets inspection confirmed GDT server-renders tweet-like `blockquote.tweet.full-sized-tweet` markup with tweet text, source handle, status URL, and date already in HTML. It lazy-adds `twitter-tweet` near viewport and calls `twttr.widgets.load(...)`; widgets are enhancement, not the source of stored content.

### CCC Source Examples Captured For 1.1

- NHL quote wrapper requiring quoted content: `https://x.com/CcCMiddleton/status/2047489659752886286` has CCC text `Kings lines`; its outbound `t.co` resolves to quoted Zach Dooley status `https://twitter.com/dooleylak/status/2047489041999020180`.
- NHL quote wrapper with quoted lines: `https://x.com/CcCMiddleton/status/2047489528731246914` has CCC text `Avalanche lines`; mirrored quote content includes full Avalanche line groups and goalie.
- NHL goalie quote wrapper: `https://x.com/CcCMiddleton/status/2047483989713424385` has CCC text confirming Avalanche/Kings goalies; mirrored quote content identifies both starters.
- NHL direct structured text: `https://x.com/CcCMiddleton/status/2028990278749831669` has Predators lines directly in CCC text with a `(Bit of a guess!)` caveat.
- NHL multi-team quote wrapper: `https://x.com/CcCMiddleton/status/2029008610869875036` has Oilers lines plus confirmed goalie in CCC text; quoted source contains full line groups.
- NHL retweet-style item: mirrored timeline shows CCC retweeted `ChrisHabs360` with Canadiens lines, meaning ingestion may encounter useful NHL lines without a CCC wrapper.
- AHL quote wrapper reject candidate: `https://x.com/CcCMiddleton/status/2023120720633720954` has AHL Phantoms lines and goalie.
- AHL quote wrapper reject candidate: `https://x.com/CcCMiddleton/status/2025352934272499846` has AHL Monsters lines and goalie.
- ECHL direct structured reject candidate: `https://x.com/CcCMiddleton/status/2047446876992205035` has ECHL Americans lines directly in CCC text.
- AHL quote wrapper reject candidate: `https://x.com/CcCMiddleton/status/2047444648239743453` has AHL Islanders lines and goalie.
- Non-lineup/status context: mirrored timeline includes NHL/AHL top performer posts and player-position/trade notes that should not be treated as lineup rows.

### CCC oEmbed vs Browser/Mirror Findings For 1.2

- Per-tweet oEmbed for quote wrappers exposes CCC's wrapper `<p>` only, plus the outbound `t.co` link and CCC's date label. It does not include the browser-rendered quote card body.
- Example: `2047489659752886286` oEmbed text is only `Kings lines https://t.co/p00N0wAF6F`, while the rendered/mirrored quote card contains Zach Dooley's full Kings line rushes.
- Example: `2047489528731246914` oEmbed text is only `Avalanche lines https://t.co/wlomtg1Umm`, while the rendered/mirrored quote card contains full Avalanche line groups and goalie.
- Direct CCC text posts are different: `2028990278749831669` oEmbed includes all Predators lines with `<br>` separators and is directly parseable.
- Direct non-NHL CCC text posts are also fully exposed: `2047446876992205035` oEmbed includes ECHL Americans lines with `<br>` separators, proving NHL filtering must run even when text is structurally parseable.
- Browser-rendered/mirrored quote cards can include quoted author, handle, relative time, and quoted body text. The backend oEmbed path cannot rely on those fields unless it resolves and fetches the quoted status separately.
- Practical ingestion consequence: wrapper text should be treated as source/provenance and team hint text; quoted tweet oEmbed should become the primary parse text when a resolved quoted status exists.

### Known Quote Redirect Verification For 1.3

- `https://t.co/p00N0wAF6F` returns `301 location: https://twitter.com/dooleylak/status/2047489041999020180`.
- Fetching oEmbed for `https://twitter.com/dooleylak/status/2047489041999020180` succeeds and returns author `Zach Dooley`, author URL `https://twitter.com/DooleyLAK`, posted label `April 24, 2026`, and full Kings line rush text with `<br>` separators.
- The quoted oEmbed text includes four forward lines, three defense pairs, and two goalies, so quote resolution is sufficient to recover structured NHL lineup content for this example.
- The terminal request follows the redirect to `twitter.com` and receives a final `403` from the browser page, but the first redirect header is enough to extract the quoted status URL; backend code should not require the final browser page body.

### NHL Acceptance Signals For 1.4

- Primary team-label match: accept when wrapper, quoted text, author metadata, or resolved links contain a canonical NHL team label from `buildTeamDirectory(...)`: `team.name`, `team.abbreviation`, `team.shortName`, `team.location`, or the combined location + short name.
- Hashtag/account-label match: accept when text contains clear NHL labels such as `#GoHabsGo`, `#SJSharks`, `#LAKings`, `#LetsGoOilers`, or `@LAKings`, provided the label maps to one NHL team and is not contradicted by a non-NHL league marker.
- Explicit source-handle match: add a small curated handle alias map for official/team-adjacent NHL accounts that appear in CCC examples, such as `@LAKings -> LAK`, `@EdmontonOilers -> EDM`, `@CanadiensMTL -> MTL`, `@mnwildPR -> MIN`, `@WpgJetsPR -> WPG`, and similar known NHL club/PR accounts. This map should live near CCC ingestion config, not inside generic GDT parsing.
- Roster-density match: accept only as a fallback when a candidate has strong roster evidence for exactly one NHL team, such as at least six matched current-roster skaters or one full forward line plus a goalie for the same team. Roster density must not override explicit AHL/ECHL markers.
- Scheduled-game context: when multiple NHL teams are mentioned, prefer teams playing on the requested snapshot date; store one row per resolved NHL team only when the tweet contains separable signals for each team.
- Quoted-content priority: for quote tweets, run team resolution against quoted tweet text first, then use CCC wrapper text as supplemental team-hint/provenance text.
- Ambiguity rule: reject instead of guessing when team labels collide, when only a generic short name could refer to NHL and non-NHL teams, or when roster hits are split across multiple teams without clear structure.

### Non-NHL Rejection Signals For 1.5

- Explicit league prefix: reject when CCC wrapper or quoted text starts with or clearly contains `AHL`, `ECHL`, `OHL`, `WHL`, `QMJHL`, `NCAA`, `college`, `international`, `Olympic`, or similar non-NHL competition markers near `lines`, `lineup`, or `Starting Goalie`.
- Minor-league team-name prefix: reject patterns like `AHL Phantoms lines`, `AHL Monsters lines`, `AHL Islanders lines`, `ECHL Americans lines`, `ECHL Knight Monsters lines`, and similar `{league} {team} lines` wrappers even if player groups parse cleanly.
- Minor-league source handle: reject when quoted author/source handle is known minor-league or league-specific, such as `@TheHersheyBears`, `@SDGullsAHL`, `@sjbarracuda`, `@TheAHL`, `@InsideAHLHockey`, `@ECHL`, or team handles ending/branding with `AHL`, unless an explicit NHL team signal from the quoted body overrides it with clear NHL content.
- Non-NHL hashtag/domain hints: reject when text or links include non-NHL hashtags or domains such as `#Condorstown`, `#LetsGoGulls`, `#BornInBridgeport`, `#MILhockey`, `FloHockey`, `AHLTV`, or similar minor-league broadcast/team markers.
- Roster mismatch: reject when names do not meet the NHL roster-density threshold for a single NHL team and the text has line-combination structure that appears to belong to a non-NHL club.
- Performer/status posts: reject non-lineup posts such as `AHL Top Performers`, `AHL Goalie Top Performers`, generic player-position notes, and trade notes unless they are intentionally routed to a separate player-status pipeline later.
- Ambiguous short-name collision: reject when a short team name can refer to both NHL and non-NHL contexts and there is no NHL abbreviation, official NHL handle, scheduled-game context, or roster-density support.
- Audit metadata: each rejection should preserve `nhl_filter_status`, `nhl_filter_reason`, detected league/team hints, and the text source that triggered rejection.

### Rejected Row Storage Decision For 1.6

- Persist rejected non-NHL and ambiguous candidates into `lines_ccc` as audit rows during the initial rollout.
- Use `status = 'rejected'` and a specific `nhl_filter_status` such as `rejected_non_nhl` or `rejected_ambiguous`.
- Keep enough provenance to debug/tune filters: wrapper tweet URL/id, quoted tweet URL/id when present, source/author handle, raw/enriched text, detected league/team hints, and rejection reason.
- Query consumers must filter to `status = 'observed'` and `nhl_filter_status = 'accepted'` when they only want usable NHL lineup history.

### Schema Contract Updates For 1.7

- `team_id`, `team_abbreviation`, and `team_name` should be nullable because rejected non-NHL/ambiguous audit rows may not map to an NHL team. Add a check constraint requiring those fields when `status = 'observed'` and `nhl_filter_status = 'accepted'`.
- Keep both wrapper and quoted tweet provenance as first-class columns:
  - `tweet_id`, `tweet_url`, `source_handle`, `author_name` for the CCC wrapper or direct/retweet source row.
  - `quoted_tweet_id`, `quoted_tweet_url`, `quoted_author_handle`, `quoted_author_name` for quote-tweet expansion.
- Add `primary_text_source` with values like `wrapper_oembed`, `quoted_oembed`, `retweet_oembed`, or `manual_fixture` so row consumers know which text was parsed.
- Keep `raw_text`/`enriched_text` for wrapper/direct text and `quoted_raw_text`/`quoted_enriched_text` for quote text. Store the actual parsed text source in metadata as `primaryText`.
- Keep `classification` as a top-level column because it is useful for filtering lineup, practice-line, goalie-start, injury, and other rows.
- Keep `detected_league`, `nhl_filter_status`, and `nhl_filter_reason` as top-level columns because rejected rows are intentionally persisted.
- Keep structured line/pair/goalie/scratch/injury columns aligned with `lines_gdl`; use `raw_payload` and `metadata` for power-play units and lower-confidence transaction/status details.
- Add unique indexes on `(tweet_id, team_id)` and `(quoted_tweet_id, team_id)` only for accepted NHL rows where `team_id IS NOT NULL`. Add separate indexes on `tweet_id`, `quoted_tweet_id`, `status`, and `nhl_filter_status` for audit/debug queries.
- Final migration should start from the PRD's provisional SQL but apply the nullable team fields, accepted-row check constraint, `primary_text_source`, and rejection-audit indexes above.

## Tasks

- [x] 1.0 Analyze CCC source shape and finalize ingestion contract
  - [x] 1.1 Capture representative CCC examples covering direct tweets, quote tweets, repost-style items if discoverable, NHL teams, and non-NHL leagues.
  - [x] 1.2 Document what CCC wrapper tweet oEmbed exposes versus what browser-rendered quote cards expose.
  - [x] 1.3 Verify the known quote tweet `https://x.com/CcCMiddleton/status/2047489659752886286` resolves its `t.co` link to the quoted status URL.
  - [x] 1.4 Define NHL acceptance signals using team directory labels, NHL abbreviations, known handles, and roster match density.
  - [x] 1.5 Define non-NHL rejection signals for AHL, ECHL, junior, college, international, and ambiguous content.
  - [x] 1.6 Finalize whether rejected non-NHL tweets are persisted as `status = 'rejected'` audit rows or only reported in route metadata.
  - [x] 1.7 Update the provisional `lines_ccc` schema if the source analysis shows additional required fields or unnecessary fields.

- [x] 2.0 Add the local X/Twitter source catalog page
  - [x] 2.1 Create `web/pages/twitterEmbeds/index.tsx`.
  - [x] 2.2 Add a small local source config for `CcCMiddleton` with handle, URL, and label.
  - [x] 2.3 Render the `CcCMiddleton` timeline anchor and `platform.x.com/widgets.js` script.
  - [x] 2.4 Structure the page/config so future handles or specific tweet URLs can be added without changing parser code.

- [x] 3.0 Extract shared tweet/oEmbed parsing helpers without breaking GDT
  - [x] 3.1 Move reusable oEmbed HTML parsing into a shared helper that preserves `<br>` line breaks and extracts posted labels/source links.
  - [x] 3.2 Keep `fetchGameDayTweetOEmbedData(...)` behavior compatible by wrapping or reusing the shared helper.
  - [x] 3.3 Expose reusable classification, keyword-hit, structured-group, roster-name, initials, alias, and ordered-roster-hit helpers where appropriate.
  - [x] 3.4 Add helper support for extracting tweet ids and normalizing `x.com`/`twitter.com` status URLs.
  - [x] 3.5 Add helper support for expanding outbound `t.co` links and detecting quoted status URLs.
  - [x] 3.6 Add tests for oEmbed `<br>` preservation, posted-label parsing, classification, aliases, initials, and structured extraction.
  - [x] 3.7 Run existing GDT tests and fix only compatibility regressions caused by helper extraction.

- [x] 4.0 Implement CCC parsing, quote resolution, and NHL-only filtering
  - [x] 4.1 Create `web/lib/sources/linesCccIngestion.ts`.
  - [x] 4.2 Define CCC source types for wrapper tweet, quoted tweet, resolved links, parse text source, source handle, author, and posted metadata.
  - [x] 4.3 Implement per-tweet oEmbed fetch for CCC wrapper tweets.
  - [x] 4.4 Implement quote-tweet resolution by expanding `t.co` links and fetching oEmbed for resolved quoted statuses.
  - [x] 4.5 Prefer quoted tweet text as primary parse text when CCC wrapper text is incomplete.
  - [x] 4.6 Reject quote candidates when quoted content cannot be resolved and wrapper text is insufficient.
  - [x] 4.7 Implement NHL team resolution using team labels, abbreviations, handle hints, and roster match density.
  - [x] 4.8 Implement non-NHL and ambiguous-content rejection with auditable filter reasons.
  - [x] 4.9 Parse lineup, practice-line, power-play, goalie-start, injury, return, and transaction signals into structured payloads where confidence is sufficient.
  - [x] 4.10 Preserve raw wrapper text, enriched wrapper text, quoted raw/enriched text, resolved URLs, keyword hits, structure signals, matched names, unmatched names, and filter metadata.

- [x] 5.0 Create the `lines_ccc` SQL migration and row shaping
  - [x] 5.1 Create `web/sql/ratings/007_create_lines_ccc.sql` using the finalized schema from task 1.7.
  - [x] 5.2 Mirror `lines_gdl` ordered line, pair, goalie, scratch, injury, raw payload, and metadata storage philosophy.
  - [x] 5.3 Add first-class quote provenance fields such as quoted tweet id/url and quoted author fields if confirmed by analysis.
  - [x] 5.4 Add NHL filter fields such as detected league, filter status, and filter reason if confirmed by analysis.a          
  - [x] 5.5 Add indexes for `capture_key`, snapshot date/team, game/team, tweet URL, tweet id/team, and quoted tweet id/team where applicable.
  - [x] 5.6 Implement `lines_ccc` row shaping with stable dedupe keys and honest `tweet_posted_at` precision.
  - [x] 5.7 Add tests for row shaping, player id arrays, quote provenance, raw/enriched text fields, metadata, and dedupe keys.

- [x] 6.0 Add the admin polling ingestion route
  - [x] 6.1 Create `web/pages/api/v1/db/update-lines-ccc.ts` behind the existing admin middleware/audit pattern.
  - [x] 6.2 Load current season, teams, scheduled games, and roster entries using existing repo patterns.
  - [x] 6.3 Poll configured CCC sources and resolve concrete tweet URLs where available.
  - [x] 6.4 Parse and filter candidates through the CCC ingestion module before row shaping.
  - [x] 6.5 Upsert accepted rows into `public.lines_ccc` on `capture_key`.
  - [x] 6.6 Handle rejected/ambiguous/non-NHL candidates according to task 1.6.
  - [x] 6.7 Return route summary counts for sources processed, tweets discovered, tweets parsed, quote tweets resolved, non-NHL rejected, duplicates skipped, and rows upserted.
  - [x] 6.8 Add mocked route-level coverage for dedupe/upsert behavior and failure handling.

- [x] 7.0 Verify end-to-end behavior and regressions
  - [x] 7.1 Run focused tests for shared tweet helpers and CCC ingestion.
  - [x] 7.2 Run existing `lineupSourceIngestion.test.ts` to confirm `lines_gdl` behavior still passes.
  - [x] 7.3 Validate the SQL migration syntax against the project’s normal database workflow.
  - [x] 7.4 Manually exercise the admin route with mocked or controlled inputs and confirm summary counts are honest.
  - [x] 7.5 Confirm no exact tweet timestamps are fabricated when oEmbed only provides date labels.
  - [x] 7.6 Confirm non-NHL lineup-style fixtures are rejected before observed NHL rows are persisted.

- [ ] 8.0 NEW Verify X timeline widget fallback behavior
  - [ ] 8.1 Recheck `/twitterEmbeds` after the X `429` window clears or from a different browser/network.
  - [x] 8.2 If X timeline embeds remain unreliable, add a visible fallback source catalog list and keep ingestion dependent on backend per-tweet oEmbed instead of widget-rendered timeline content.
  - [ ] 8.3 Test whether manually generated `blockquote.twitter-tweet[data-tweet-id]` embeds for cached tweet IDs avoid timeline-level `429` more reliably than the account timeline widget.
  - [ ] 8.4 Add an internal oEmbed backfill queue policy: only fetch unseen tweet IDs, persist success/failure, retry `429` with exponential backoff, and render cached rows locally.
  - [x] 8.5 Update `/twitterEmbeds` local cards to use GDT-style `blockquote.tweet` markup with status links, then lazy-add `twitter-tweet` only as optional visual enhancement.

- [x] 9.0 NEW Add IFTTT CCC tweet discovery receiver
  - [x] 9.1 Create a raw `lines_ccc_ifttt_events` queue table for webhook payloads, tweet links, tweet ids, labels, and processing status.
  - [x] 9.2 Create `POST /api/v1/sources/ifttt/ccc-tweet` with shared-secret authentication.
  - [x] 9.3 Accept IFTTT Twitter ingredient fields with flexible casing and preserve the full raw payload for audit/debugging.
  - [x] 9.4 Extract tweet ids from `LinkToTweet` and upsert duplicate tweet events safely.
  - [x] 9.5 Return a small success payload that leaves downstream parsing status as `pending`.

- [ ] 10.0 NEW Analyze harvested tweet corpus and refine classifier heuristics
  - [x] 10.1 Pull representative corpora from `lines_ccc_ifttt_events`, `line_source_ifttt_events`, `lines_ccc`, and `line_source_snapshots`, preserving source, parse text, classification, filter status, filter reason, and resolved team metadata.
  - [ ] 10.2 Analyze injury-related tweets to identify recurring keywords, phrasing, and beat-writer patterns that correlate with true injury/status updates versus false positives.
  - [ ] 10.3 Analyze goalie-start tweets to identify recurring confirmation language, full-name patterns, team/hashtag support patterns, and short-text edge cases that should influence acceptance confidence.
  - [ ] 10.4 Review line-combination tweets to refine regex coverage for forward lines, defense pairs, initials, separators, caveat text, multiline layouts, and quote-wrapper variants.
  - [ ] 10.5 Audit rejected and ambiguous tweets to identify repeat subcategories such as multi-team roundup, transaction-only note, non-NHL lineup, unresolved quote wrapper, insufficient-text goalie update, or unsupported injury shorthand.
  - [ ] 10.6 Decide whether any ambiguous/rejected subcategories deserve new explicit classifications, filter reasons, or separate downstream pipelines rather than remaining in one generic ambiguous bucket.
  - [ ] 10.7 Convert corpus findings into updated keyword maps, regexes, alias/handle hints, and regression fixtures/tests for CCC + GDL ingestion.

- [ ] 11.0 NEW Build tweet-by-tweet manual pattern-review workflow
  - [x] 11.1 Create a persistent review-queue table for manual tweet classification, custom categories/subcategories, and evidence highlights.
  - [x] 11.2 Sync tweets from `lines_ccc`, `line_source_snapshots`, `lines_ccc_ifttt_events`, and `line_source_ifttt_events` into one deduped review queue without losing source attribution.
  - [x] 11.3 Create an admin review API that loads pending/reviewed/ignored queue items and saves manual category/subcategory/evidence decisions.
  - [x] 11.4 Create a `/db/tweet-pattern-review` page inspired by the player-alias flow, with one-tweet-at-a-time review, custom category inputs, and evidence highlighting.
  - [ ] 11.5 Verify the new queue/API/page locally and confirm the sync output is usable for corpus analysis.
  - [ ] 11.6 Add follow-on export/summary helpers so reviewed tweets can directly drive keyword-array edits, regex refinements, and ambiguous-bucket reporting.
  - [x] 11.7 Support multiple assignments per tweet, including player-linked injuries and mixed tweet classifications such as goalie start + injury + line combination.

- [ ] 12.0 NEW Build distilled news-feed funnel from reviewed tweet updates
  - [x] 12.1 Create a reusable funnel schema for draft/published news cards, multi-player assignments, and manual keyword phrases.
  - [x] 12.2 Add admin save/load APIs for news cards and manual keyword phrases tied to reviewed tweets.
  - [x] 12.3 Add a news-card composer beneath the tweet-pattern-review workflow with player assignment, team assignment, category/subcategory, blurb writing, preview, and publish flow.
  - [x] 12.4 Create a branded `/news` page that renders published cards in a dense desktop/mobile feed.
  - [x] 12.5 Expose the funnel through reusable helpers so other pages can consume latest player/team flags.
  - [x] 12.6 Wire the first consumer into the line-combinations landing page so players can show news-derived status pills.
  - [ ] 12.7 Extend distilled news flags into additional site surfaces such as team line pages, homepage status modules, and player pages.
