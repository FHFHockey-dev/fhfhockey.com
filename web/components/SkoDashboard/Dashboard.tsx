// components/Dashboard.tsx
import React from "react";
import TopTenList from "./TopTenList";
import PlayerTable from "./PlayerTable";
import LeagueTrends from "./LeagueTrends";

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <div className="top-ten-lists">
        <TopTenList type="most-sustainable" />
        <TopTenList type="least-sustainable" />
      </div>
      <LeagueTrends />
      <PlayerTable />
    </div>
  );
};

export default Dashboard;
