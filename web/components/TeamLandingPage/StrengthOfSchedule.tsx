// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\TeamLandingPage\StrengthOfSchedule.tsx

import React from "react";
import Image from "next/legacy/image";
import {
  formatSosAsOfDate,
  SOS_HEADLINE,
  type CanonicalSosRanking,
} from "lib/trends/strengthOfSchedule";

interface StrengthOfScheduleProps {
  type: "past" | "future";
  rankings: CanonicalSosRanking[];
  /** snapshot_date of the served descriptive-sos-v2 rows. */
  asOf?: string | null;
}

const StrengthOfSchedule: React.FC<StrengthOfScheduleProps> = ({
  type,
  rankings,
  asOf = null,
}) => {
  const asOfLabel = formatSosAsOfDate(asOf);
  return (
    <div>
      <div className={`sos-table ${type}`}>
        <table className="sosTableClass">
          <caption title={SOS_HEADLINE.asOfNote}>
            {asOfLabel
              ? `Opponents' records as of ${asOfLabel}`
              : "Opponents' records as of the latest snapshot"}
          </caption>
          <thead>
            <tr>
              <th>Team</th>
              <th
                title={`Mean over fixtures of ${SOS_HEADLINE.shortLabel}: ${SOS_HEADLINE.definition} ${type === "past" ? "Past counts final games only. " : ""}${SOS_HEADLINE.asOfNote} descriptive-sos-v2.`}
              >
                SoS ({SOS_HEADLINE.shortLabel})
              </th>
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
                  {sos === null ? "—" : `${(sos * 100).toFixed(1)}%`}
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
