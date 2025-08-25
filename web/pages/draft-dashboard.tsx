// pages/draft-dashboard.tsx

import React from "react";
import dynamic from "next/dynamic";

// Load DraftDashboard client-side to avoid SSR issues with window/localStorage
const DraftDashboard = dynamic(
  () => import("../components/DraftDashboard/DraftDashboard"),
  { ssr: false }
);

export default function DraftDashboardPage() {
  return <DraftDashboard />;
}
