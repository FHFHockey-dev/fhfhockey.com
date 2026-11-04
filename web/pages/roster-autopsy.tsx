import Head from "next/head";

import ClientOnly from "components/ClientOnly";
import Container from "components/Layout/Container";
import RosterAutopsy from "components/RosterAutopsy/RosterAutopsy";

export default function RosterAutopsyPage() {
  return <>
    <Head><title>Roster Autopsy | FHFH</title><meta name="description" content="Review your fantasy hockey roster's position coverage and starting slots." /></Head>
    <Container><ClientOnly><RosterAutopsy /></ClientOnly></Container>
  </>;
}
