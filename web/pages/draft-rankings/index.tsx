import Head from "next/head";

import ClientOnly from "components/ClientOnly";
import DraftRankerPage from "components/DraftRanker/DraftRankerPage";
import Container from "components/Layout/Container";

export default function DraftRankingsRoute() {
  return (
    <>
      <Head>
        <title>My NHL Draft Rankings | FHFH</title>
        <meta
          name="description"
          content="Build and save your personal top 250 NHL fantasy draft rankings."
        />
      </Head>
      <Container contentVariant="full">
        <ClientOnly>
          <DraftRankerPage />
        </ClientOnly>
      </Container>
    </>
  );
}
