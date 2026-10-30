import { Categories, PublicAccountability, PublicGameView, PublicPlayerView, ScoringProfile, assertId } from "./contracts";
import { DEFAULT_SCORING, scoringProfile } from "./identity";

export type ReadOperation = "players" | "next-ten" | "history" | "score" | "accountability" | "methodology";
export interface ReadRequest { operation: ReadOperation; playerId?: number; gameId?: number; query: string; profile: ScoringProfile; cursor?: string }
export interface Methodology { version: string; publicEnabled: false; qualification: string; categories: string[]; horizons: string; conditioning: string; limitations: string[] }
export interface ForgeReadRepository {
  players(query: string): Promise<Array<{ id: number; name: string }>>;
  player(playerId: number, profile: ScoringProfile): Promise<PublicPlayerView | null>;
  history(playerId: number, gameId: number, profile: ScoringProfile, cursor?: string): Promise<PublicGameView | null>;
  accountability(playerId: number, profile: ScoringProfile): Promise<PublicAccountability | null>;
  methodology(): Promise<Methodology>;
}

export function parseReadRequest(query: Record<string, string | string[] | undefined>): ReadRequest {
  const allowed = new Set(["operation", "playerId", "gameId", "q", "weights", "cursor"]);
  if (Object.keys(query).some(key => !allowed.has(key)) || Object.values(query).some(v => Array.isArray(v))) throw new Error("Invalid query fields");
  const one = (key: string) => query[key] as string | undefined;
  const operation = one("operation") as ReadOperation;
  if (!["players", "next-ten", "history", "score", "accountability", "methodology"].includes(operation)) throw new Error("Unknown operation");
  const id = (key: string, required: boolean): number | undefined => {
    const value = one(key);
    if (value === undefined && !required) return undefined;
    if (!value || !/^[1-9]\d{0,15}$/.test(value)) throw new Error("Invalid identity");
    const result = Number(value); assertId(result); return result;
  };
  const playerId = id("playerId", !["players", "methodology"].includes(operation));
  const gameId = id("gameId", operation === "history");
  const search = one("q") ?? "";
  if (search.length > 80 || /[\u0000-\u001f]/.test(search)) throw new Error("Invalid player filter");
  const cursor = one("cursor");
  if (cursor !== undefined && (!cursor || cursor.length > 24576 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) throw new Error("Invalid history cursor");
  let profile = DEFAULT_SCORING;
  const weights = one("weights");
  if (weights !== undefined) {
    if (weights.length > 1024) throw new Error("Scoring profile too large");
    profile = scoringProfile(JSON.parse(weights) as Categories<number>);
  }
  if (cursor && operation !== "history" || gameId && operation !== "history" || one("q") && operation !== "players" || playerId && ["players", "methodology"].includes(operation)) throw new Error("Query scope mismatch");
  return { operation, ...(playerId === undefined ? {} : { playerId }), ...(gameId === undefined ? {} : { gameId }), query: search.trim(), profile, ...(cursor ? { cursor } : {}) };
}

export async function executeRead(repository: ForgeReadRepository, request: ReadRequest): Promise<unknown> {
  switch (request.operation) {
    case "players": return repository.players(request.query);
    case "next-ten": case "score": return repository.player(request.playerId!, request.profile);
    case "history": return repository.history(request.playerId!, request.gameId!, request.profile, request.cursor);
    case "accountability": return repository.accountability(request.playerId!, request.profile);
    case "methodology": return repository.methodology();
  }
}
