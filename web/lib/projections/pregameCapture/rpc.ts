/** Thin, typed wrappers over the custody RPCs (migration 20261115000000). One instance per role: writer and verifier. */

export type ClaimOutcome = "claimed" | "duplicate" | "binding_mismatch" | "late_start" | "insufficient_time";
export interface ClaimArgs {
  gameId: number; policyId: string; slateDate: string; homeTeamId: number; awayTeamId: number;
  calendarRevision: string; scheduledStart: string; requiredMs: number; codeVersion: string;
}
export interface ClaimRow { outcome: ClaimOutcome; claimId: string | null; ackDeadline: string | null; dbNow: string; inputCutoff: string | null }
export interface SaveRow { rawSha256: string; byteLength: number; dbNow: string }
export interface SettleRow { state: "present" | "fenced"; dbNow: string }
export interface ReadRow {
  claimId: string; gameId: number; policyId: string; slateDate: string; homeTeamId: number; awayTeamId: number;
  calendarRevision: string; scheduledStart: string; inputCutoff: string; ackDeadline: string; codeVersion: string;
  artifactPresent: boolean; saveFenced: boolean; packetBase64: string | null; rawSha256: string | null; storedRawSha256: string | null;
  canonicalSha256: string | null; byteLength: number | null; rowVersion: string | null; artifactInsertedAt: string | null;
  currentStart: string | null;
  /** "ABBR:game_status:schedule_status" per team row. */
  teamGameStatuses: string[]; teamGameFetchedAt: string | null;
  witnessVerdict: "qualified" | "saved_without_valid_witness" | null; witnessStatementText: string | null; witnessTokenBase64: string | null;
  outcome: TerminalOutcome | null; dbReadAt: string;
}
export interface LookupRow {
  claimId: string | null; artifactPresent: boolean; saveFenced: boolean;
  witnessVerdict: ReadRow["witnessVerdict"]; outcome: TerminalOutcome | null; dbNow: string;
}
export type TerminalOutcome = "never_dispatched" | "source_failed" | "save_unknown" | "saved_without_valid_witness" | "qualified";
export interface WitnessArgs {
  claimId: string;
  /** The exact canonical text the RFC 3161 imprint covers; the database recomputes its digest. */
  statementText: string;
  tsaTokenBase64: string; tsaGenTime: string; tsaAccuracyMicros: bigint; tsaResolutionMicros: bigint; tsaAccuracySource: "token" | "pinned_policy";
  tsaSignerSha256: string; ackUpper: string; dbReadAt: string;
  /** Database clock of the verifier's final committed readback (after the stamp); required for a qualified witness. */
  finalReadAt: string | null;
  verdict: "qualified" | "saved_without_valid_witness"; verdictReason: string | null;
}
export interface SweepRow { claimId: string; gameId: number; policyId: string; outcome: TerminalOutcome }

export interface CaptureRpc {
  claim(args: ClaimArgs): Promise<ClaimRow>;
  save(claimId: string, packetBase64: string, rawSha256: string, canonicalSha256: string, signal: AbortSignal): Promise<SaveRow>;
  settle(claimId: string): Promise<SettleRow>;
  read(claimId: string): Promise<ReadRow | null>;
  lookup(gameId: number, policyId: string): Promise<LookupRow>;
  recordWitness(args: WitnessArgs): Promise<string>;
  recordOutcome(gameId: number, policyId: string, claimId: string | null, outcome: TerminalOutcome, metadata: Record<string, unknown>): Promise<string>;
  sweep(graceSeconds: number, limit: number): Promise<SweepRow[]>;
}

/** Database refusals that prove nothing was stored by that call. */
export const DEFINITIVE_SAVE_REFUSALS = ["capture_save_late", "capture_raw_hash_mismatch", "capture_save_fenced", "capture_claim_missing"] as const;

type Client = { rpc(name: string, params: Record<string, unknown>, options?: { get?: boolean }): any };
async function rows(query: PromiseLike<{ data: any; error: any }>): Promise<any[]> {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(String(error.message ?? error)), { code: error.code, details: error.details });
  return Array.isArray(data) ? data : data === null || data === undefined ? [] : [data];
}
const one = async (query: PromiseLike<{ data: any; error: any }>) => (await rows(query))[0];

