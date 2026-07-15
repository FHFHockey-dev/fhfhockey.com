import Head from "next/head";

import ClientOnly from "components/ClientOnly";
import CommunityRankingsPage from "components/DraftRanker/CommunityRankingsPage";
import Container from "components/Layout/Container";

export default function CommunityDraftRankingsRoute() {
  return (
    <>
      <Head>
        <title>FHFH Community NHL Draft Rankings</title>
        <meta
          name="description"
          content="Anonymous, evidence-labeled NHL fantasy draft rankings from opted-in FHFH comparisons."
        />
      </Head>
      <Container contentVariant="full">
        <ClientOnly>
          <CommunityRankingsPage />
        </ClientOnly>
      </Container>
    </>
  );
}
