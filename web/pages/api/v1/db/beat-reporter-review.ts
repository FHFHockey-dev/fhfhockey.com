import { promises as fs } from "fs";
import path from "path";
import type { NextApiResponse } from "next";

import { normaliseReview, parseReviews, removeReview, renderReviews, upsertReview } from "lib/lines/beatReporterFile";
import { CANDIDATE_CLASSIFICATIONS, rankBeatReporterCandidates, type BeatEvidenceRow } from "lib/lines/beatReporterInference";
import { activeTeamAbbreviations } from "lib/teamsInfo";
import adminOnly from "utils/adminOnlyMiddleware";

/**
 * Beat-reporter review (TJ, 2026-11-07). GET: candidates inferred read-only from line_source_snapshots.
 * POST: records a decision in lib/lines/beatReporters.ts — local development only, the file is committed by hand.
 */
const DATA_FILE = path.join(process.cwd(), "lib", "lines", "beatReporters.ts");
const PAGE_SIZE = 1000;
const MAX_PAGES = 6;
/** One- and two-post accounts are noise for a one-at-a-time review. */
const MIN_POSTS = 3;
const CACHE_MS = 10 * 60 * 1000;
const COLUMNS = [
  "source_handle", "source_url", "tweet_url", "tweet_id", "quoted_tweet_id", "quoted_tweet_url", "quoted_author_handle", "quoted_author_name",
  "author_name", "primary_text_source", "raw_text", "enriched_text", "team_abbreviation", "classification", "snapshot_date",
  "provider:raw_payload->>provider", "fx:raw_payload->fx", "quote:raw_payload->quote", "provenance:metadata->sourceProvenance",
  "ifttt_account:metadata->>iftttSourceAccount"
].join(",");

let cache: { at: number; rows: BeatEvidenceRow[] } | null = null;

async function evidenceRows(supabase: any): Promise<BeatEvidenceRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows: BeatEvidenceRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from("line_source_snapshots")
      .select(COLUMNS)
      .in("classification", CANDIDATE_CLASSIFICATIONS as unknown as string[])
      .order("capture_key", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as BeatEvidenceRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  cache = { at: Date.now(), rows };
  return rows;
}

async function readSource() { return fs.readFile(DATA_FILE, "utf8"); }

export default adminOnly(async (req: any, res: NextApiResponse) => {
  try {
    if (req.method === "GET") {
      const reviews = parseReviews(await readSource());
      const rows = await evidenceRows(req.supabase);
      const candidates = rankBeatReporterCandidates(rows, reviews.map((review) => review.handle), { minPosts: MIN_POSTS });
      return res.status(200).json({
        success: true, candidates, reviews, rowsRead: rows.length,
        teams: [...activeTeamAbbreviations].sort(),
        canWrite: process.env.NODE_ENV === "development"
      });
    }
    if (req.method === "POST") {
      if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({ success: false, message: "Decisions are written to beatReporters.ts on a local dev server only." });
      }
      const body = req.body ?? {};
      const source = await readSource();
      const current = parseReviews(source);
      let next;
      if (body.action === "undo") {
        next = removeReview(current, String(body.handle ?? ""));
      } else {
        const review = normaliseReview(body, new Date().toISOString());
        if (review.teamAbbrevs.some((team) => !activeTeamAbbreviations.has(team))) throw new Error("Unknown team abbreviation.");
        next = upsertReview(current, review);
      }
      await fs.writeFile(DATA_FILE, renderReviews(source, next), "utf8");
      return res.status(200).json({ success: true, reviews: next });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Request failed." });
  }
});
