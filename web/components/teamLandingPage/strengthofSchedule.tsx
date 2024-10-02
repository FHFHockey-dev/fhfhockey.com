// components/teamLandingPage/StrengthOfSchedule.tsx

import React from "react";
import Image from "next/image";
import { teamsInfo } from "./utils/teamsInfo";

interface SoSRanking {
  team: string;
  sos: number;
}

interface StrengthOfScheduleProps {
  type: "past" | "future";
  rankings: SoSRanking[];
}

const StrengthOfSchedule: React.FC<StrengthOfScheduleProps> = ({
  type,
  rankings,
}) => {
  return (
    <div>
      <div className={`sos-table ${type}`}>
        <table className="sosTableClass">
          <thead>
            <tr>
              <th>Team</th>
              <th>SoS</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map(({ team, sos }) => (
              <tr key={team}>
                <td
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <Image
                    src={`https://assets.nhle.com/logos/nhl/svg/${getTeamAbbreviation(
                      team
                    )}_dark.svg`}
                    alt={`${team} Logo`}
                    width={30}
                    height={30}
                  />
                  <span style={{ marginLeft: "8px" }}>{team}</span>
                </td>
                <td className="sosDataCell" style={{ textAlign: "center" }}>
                  {(sos * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Utility function to map team names to abbreviations
const getTeamAbbreviation = (teamName: string): string => {
  const teamEntry = Object.values(teamsInfo).find(
    (team) => team.name.toLowerCase() === teamName.toLowerCase()
  );
  return teamEntry ? teamEntry.abbrev : "";
};

export default StrengthOfSchedule;
