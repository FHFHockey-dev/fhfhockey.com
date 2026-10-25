import Head from "next/head";
import type { GetServerSideProps } from "next";
import TestingGroundsOwnerGate from "../../lib/forge-testing-grounds/TestingGroundsOwnerGate";

// The initial frame contains no private props or owner identity. Browser session
// transport is verified by the dedicated server boundary before workspace mount.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return { props: {} };
};

export default function TestingGroundsPage() {
  return <>
    <Head>
      <title>Testing Grounds · FORGE</title>
      <meta name="robots" content="noindex,nofollow" key="robots" />
      <meta name="googlebot" content="noindex,nofollow" key="googlebot" />
    </Head>
    <TestingGroundsOwnerGate />
  </>;
}
