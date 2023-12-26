// StrengthOfSchedule.js
import React from "react";

const StrengthOfSchedule = ({ type, rankings }) => {
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
                  <img
                    src={`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`}
                    alt={`${team} Logo`}
                    style={{ width: "30px", height: "30px" }}
                  />
                  {team}
                </td>
                <td className="sosDataCell" style={{ textAlign: "center" }}>
                  {sos}
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
