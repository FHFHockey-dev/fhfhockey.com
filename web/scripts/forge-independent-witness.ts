/** On the separate verifier host only. Usage and configuration are in operator/independent-witness.md. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { u8 } from "../lib/projections/pregameCapture/der";
import { canonicalJson, decodePacket, sha256Hex } from "../lib/projections/pregameCapture/packet";
import { DEFAULT_CAPTURE_BUDGET, POLICY_ID } from "../lib/projections/pregameCapture/policy";
import { verifyTimeStampToken, type TsaTrust } from "../lib/projections/pregameCapture/rfc3161";
import { MICROS_PER_MINUTE, MICROS_PER_MS, parseInstantMicros as instant } from "../lib/projections/pregameCapture/time";
import { tsaProfile, trustFromProfile } from "../lib/projections/pregameCapture/tsaProfiles";
import { pregameScheduleProblem, WITNESS_STATEMENT_VERSION } from "../lib/projections/pregameCapture/verifier";

interface Evidence {
  challenge: string; claim_id: string; game_id: number; policy_id: string; code_version: string; expected_sha: string;
  slate_date: string; home_team_id: number; away_team_id: number; home_abbrev: string; away_abbrev: string;
  calendar_revision: string; scheduled_start: string; current_start: string; input_cutoff: string; ack_deadline: string;
  artifact_present: boolean; save_fenced: boolean; artifact_inserted_at: string; packet_base64: string;
  raw_sha256: string; stored_raw_sha256: string; canonical_sha256: string; row_version: string; byte_length: number;
  team_game_statuses: string[]; witness_verdict: string; outcome: string; witness_statement_text: string;
  witness_token_base64: string; statement_sha256: string; tsa_token_sha256: string; tsa_signer_sha256: string;
  tsa_gen_time: string; tsa_resolution_us: number; tsa_accuracy_us: number; tsa_accuracy_source: string;
  open_at: string; witness_read_at: string; final_read_at: string; ack_upper: string; db_read_at: string;
}
type Refusal = "packet_invalid" | "packet_binding" | "statement_binding" | "token_invalid" | "timing_invalid";

// Boundary failures are enum codes only. Neither DB errors, packet bytes nor a signer response reach process logs.
export function reviewEvidence(e: Evidence, game: number, sha: string, trust: TsaTrust, nowMs: number): Refusal | null {
  let reason: Refusal = "packet_invalid";
  try {
    const bytes = Buffer.from(e.packet_base64, "base64");
    const { packet, rawSha256, canonicalSha256 } = decodePacket(u8(bytes));
    const b = packet.binding;
    reason = "packet_binding";
    if (!e.artifact_present || e.save_fenced || e.witness_verdict !== "qualified" || e.outcome !== "qualified" ||
        bytes.length !== e.byte_length || rawSha256 !== e.raw_sha256 || rawSha256 !== e.stored_raw_sha256 ||
        canonicalSha256 !== e.canonical_sha256 || b.claimId !== e.claim_id || b.gameId !== game || game !== e.game_id ||
        b.codeVersion !== sha || sha !== e.code_version || sha !== e.expected_sha || b.policyId !== POLICY_ID ||
        b.policyId !== e.policy_id || b.slateDate !== e.slate_date || b.homeTeamId !== e.home_team_id ||
        b.awayTeamId !== e.away_team_id || b.homeAbbrev !== e.home_abbrev || b.awayAbbrev !== e.away_abbrev ||
        b.calendarRevision !== e.calendar_revision || instant(b.scheduledStart) !== instant(e.scheduled_start) ||
        instant(b.inputCutoff) !== instant(e.input_cutoff)) return reason;

    reason = "statement_binding";
    const s = JSON.parse(e.witness_statement_text);
    const digest = sha256Hex(e.witness_statement_text);
    if (canonicalJson(s) !== e.witness_statement_text || digest !== e.statement_sha256 ||
        s.version !== WITNESS_STATEMENT_VERSION || s.gameId !== String(game) || s.claimId !== b.claimId ||
        s.policyId !== b.policyId || s.calendarRevision !== b.calendarRevision || s.rowVersion !== e.row_version ||
        s.rawSha256 !== rawSha256 || s.canonicalSha256 !== canonicalSha256 || s.byteLength !== bytes.length ||
        instant(s.scheduledStart) !== instant(b.scheduledStart) || instant(s.currentStart) !== instant(e.current_start) ||
        instant(s.dbReadAt) !== instant(e.witness_read_at) || typeof s.nonce !== "string" ||
        !/^(0|[1-9][0-9]{0,19})$/.test(s.nonce)) return reason;

    reason = "token_invalid";
    const stamp = verifyTimeStampToken(Buffer.from(e.witness_token_base64, "base64"),
      { sha256Digest: Buffer.from(digest, "hex"), nonce: BigInt(s.nonce) }, trust);
    if (stamp.tokenSha256 !== e.tsa_token_sha256 || stamp.signerSha256 !== e.tsa_signer_sha256 ||
        stamp.genTimeMicros !== instant(e.tsa_gen_time) || stamp.upperMicros !== instant(e.ack_upper) ||
        stamp.accuracyMicros !== BigInt(e.tsa_accuracy_us) || stamp.resolutionMicros !== BigInt(e.tsa_resolution_us) ||
        stamp.accuracySource !== e.tsa_accuracy_source) return reason;

    reason = "timing_invalid";
    const skew = BigInt(DEFAULT_CAPTURE_BUDGET.skewToleranceMs) * MICROS_PER_MS;
    const stampWait = BigInt(DEFAULT_CAPTURE_BUDGET.rpcMs + DEFAULT_CAPTURE_BUDGET.tsaTimeoutMs) * MICROS_PER_MS;
    const read = instant(e.witness_read_at), final = instant(e.final_read_at), independent = instant(e.db_read_at);
    const inserted = instant(e.artifact_inserted_at), cutoff = instant(b.inputCutoff);
    const now = BigInt(nowMs) * MICROS_PER_MS;
    const deadline = instant(e.scheduled_start) - BigInt(60) * MICROS_PER_MINUTE;
    if (pregameScheduleProblem(e.team_game_statuses) || instant(e.current_start) !== instant(e.scheduled_start) ||
        deadline !== instant(e.ack_deadline) || cutoff < instant(e.open_at) || cutoff > inserted || inserted > read ||
        read > final || final > independent || independent > deadline || now > deadline || now + skew < independent ||
        stamp.upperMicros > deadline || read > stamp.upperMicros + skew || read + stampWait + skew < stamp.lowerMicros ||
        final + skew < stamp.lowerMicros ||
        instant(packet.readWindow.start) < cutoff - skew || instant(packet.readWindow.end) > inserted + skew ||
        instant(packet.statedCutoff) < cutoff || instant(packet.statedCutoff) > deadline) return reason;
    return null;
  } catch {
    return reason;
  }
}

export async function runWitnessOnce(client: Client, game: number, sha: string, trust: TsaTrust, now = Date.now) {
  const confirm = async (): Promise<string> => (await client.query(
    "select forge_witness_api.independent_confirm_v1($1,$2) as result", [game, sha])).rows[0].result;
  // A former process may have lost the ACK after committing its check. Confirmation reads metadata only.
  const previous = await confirm();
  if (previous !== "idle") return previous;
  const { rows } = await client.query("select forge_witness_api.independent_read_v1($1,$2) as evidence", [game, sha]);
  const e: Evidence | null = rows[0].evidence;
  if (!e) return "idle";
  const reason = reviewEvidence(e, game, sha, trust, now());
  await client.query("select forge_witness_api.independent_append_v1($1,$2,$3,$4,$5,$6)",
    [e.challenge, reason ? "rejected" : "accepted", reason, e.raw_sha256, e.canonical_sha256, e.tsa_token_sha256]);
  const verdict = await confirm();
  if (verdict === "idle") throw new Error("confirmation_missing");
  return verdict;
}

async function main() {
  const [mode, gameText, sha, ...rest] = process.argv.slice(2);
  const game = Number(gameText);
  if (!["--automated","--named"].includes(mode) || !/^[1-9]\d{0,14}$/.test(gameText) ||
      !Number.isSafeInteger(game) || !/^[0-9a-f]{40}$/.test(sha)) throw new Error("arguments");
  let stopAt = 0;
  if (rest.length) {
    if (mode !== "--automated" || rest.length !== 2 || rest[0] !== "--poll-until") throw new Error("arguments");
    stopAt = Number(instant(rest[1]) / MICROS_PER_MS);
    if (stopAt <= Date.now() || stopAt - Date.now() > 60 * 60_000) throw new Error("poll_window");
  }
  const repo = resolve(__dirname, "../..");
  const git = (...args: string[]) => execFileSync("git", ["-C",repo,...args], { encoding: "utf8", stdio: ["ignore","pipe","ignore"] }).trim();
  if (git("rev-parse","HEAD") !== sha || git("status","--porcelain","--untracked-files=normal","--","web/scripts/forge-independent-witness.ts",
    "web/lib/projections/pregameCapture","web/package-lock.json","web/tsconfig.json")) throw new Error("checkout");
  const required = (name: string) => {
    const value = process.env["FORGE_WITNESS_" + name];
    if (!value) throw new Error("configuration");
    return value;
  };
  const user = required("DB_USER");
  if ((mode === "--automated") !== (user === "forge_independent_verifier") || !/^[a-z][a-z0-9_]{0,62}$/.test(user)) {
    throw new Error("principal");
  }
  const host = required("DB_HOST");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) throw new Error("tls_host");
  const client = new Client({ host, port: 5432, database: required("DB_NAME"), user, password: required("DB_PASSWORD"),
    ssl: { ca: readFileSync(required("DB_CA_FILE"),"utf8"), rejectUnauthorized: true },
    application_name: "forge_independent_witness", connectionTimeoutMillis: 5000, statement_timeout: 15000, query_timeout: 20000 });
  let disconnected = false;
  client.on("error", () => { disconnected = true; });
  try {
    await client.connect();
    const trust = trustFromProfile(tsaProfile("digicert-g4-v1"), "capture");
    let result = await runWitnessOnce(client, game, sha, trust);
    for (let attempt = 1; result === "idle" && attempt < 120 && Date.now() + 30_000 < stopAt; attempt++) {
      await new Promise(resolveWait => setTimeout(resolveWait,30_000));
      if (disconnected) throw new Error("disconnected");
      if (Date.now() >= stopAt) break;
      result = await runWitnessOnce(client, game, sha, trust);
    }
    if (stopAt && result === "idle") result = "witness_unconfirmed";
    process.stdout.write(JSON.stringify({ gameId: game, result }) + "\n");
    if (result === "rejected") process.exitCode = 2;
    if (result === "witness_unconfirmed") process.exitCode = 1;
  } finally { await client.end(); }
}
if (require.main === module) void main().catch(() => {
  process.stderr.write('{"result":"witness_unconfirmed"}\n');
  process.exitCode = 1;
});
