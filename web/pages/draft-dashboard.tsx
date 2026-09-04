// pages/draft-dashboard.tsx

import type { GetServerSideProps } from "next";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

export default function DraftDashboardPage() {
  return <DraftDashboard />;
}
