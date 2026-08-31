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
          content="Find startable NHL fantasy games, bench conflicts, DUST, and lower-conflict roster alternatives."
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