export function supabaseCaptureRpc(client: Client): CaptureRpc {
  return {
    async claim(a) {
      const row = await one(client.rpc("forge_pregame_capture_claim_v1", {
        p_game_id: a.gameId, p_policy_id: a.policyId, p_slate_date: a.slateDate, p_home_team_id: a.homeTeamId,
        p_away_team_id: a.awayTeamId, p_calendar_revision: a.calendarRevision, p_scheduled_start: a.scheduledStart,
        p_required_ms: a.requiredMs, p_code_version: a.codeVersion,
      }));
      return { outcome: row.outcome, claimId: row.claim_id, ackDeadline: row.ack_deadline, dbNow: row.db_now, inputCutoff: row.input_cutoff };
    },
    async save(claimId, packetBase64, rawSha256, canonicalSha256, signal) {
      const row = await one(client.rpc("forge_pregame_capture_save_v1", {
        p_claim_id: claimId, p_packet_base64: packetBase64, p_raw_sha256: rawSha256, p_canonical_sha256: canonicalSha256,
      }).abortSignal(signal));
      return { rawSha256: row.raw_sha256, byteLength: row.byte_length, dbNow: row.db_now };
    },
    async settle(claimId) {
      const row = await one(client.rpc("forge_pregame_capture_settle_v1", { p_claim_id: claimId }));
      return { state: row.state, dbNow: row.db_now };
    },
    async read(claimId) {
      const row = await one(client.rpc("forge_pregame_capture_read_v1", { p_claim_id: claimId }));
      if (!row) return null;
      return {
        claimId: row.claim_id, gameId: Number(row.game_id), policyId: row.policy_id, slateDate: row.slate_date,
        homeTeamId: row.home_team_id, awayTeamId: row.away_team_id, calendarRevision: row.calendar_revision,
        scheduledStart: row.scheduled_start, inputCutoff: row.input_cutoff, ackDeadline: row.ack_deadline, codeVersion: row.code_version,
        artifactPresent: row.artifact_present, saveFenced: row.save_fenced, packetBase64: row.packet_base64, rawSha256: row.raw_sha256,
        storedRawSha256: row.stored_raw_sha256, canonicalSha256: row.canonical_sha256, byteLength: row.byte_length,
        rowVersion: row.row_version, artifactInsertedAt: row.artifact_inserted_at, currentStart: row.current_start,
        teamGameStatuses: row.team_game_statuses ?? [], teamGameFetchedAt: row.team_game_fetched_at,
        witnessVerdict: row.witness_verdict, witnessStatementText: row.witness_statement_text, witnessTokenBase64: row.witness_token_base64,
        outcome: row.outcome, dbReadAt: row.db_read_at,
      };
    },
    async lookup(gameId, policyId) {
      const row = await one(client.rpc("forge_pregame_capture_lookup_v1", { p_game_id: gameId, p_policy_id: policyId }));
      return { claimId: row?.claim_id ?? null, artifactPresent: Boolean(row?.artifact_present), saveFenced: Boolean(row?.save_fenced),
        witnessVerdict: row?.witness_verdict ?? null, outcome: row?.outcome ?? null, dbNow: row?.db_now };
    },
    async recordWitness(w) {
      return one(client.rpc("forge_pregame_capture_record_witness_v1", {
        p_claim_id: w.claimId, p_statement_text: w.statementText, p_tsa_token_base64: w.tsaTokenBase64, p_tsa_gen_time: w.tsaGenTime,
        p_tsa_accuracy_us: w.tsaAccuracyMicros.toString(), p_tsa_resolution_us: w.tsaResolutionMicros.toString(), p_tsa_accuracy_source: w.tsaAccuracySource, p_tsa_signer_sha256: w.tsaSignerSha256,
        p_ack_upper: w.ackUpper, p_db_read_at: w.dbReadAt, p_final_read_at: w.finalReadAt, p_verdict: w.verdict, p_verdict_reason: w.verdictReason,
      }));
    },
    async recordOutcome(gameId, policyId, claimId, outcome, metadata) {
      return one(client.rpc("forge_pregame_capture_record_outcome_v1", {
        p_game_id: gameId, p_policy_id: policyId, p_claim_id: claimId, p_outcome: outcome, p_metadata: metadata,
      }));
    },
    async sweep(graceSeconds, limit) {
      const result = await rows(client.rpc("forge_pregame_capture_sweep_v1", { p_grace_seconds: graceSeconds, p_limit: limit }));
      return result.map((row) => ({ claimId: row.claim_id, gameId: Number(row.game_id), policyId: row.policy_id, outcome: row.outcome }));
    },
  };
}
