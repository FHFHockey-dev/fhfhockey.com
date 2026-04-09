// pages/draft-dashboard.tsx

import React, { useEffect, useState } from "react";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";

export default function DraftDashboardPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <DraftDashboard />;
}
