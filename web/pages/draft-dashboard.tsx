// pages/draft-dashboard.tsx

import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";
import { mockFlags, type MockFlags } from "lib/mockDraft/flags";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: { flags: mockFlags() }
});

export default function DraftDashboardPage({ flags }: { flags?: MockFlags }) {
  return (
    <>
      <NextSeo
        title="Fantasy Hockey Draft Dashboard | FHFH"
        description="Compare player projections, customize your league scoring, and track your fantasy hockey draft with the Five Hole Fantasy Hockey Draft Dashboard."
      />
      <DraftDashboard mockFlags={flags} />
    </>
  );
}
