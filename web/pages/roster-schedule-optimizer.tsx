import Head from "next/head";
import dynamic from "next/dynamic";

import Container from "components/Layout/Container";
import RsoLoading from "components/RosterScheduleOptimizer/RsoLoading";

const RosterScheduleOptimizer = dynamic(() => import("components/RosterScheduleOptimizer"), {
  ssr: false,
  loading: RsoLoading,
});

export default function RosterScheduleOptimizerPage() {
  return (
    <>
      <Head>
        <title>NHL Roster Schedule Optimizer | FHFH</title>
        <meta
          name="description"
          content="Plan legal fantasy hockey roster moves across your matchup with a game-level itinerary and lineup comparison."
        />
      </Head>
      <Container contentVariant="full">
        <RosterScheduleOptimizer />
      </Container>
    </>
  );
}
