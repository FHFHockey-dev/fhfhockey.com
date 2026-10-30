import ForecastExplorer from "../../../components/ForgeV2/ForecastExplorer";

/** A separate qualified release and explicit authorization are required to change this literal gate. */
export async function getServerSideProps() {
  return { notFound: true as const };
}

export default function ForgeV2Page() {
  return <ForecastExplorer initialView={null} players={[]} />;
}
