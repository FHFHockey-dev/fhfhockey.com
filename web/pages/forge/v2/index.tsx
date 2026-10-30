import ConnectedForecastExplorer from "../../../components/ForgeV2/ConnectedForecastExplorer";
import type { PublicPlayerView } from "../../../lib/forge-v2/contracts";

/** A separate qualified release and explicit authorization are required to change this literal gate. */
export async function getServerSideProps() {
  return { notFound: true as const };
}

export default function ForgeV2Page({ initialView = null, players = [] }: { initialView?: PublicPlayerView | null; players?: Array<{ id: number; name: string }> }) {
  return <ConnectedForecastExplorer initialView={initialView} players={players} />;
}
