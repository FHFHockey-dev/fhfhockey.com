import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { loadEnvConfig } from "@next/env";
import { populationAuditCandidates, classifyPopulationProfile, type PopulationIdentity, type PopulationMembership } from "../lib/player-forecasts/populationAudit";
import { readForecastQuery, readForecastScopeRows } from "../lib/player-forecasts/scopeReads";

const usage = "Usage: audit-forecast-population-local.ts --season SEASON_ID --out PRIVATE_NEW_DIRECTORY [--after-profile NHL_ID] [--limit 1..500]";
export function parsePopulationAuditArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!["--season", "--out", "--after-profile", "--limit"].includes(key) || values.has(key)
      || !value || value.startsWith("--")) throw new Error(usage);
    values.set(key, value);
  }
  const season = values.get("--season") ?? "", out = values.get("--out") ?? "";
  const limit = values.get("--limit") ?? "25", after = values.get("--after-profile") ?? "0";
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !out || !/^[1-9]\d*$/.test(limit) || Number(limit) > 500
    || after !== "0" && !/^[1-9]\d{6}$/.test(after)) throw new Error(usage);
  return { seasonId: Number(season), out: resolve(out), limit: Number(limit), afterProfile: Number(after) };
}

type Counts = { databaseReads: number; nhlReads: number; responseBytes: number; rateLimited: boolean };
type SourceReceipt = { url: string; resolvedUrl: string; receivedAt: string; status: number;
  bytes: number; sha256: string; redirect: { status: number; location: string } | null };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Only metadata GETs and the explicit official source scope; never a queue, RPC, function or Vercel request. */
export async function guardedPopulationAuditFetch(args: {
  input: RequestInfo | URL; init?: RequestInit; origin: string; seasonId: number; profileIds: Set<number>;
  deadlineMs: number; transport: typeof fetch; counts: Counts;
  retain: (receipt: SourceReceipt, content: string) => void;
}): Promise<Response> {
  const url = new URL(typeof args.input === "string" || args.input instanceof URL ? args.input : args.input.url);
  const method = (args.init?.method ?? (args.input instanceof Request ? args.input.method : "GET")).toUpperCase();
  const roster = url.pathname.match(/^\/v1\/roster\/([A-Z]{3})\/current$/);
  const profile = url.pathname.match(/^\/v1\/player\/(\d{7})\/landing$/);
  const database = url.origin === args.origin && ["/rest/v1/teams", "/rest/v1/rosters", "/rest/v1/fhfh_player_identities"].includes(url.pathname);
  const nhl = url.origin === "https://api-web.nhle.com" && !url.search && (roster || profile && args.profileIds.has(Number(profile[1])));
  if (method !== "GET" || url.username || url.password || !database && !nhl || nhl && args.counts.rateLimited) {
    throw new Error("Population audit rejected a request outside its read-only scope");
  }
  if (nhl && (new Headers(args.init?.headers).has("Authorization") || new Headers(args.init?.headers).has("apikey"))) {
    throw new Error("Population source request contains private headers");
  }
  return readForecastQuery(Math.min(args.deadlineMs, Date.now() + 8000), async signal => {
    const request = async (target: URL) => {
      if (Date.now() >= args.deadlineMs || database && ++args.counts.databaseReads > 100
        || nhl && ++args.counts.nhlReads > 64 + args.profileIds.size) throw new Error("Population audit request bound exceeded");
      return args.transport(target, { ...args.init, redirect: database ? "error" : "manual",
        signal: args.init?.signal ? AbortSignal.any([signal, args.init.signal]) : signal });
    };
    let resolved = url, response = await request(url), redirect: SourceReceipt["redirect"] = null;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!roster || !location) throw new Error("Unexpected population source redirect");
      resolved = new URL(location, url);
      if (resolved.origin !== url.origin || resolved.pathname !== `/v1/roster/${roster[1]}/${args.seasonId}`
        || resolved.search || resolved.username || resolved.password) throw new Error("Population source redirect changed team or season");
      redirect = { status: response.status, location: resolved.href };
      await response.body?.cancel();
      response = await request(resolved);
    }
    if (response.status === 429) args.counts.rateLimited = true;
    const content = await response.text(), bytes = Buffer.byteLength(content);
    if (bytes > 2_000_000) throw new Error("Population source response exceeds its bound");
    args.counts.responseBytes += bytes;
    args.retain({ url: url.href, resolvedUrl: resolved.href, receivedAt: new Date().toISOString(), status: response.status,
      bytes, sha256: hash(content), redirect }, content);
    return new Response(content, { status: response.status, statusText: response.statusText, headers: response.headers });
  });
}

