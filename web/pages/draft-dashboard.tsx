// pages/draft-dashboard.tsx

import React from "react";
import { NextPage } from "next";
import Head from "next/head";
import DraftDashboard from "components/DraftDashboard/DraftDashboard";

const DraftDashboardPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Fantasy Hockey Draft Dashboard | FHFHockey</title>
        <meta
          name="description"
          content="Interactive fantasy hockey draft dashboard with real-time projections, VORP calculations, and team management."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <DraftDashboard />
    </>
  );
};

export default DraftDashboardPage;
