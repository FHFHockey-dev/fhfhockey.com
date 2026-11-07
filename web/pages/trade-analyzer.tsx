import Head from "next/head";

import ClientOnly from "components/ClientOnly";
import Container from "components/Layout/Container";
import TradeAnalyzer from "components/TradeAnalyzer/TradeAnalyzer";

export default function TradeAnalyzerPage() {
  return <>
    <Head><title>Trade Analyzer | FHFH</title><meta name="description" content="Review an entered fantasy hockey offer, both rosters and explicit drop consequences." /></Head>
    <Container><ClientOnly><TradeAnalyzer /></ClientOnly></Container>
  </>;
}
