import { reviewWitnessEvidence, type ReadyEvidence } from "./independentVerdict";
import { canonicalJson } from "./packet";
import { POLICY_ID } from "./policy";
import type { TsaTrust } from "./rfc3161";
import { payloadProblem, SIGNED_VERDICT_VERSION, type SignedVerdictPayload } from "./signedVerdict";
import { formatMicros, MICROS_PER_MINUTE, MICROS_PER_MS, parseInstantMicros } from "./time";
import { tsaProfile, trustFromProfile } from "./tsaProfiles";

/**
 * The independent FORGE witness, as run by the Supabase Edge Function forge-witness-verify (bundled from this file;
 * see tasks/artifacts/forge-witness-signed-2026-11-19). Platform-neutral: WebCrypto and fetch only, plus the released
 * verification modules. For each armed game it reads the committed claim, takes the start time and state from the NHL's
 * public schedule (never from the database, which the writer controls), verifies exactly as reviewWitnessEvidence does
 * with its own clock as "now", and records a verdict signed with its Ed25519 key (an Edge secret, nowhere else).
 */

declare const __WITNESS_RELEASE__: string | undefined;
const API_SCHEMA = "forge_witness_api";
const NHL_LANDING = (gameId: number) => `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`;
const RPC_MS = 15_000, NHL_MS = 10_000;
/** AbortSignal.timeout where available, else an equivalent (some runtimes and test DOMs lack it). */
const timeoutSignal = (ms: number): AbortSignal => {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

export interface EdgeOptions {
  fetch?: typeof fetch;
  now?: () => number;
  /** Only for local rehearsals; the deployed entry passes nothing, so the released DigiCert pin applies. */
  trust?: TsaTrust;
  release?: string;
}
export interface OfficialGame { startTime: string; gameDate: string; gameState: string; scheduleState: string;
  home: { id: number; abbrev: string }; away: { id: number; abbrev: string } }
type GameResult = { gameId: number; status: string; claimId?: string; verdict?: string; reason?: string | null; verifiedAt?: string };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleWitnessEdgeRequest(req: Request, env: (name: string) => string | undefined,
  options: EdgeOptions = {}): Promise<Response> {
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405);
  if (new URL(req.url).search) return json({ status: "unexpected_parameters" }, 400);
  const release = options.release ?? (typeof __WITNESS_RELEASE__ === "string" ? __WITNESS_RELEASE__ : "");
  const url = env("SUPABASE_URL")?.trim(), serviceKey = env("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const signingKey = env("FORGE_WITNESS_SIGNING_KEY")?.trim();
  if (!/^[0-9a-f]{64}$/.test(release) || !url || !serviceKey || !signingKey) return json({ status: "configuration_invalid" }, 503);
  let signer: { keyId: string; sign(text: string): Promise<string> };
  let trust: TsaTrust;
  try {
    signer = await ed25519Signer(signingKey);
    trust = options.trust ?? trustFromProfile(tsaProfile("digicert-g4-v1"), "capture");
  } catch {
    return json({ status: "configuration_invalid" }, 503);
  }
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const response = await doFetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", redirect: "error", signal: timeoutSignal(RPC_MS),
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json",
        "content-profile": API_SCHEMA, accept: "application/json" },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`rpc_${name}_${response.status}`);
    return response.json();
  };

  let pending: number[];
  try {
    const data = await rpc("signed_pending_v1", {});
    if (!Array.isArray(data)) throw new Error("pending_shape");
    pending = data.filter((id): id is number => Number.isSafeInteger(id) && id > 0);
  } catch {
    return json({ status: "pending_unconfirmed", release, keyId: signer.keyId }, 503);
  }
  const results: GameResult[] = [];
  for (const gameId of pending) results.push(await witnessGame(gameId, { rpc, fetch: doFetch, now, trust, release, signer }));
  const unconfirmed = results.some(r => r.status.endsWith("_unconfirmed"));
  return json({ status: pending.length ? (unconfirmed ? "partially_unconfirmed" : "ok") : "idle", release, keyId: signer.keyId, results },
    unconfirmed ? 503 : 200);
}

