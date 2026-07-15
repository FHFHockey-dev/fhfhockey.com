// pages/draft-dashboard.tsx

import React, { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

export default function DraftDashboardPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <main
        aria-busy="true"
        aria-labelledby="draft-dashboard-loading-title"
        style={{ minHeight: "60vh", padding: "32px 24px" }}
      >
        <h1 id="draft-dashboard-loading-title">Draft Dashboard</h1>
        <p role="status">Loading draft tools and projection data…</p>
      </main>
    );
  }

  return <DraftDashboard />;
}
