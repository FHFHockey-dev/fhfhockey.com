// pages/xGoalsPage.tsx

import React from "react";
import XGoals from "../components/HeatMap/xGoals";

const xGoalsPage: React.FC = () => {
  return (
    <div>
      <h1>League-Wide xGoals Heatmap</h1>
      <XGoals />
    </div>
  );
};

export default xGoalsPage;
