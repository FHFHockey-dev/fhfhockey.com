import ForecastExplorer from "./ForecastExplorer";
import type { PublicGameView, PublicPlayerView, ScoringProfile } from "../../lib/forge-v2/contracts";

/** Read-only client; the server release gate remains authoritative. */
export function forecastReadClient(fetcher: typeof fetch = fetch) {
  async function read<T>(operation: string, playerId: number, profile?: ScoringProfile, gameId?: number, cursor?: string): Promise<T> {
    const query = new URLSearchParams({ playerId: String(playerId) });
    if (profile) query.set("weights", JSON.stringify(profile.weights));
    if (gameId) query.set("gameId", String(gameId));
    if (cursor) query.set("cursor", cursor);
    const response = await fetcher(`/api/v2/forge/${operation}?${query}`, { method: "GET", credentials: "same-origin" });
    if (!response.ok) throw new Error(response.status === 404 ? "Forecasts are unavailable for this selection." : "Prepared forecasts could not be loaded.");
    return response.json() as Promise<T>;
  }
  return {
    onSelectPlayer: (playerId: number) => read<PublicPlayerView>("next-ten", playerId),
    onRescore: (playerId: number, profile: ScoringProfile) => read<PublicPlayerView>("score", playerId, profile),
    onLoadHistory: (playerId: number, gameId: number, cursor: string, profile: ScoringProfile) => read<PublicGameView>("history", playerId, profile, gameId, cursor),
  };
}
export default function ConnectedForecastExplorer({ initialView, players }: { initialView: PublicPlayerView | null; players: Array<{ id: number; name: string }> }) {
  return <ForecastExplorer initialView={initialView} players={players} {...forecastReadClient()} />;
}
