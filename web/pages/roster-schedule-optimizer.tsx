import Head from "next/head";

import ClientOnly from "components/ClientOnly";
import Container from "components/Layout/Container";
import RosterScheduleOptimizer from "components/RosterScheduleOptimizer";

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
        <ClientOnly>
          <RosterScheduleOptimizer />
        </ClientOnly>
      </Container>
    </>
  );
}
