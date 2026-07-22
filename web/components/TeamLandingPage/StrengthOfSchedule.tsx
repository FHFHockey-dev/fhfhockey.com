// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\TeamLandingPage\StrengthOfSchedule.tsx

import React from "react";
import Image from "next/legacy/image";
import type { CanonicalSosRanking } from "lib/trends/strengthOfSchedule";

interface StrengthOfScheduleProps {
  type: "past" | "future";
  rankings: CanonicalSosRanking[];
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
            {rankings.map(({ teamId, team, abbreviation, sos }) => (
              <tr key={teamId}>
                <td
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <Image
                    src={`https://assets.nhle.com/logos/nhl/svg/${abbreviation}_dark.svg`}
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

export default StrengthOfSchedule;
