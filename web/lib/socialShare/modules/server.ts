import { SHARE_TIME_ZONE } from "lib/socialShare/types";
import { parseShareSettings, SHARE_POST_DEFAULT_TTL_SECONDS, SHARE_POST_SLUG, SharePostRequestError, UNKNOWN_EVIDENCE, type SharePostReadClient, type SharePostSnapshot } from "./contract";
import { shareModule } from "./registry";

/**
 * One post edition. Runs after the route's auth check; a failed source becomes a "missing" snapshot naming no fixture
 * value, so a post's loader only ever has to describe what it read.
 */
export async function loadPostSnapshot(post: string, query: Record<string, string | undefined>, client: SharePostReadClient, now = () => new Date()): Promise<SharePostSnapshot> {
  const entry = SHARE_POST_SLUG.test(post) ? shareModule(post) : undefined;
  if (!entry) throw new SharePostRequestError("Unknown social-share post.", 404);
  const settings = parseShareSettings(entry, query, "server");
  const generatedAt = now().toISOString();
  const base = { schemaVersion: 1 as const, id: `${post}-${Date.parse(generatedAt).toString(36)}`, post, generatedAt, timeZone: SHARE_TIME_ZONE as typeof SHARE_TIME_ZONE, settings, fixture: false };
  try {
    const load = await entry.load();
    const result = await load({ client, generatedAt }, settings);
    return { ...base, state: result.state, reasons: result.reasons ?? [], evidence: result.evidence, data: result.data, teams: result.teams ?? [],
      expiresAt: new Date(Date.parse(generatedAt) + (result.ttlSeconds ?? SHARE_POST_DEFAULT_TTL_SECONDS) * 1000).toISOString() };
  } catch {
    return { ...base, state: "missing", reasons: [`${entry.title} sources could not be read.`], evidence: UNKNOWN_EVIDENCE, data: null, teams: [], expiresAt: null };
  }
}