async function witnessGame(gameId: number, d: { rpc: (n: string, a: Record<string, unknown>) => Promise<any>; fetch: typeof fetch;
  now: () => number; trust: TsaTrust; release: string; signer: { keyId: string; sign(text: string): Promise<string> } }): Promise<GameResult> {
  let evidence: any;
  try {
    evidence = await d.rpc("signed_evidence_v1", { p_game_id: gameId });
  } catch {
    return { gameId, status: "evidence_unconfirmed" };
  }
  if (!evidence || typeof evidence.status !== "string") return { gameId, status: "evidence_unconfirmed" };
  if (evidence.status !== "ready") return { gameId, status: evidence.status, claimId: evidence.claimId };

  // The official schedule, not the database's: the writer can rewrite games.startTime but not the NHL's API.
  let official: OfficialGame | null;
  try { official = await officialGame(gameId, d.fetch); } catch { official = null; }
  if (!official) return { gameId, status: "official_unavailable", claimId: evidence.claim?.id };

  const verifiedAt = formatMicros(BigInt(d.now()) * MICROS_PER_MS);
  const officialStart = formatMicros(parseInstantMicros(official.startTime));
  const deadline = formatMicros(parseInstantMicros(official.startTime) - BigInt(60) * MICROS_PER_MINUTE);
  let review: ReturnType<typeof reviewWitnessEvidence>;
  try {
    review = reviewWitnessEvidence({ ...(evidence as ReadyEvidence), dbNow: verifiedAt, schedule: {
      gameDate: official.gameDate, startTime: officialStart, homeTeamId: official.home.id, awayTeamId: official.away.id,
      homeAbbrev: official.home.abbrev, awayAbbrev: official.away.abbrev,
      teamStatuses: [official.home, official.away].map(t => `${t.abbrev}:${official!.gameState}:${official!.scheduleState}`),
    } }, gameId, d.trust);
  } catch {
    return { gameId, status: "official_unavailable", claimId: evidence.claim?.id };
  }
  const payload: SignedVerdictPayload = {
    version: SIGNED_VERDICT_VERSION, keyId: d.signer.keyId, claimId: review.claimId, gameId, policyId: POLICY_ID,
    rawSha256: review.rawSha256, canonicalSha256: review.canonicalSha256, tsaTokenSha256: review.tsaTokenSha256,
    statementSha256: review.statementSha256, inputCutoff: formatMicros(parseInstantMicros(review.inputCutoff)),
    verdict: review.verdict, reason: review.reason, verifiedAt, officialStart, deadline, release: d.release,
  };
  if (payloadProblem(payload)) return { gameId, status: "payload_unconfirmed", claimId: review.claimId };
  const text = canonicalJson(payload);
  try {
    const signature = await d.signer.sign(text);
    const stored = await d.rpc("record_signed_v1", { p_payload: text, p_signature: signature });
    if (!stored || typeof stored.created !== "boolean") return { gameId, status: "record_unconfirmed", claimId: review.claimId };
    return { gameId, status: stored.created ? "recorded" : "duplicate", claimId: review.claimId, verdict: review.verdict,
      reason: review.reason, verifiedAt };
  } catch {
    return { gameId, status: "record_unconfirmed", claimId: review.claimId };
  }
}

/** The NHL's public game landing: start, date, state and both teams. Null unless every field is present and sane. */
export async function officialGame(gameId: number, doFetch: typeof fetch = fetch): Promise<OfficialGame | null> {
  const response = await doFetch(NHL_LANDING(gameId), { redirect: "error", signal: timeoutSignal(NHL_MS),
    headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const g = await response.json() as Record<string, any>;
  const team = (t: any) => (t && Number.isSafeInteger(t.id) && typeof t.abbrev === "string" && /^[A-Z]{2,3}$/.test(t.abbrev)
    ? { id: t.id as number, abbrev: t.abbrev as string } : null);
  const home = team(g.homeTeam), away = team(g.awayTeam);
  if (g.id !== gameId || typeof g.startTimeUTC !== "string" || typeof g.gameDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(g.gameDate)
    || typeof g.gameState !== "string" || typeof g.gameScheduleState !== "string" || !home || !away) return null;
  parseInstantMicros(g.startTimeUTC);
  return { startTime: g.startTimeUTC, gameDate: g.gameDate, gameState: g.gameState, scheduleState: g.gameScheduleState, home, away };
}

/** Ed25519 signer from a PKCS#8 private key (base64). The public key (hence keyId) is derived from it; the private key
 * is used only inside WebCrypto and never returned. */
export async function ed25519Signer(pkcs8Base64: string): Promise<{ keyId: string; publicKey: string; sign(text: string): Promise<string> }> {
  const subtle = globalThis.crypto.subtle;
  const der = Uint8Array.from(atob(pkcs8Base64), c => c.charCodeAt(0));
  const exportable = await subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
  const jwk = await subtle.exportKey("jwk", exportable) as JsonWebKey;
  const key = await subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  der.fill(0);
  const x = jwk.x!;
  jwk.d = undefined;
  const raw = Uint8Array.from(atob(x.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (x.length % 4)) % 4)), c => c.charCodeAt(0));
  const keyId = [...new Uint8Array(await subtle.digest("SHA-256", raw))].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  return { keyId, publicKey: x, async sign(text: string) {
    const signature = new Uint8Array(await subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(text)));
    let binary = "";
    for (const byte of signature) binary += String.fromCharCode(byte);
    return btoa(binary);
  } };
}
