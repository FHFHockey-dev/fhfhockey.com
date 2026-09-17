// pages/draft-dashboard.tsx

import type { GetServerSideProps } from "next";
import Head from "next/head";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";
import { mockFlags, type MockFlags } from "lib/mockDraft/flags";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: { flags: mockFlags() }
});

export default function DraftDashboardPage({ flags }: { flags?: MockFlags }) {
  return (
    <>
      <Head>
        <title>Draft Dashboard | Five Hole Fantasy Hockey</title>
      </Head>
      <DraftDashboard mockFlags={flags} />
    </>
  );
}
