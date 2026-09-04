// pages/draft-dashboard.tsx

import type { GetServerSideProps } from "next";
import Head from "next/head";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

export default function DraftDashboardPage() {
  return (
    <>
      <Head>
        <title>Draft Dashboard | Five Hole Fantasy Hockey</title>
      </Head>
      <DraftDashboard />
    </>
  );
}