let receiptDirectory: string | undefined;
let failureContext: { stage: string; counts: Counts } | undefined;
async function main() {
  if (process.argv.slice(2).join(" ") === "--help") { console.log(usage); return; }
  const options = parsePopulationAuditArgs(process.argv.slice(2));
  const repo = realpathSync(resolve(__dirname, "../..")), parent = realpathSync(resolve(options.out, ".."));
  if (existsSync(options.out) || parent === repo || parent.startsWith(`${repo}${sep}`)) {
    throw new Error("Choose a new private receipt directory outside the repository");
  }
  mkdirSync(options.out, { mode: 0o700 });
  receiptDirectory = options.out;
  const save = (name: string, value: unknown) => writeFileSync(resolve(options.out, name), JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
  loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !origin.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1):/.test(origin)) {
    throw new Error("Supabase configuration is unavailable");
  }
  const start = Date.now(), deadlineMs = start + 120_000, transport = globalThis.fetch;
  const counts: Counts = { databaseReads: 0, nhlReads: 0, responseBytes: 0, rateLimited: false };
  failureContext = { stage: "catalog_before", counts };
  const receipts: SourceReceipt[] = [], profileIds = new Set<number>();
  let active = 0;
  const waiters: Array<() => void> = [], pending = new Set<Promise<Response>>();
  globalThis.fetch = (input, init) => {
    const work = (async () => {
      if (active >= 4) await new Promise<void>(resolve => waiters.push(resolve));
      active++;
      try {
        return await guardedPopulationAuditFetch({ input, init, origin, seasonId: options.seasonId, profileIds,
          deadlineMs, transport, counts, retain: (receipt, content) => {
            receipts.push(receipt);
            save(`source-${String(receipts.length).padStart(4, "0")}.json`, { ...receipt, content });
          } });
      } finally { active--; waiters.shift()?.(); }
    })();
    pending.add(work);
    void work.then(() => pending.delete(work), () => pending.delete(work));
    return work;
  };
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(origin, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const fields = "id,nhl_player_id,canonical_name,birth_date,lifecycle_status,verification_status,merged_into_id,current_nhl_team_id,updated_at";
    const readSnapshot = async () => {
      const [identities, memberships] = await Promise.all([
        readForecastScopeRows<PopulationIdentity>({ key: "id", maximum: 5000, deadlineMs,
          build: () => db.from("fhfh_player_identities").select(fields, { count: "exact" })
            .eq("verification_status", "verified").eq("lifecycle_status", "active_nhl").is("merged_into_id", null)
            .not("nhl_player_id", "is", null).order("id") }),
        readForecastScopeRows<PopulationMembership>({ key: row => JSON.stringify([row.playerId, row.teamId, row.created_at]),
          maximum: 15000, deadlineMs, build: () => db.from("rosters").select("playerId,teamId,seasonId,is_current,created_at", { count: "exact" })
            .eq("seasonId", options.seasonId).eq("is_current", true).order("playerId").order("teamId").order("created_at") }),
      ]);
      return { identities, memberships };
    };
    const before = await readSnapshot();
    save("catalog-before.json", before);
    failureContext.stage = "official_rosters";
    const { fetchNhlRosterPreview } = await import("../lib/sources/nhlRosterPreview");
    const { fetchNhlPlayerIdentity } = await import("../lib/sources/nhlProspectIdentity");
    const official = await fetchNhlRosterPreview(options.seasonId, { rosterView: "current" });
    const rosterReceipts = receipts.filter(row => /\/roster\//.test(row.url));
    if (rosterReceipts.length !== 32 || new Set(rosterReceipts.map(row => row.url)).size !== 32
      || rosterReceipts.some(row => row.status !== 200 || !["forwards", "defensemen", "goalies"].every(key => Array.isArray(JSON.parse(readSource(row))[key])))
      || new Set(official.map(row => row.teamId)).size !== 32) throw new Error("Official roster population is incomplete");
    save("official-rosters.json", { checkedAt: new Date().toISOString(), players: official });
    failureContext.stage = "excluded_catalog";
    const omitted = official.filter(row => !before.identities.some(identity => identity.nhl_player_id === row.id)).map(row => row.id);
    const excluded: PopulationIdentity[] = [];
    for (let index = 0; index < omitted.length; index += 100) excluded.push(...await readForecastScopeRows<PopulationIdentity>({
      key: "id", maximum: 500, deadlineMs, build: () => db.from("fhfh_player_identities").select(fields, { count: "exact" })
        .in("nhl_player_id", omitted.slice(index, index + 100)).order("id") }));
    const candidates = populationAuditCandidates({ seasonId: options.seasonId, active: before.identities,
      excluded, memberships: before.memberships, official });
    save("candidates.json", { candidates, excluded });
    const batch = candidates.filter(row => row.nhlId > options.afterProfile).slice(0, options.limit);
    batch.forEach(row => profileIds.add(row.nhlId));
    failureContext.stage = "profile_batch";
    const profiles: Array<{ candidate: typeof candidates[number]; profile: Awaited<ReturnType<typeof fetchNhlPlayerIdentity>> | null }> = [];
    for (let index = 0; index < batch.length && !counts.rateLimited && Date.now() < deadlineMs; index += 4) {
      profiles.push(...await Promise.all(batch.slice(index, index + 4).map(async candidate => {
        try { return { candidate, profile: await fetchNhlPlayerIdentity(candidate.nhlId) }; }
        catch { return { candidate, profile: null }; }
      })));
    }
    const classifications = profiles.map(({ candidate, profile }) => classifyPopulationProfile(candidate, profile));
    save("profiles.json", profiles);
    save("classifications.json", classifications);
    failureContext.stage = "catalog_after";
    const after = await readSnapshot(), catalogStable = JSON.stringify(before) === JSON.stringify(after);
    save("catalog-after.json", after);
    const classifiedCounts: Record<string, number> = {};
    for (const row of classifications) classifiedCounts[row.classification] = (classifiedCounts[row.classification] ?? 0) + 1;
    const firstFailure = profiles.findIndex(row => row.profile === null);
    const last = (firstFailure < 0 ? profiles.at(-1) : profiles[firstFailure - 1])?.candidate.nhlId ?? options.afterProfile;
    const metadataReadFailures = receipts.filter(row => new URL(row.url).origin === origin && row.status >= 400).length;
    const receipt = { policy: "forecast_population_audit_v1", checkedAt: new Date().toISOString(), seasonId: options.seasonId,
      readStatus: catalogStable && !metadataReadFailures && profiles.every(row => row.profile !== null) && !counts.rateLimited ? "complete" : "partial",
      snapshotBasis: "independent_reads_not_atomic", catalogStable, activeCatalog: before.identities.length, officialPlayers: official.length,
      officialTeams: 32, candidates: candidates.length, afterProfile: options.afterProfile, profileLimit: options.limit,
      attemptedProfiles: profiles.length, verifiedProfiles: profiles.filter(row => row.profile !== null).length,
      failedProfiles: profiles.filter(row => row.profile === null).map(row => row.candidate.nhlId),
      unreadProfiles: candidates.length - profiles.filter(row => row.profile !== null).length, classifications: classifiedCounts,
      profileCoverage: candidates.length === profiles.filter(row => row.profile !== null).length ? "complete" : "partial",
      populationStatus: !catalogStable ? "source_drift" : candidates.length ? "requires_review" : "no_detected_disagreements",
      metadataReadFailures,
      nextProfile: candidates.some(row => row.nhlId > last) ? last : null,
      candidateHash: hash(JSON.stringify(candidates)), catalogHash: hash(JSON.stringify(before)),
      sourceManifestHash: hash(JSON.stringify(receipts)), durationMs: Date.now() - start, ...counts,
      writes: 0, vercelRequests: 0, recommendationReadiness: "not_evaluated" };
    save("receipt.json", receipt);
    console.log(JSON.stringify({ receipt: resolve(options.out, "receipt.json"), ...receipt }));
    if (receipt.readStatus !== "complete") process.exitCode = 1;
  } finally {
    await Promise.allSettled([...pending]);
    globalThis.fetch = transport;
    save("source-receipts.json", receipts);
  }
  function readSource(receipt: SourceReceipt): string {
    // Content is private and retained independently; receipt URLs/hashes never contain request credentials.
    const index = receipts.indexOf(receipt) + 1;
    return JSON.parse(readFileSync(resolve(options.out, `source-${String(index).padStart(4, "0")}.json`), "utf8")).content;
  }
}

if (require.main === module) main().catch(() => {
  if (receiptDirectory && !existsSync(resolve(receiptDirectory, "receipt.json"))) {
    writeFileSync(resolve(receiptDirectory, "receipt.json"), JSON.stringify({ status: "failed", ...failureContext, writes: 0, vercelRequests: 0,
      detail: "Source scope, identity or read completeness failed; inspect retained private sources. No repair was attempted." }), { mode: 0o600, flag: "wx" });
  }
  console.error("Population audit failed; inspect the private receipt. No automatic retry or repair ran.");
  process.exitCode = 1;
});
