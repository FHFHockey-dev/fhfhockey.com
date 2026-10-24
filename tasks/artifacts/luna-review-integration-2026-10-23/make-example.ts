import { writeFileSync } from "node:fs";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { prepareTweetReviewPacket } from "../../../web/lib/sources/tweetReviewSidecar";
import { extractDurableTweetClaims, TWEET_CLAIM_EXTRACTION_VERSION } from "../../../web/lib/sources/tweetClaimExtraction";
const f = qualifiedFixture();
f.source.rawPayload = { text: f.source.rawText };
const packet = prepareTweetReviewPacket({ source: f.source, claims: extractDurableTweetClaims({ source: f.source, game: f.game, interpretedAt: f.asOf }),
  receipt: { id: "synthetic-receipt", eventTable: "line_source_ifttt_events", eventId: "synthetic-event", receivedAt: f.source.observedAt,
    inputRow: { tweet_id: f.source.tweetId, text: f.source.rawText, tweet_created_at: f.source.tweetPostedAt,
      link_to_tweet: f.source.sourceUrl, raw_payload: f.source.rawPayload } } });
writeFileSync("../tasks/artifacts/luna-review-integration-2026-10-23/EXAMPLE-PACKET.json", JSON.stringify({ packet,
  extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION, statements: [], decisions: true }, null, 2) + "\n", { flag: "wx" });
