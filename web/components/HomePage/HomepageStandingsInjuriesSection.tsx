import { useMemo, useState } from "react";
import moment from "moment";

import PanelStatus from "components/common/PanelStatus";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import OptimizedImage from "components/common/OptimizedImage";
import { fallbackNHLLogo, getTeamLogoSvg } from "lib/images";
import styles from "styles/Home.module.scss";

type HomepageStandingsInjuriesSectionProps = {
  standings: any[];
  injuries: any[];
  snapshotGeneratedAt: string | null;
  standingsError: string | null;
  injuriesError: string | null;
};

const INJURY_ROWS_PER_PAGE = 32;

export default function HomepageStandingsInjuriesSection({
  standings,
  injuries,
  snapshotGeneratedAt,
  standingsError,
  injuriesError
}: HomepageStandingsInjuriesSectionProps) {
  const [injuryPage, setInjuryPage] = useState(0);

  const sortedStandings = useMemo(() => {
    if (!Array.isArray(standings)) return [];

    return [...standings].sort((a, b) => {
      const left = Number.parseInt(a?.leagueSequence, 10) || 0;
      const right = Number.parseInt(b?.leagueSequence, 10) || 0;
      return left - right;
    });
  }, [standings]);

  const currentPageInjuries = useMemo(() => {
    if (!Array.isArray(injuries)) return [];

    return injuries.slice(
      injuryPage * INJURY_ROWS_PER_PAGE,
      (injuryPage + 1) * INJURY_ROWS_PER_PAGE
    );
  }, [injuries, injuryPage]);

  const displayInjuryRows = currentPageInjuries.map((injury, idx) => {
    const teamAbbrev = injury.team?.toUpperCase() ?? "NHL";
    const injuryTeamLogoUrl = getTeamLogoSvg(teamAbbrev);
    const injuryRowClassName =
      injury.statusState === "returning"
        ? styles.returningRow
        : injury.statusState === "injured"
          ? styles.injuredRow
          : "";

    return (
      <tr key={`${injury.player?.id ?? idx}-${idx}`} className={injuryRowClassName}>
        <td className={styles.dateColumn}>
          {injury.date ? moment(injury.date).format("M/D/YY") : "N/A"}
        </td>
        <td className={styles.teamColumn}>
          <OptimizedImage
            className={styles.injuryTeamLogo}
            src={injuryTeamLogoUrl}
            alt={`${injury.team ?? ""} logo`}
            width={25}
            height={25}
            priority={false}
            fallbackSrc={fallbackNHLLogo}
          />
        </td>
        <td className={styles.nameColumn}>{injury.player?.displayName ?? "N/A"}</td>
        <td className={styles.statusColumn}>{injury.status ?? "N/A"}</td>
        <td className={styles.descriptionColumn}>{injury.description ?? "N/A"}</td>
      </tr>
    );
  });
  const standingsPresentation = buildHomepageModulePresentation({
    source: "homepage-standings",
    error: standingsError,
    isEmpty: sortedStandings.length === 0 && !standingsError,
    timestamp: snapshotGeneratedAt,
    maxAgeHours: 18,
    emptyMessage: "Standings are unavailable right now.",
    staleMessage: "Standings may be out of date."
  });
  const injuriesPresentation = buildHomepageModulePresentation({
    source: "homepage-injuries",
    error: injuriesError,
    isEmpty: injuries.length === 0 && !injuriesError,
    timestamp: snapshotGeneratedAt,
    maxAgeHours: 18,
    emptyMessage: "No recent injury updates found.",
    staleMessage: "Injury updates may be out of date."
  });

  return (
    <div className={styles.standingsInjuriesContainer}>
      <div className={styles.standingsContainer}>
        <div className={styles.standingsHeader}>
          <h2>
            Current <span>Standings</span>
          </h2>
        </div>
        {standingsPresentation.panelState && (
          <PanelStatus
            state={standingsPresentation.panelState}
            message={standingsPresentation.message ?? ""}
            className={styles.moduleStatusPanel}
          />
        )}
        <div className={styles.tableWrapper}>
          {sortedStandings.length > 0 ? (
            <table className={styles.standingsTable}>
              <caption className={styles.visuallyHidden}>NHL League Standings</caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Team</th>
                  <th scope="col">Record</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((teamRecord) => (
                  <tr key={teamRecord.teamName}>
                    <th scope="row">{teamRecord.leagueSequence}</th>
                    <td>
                      <OptimizedImage
                        className={styles.standingsTeamLogo}
                        src={teamRecord.teamLogo}
                        alt={`${teamRecord.teamName} logo`}
                        width={25}
                        height={25}
                        priority={false}
                        fallbackSrc={fallbackNHLLogo}
                      />
                      <span className={styles.standingsTeamNameSpan}>
                        {teamRecord.teamName}
                      </span>
                    </td>
                    <td>{`${teamRecord.wins || 0}-${teamRecord.losses || 0}-${teamRecord.otLosses || 0}`}</td>
                    <td>{teamRecord.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      <div className={styles.injuriesContainer}>
        <div className={styles.injuriesHeader}>
          <h2>
            Injury <span>Updates</span>
          </h2>
        </div>
        {injuriesPresentation.panelState && (
          <PanelStatus
            state={injuriesPresentation.panelState}
            message={injuriesPresentation.message ?? ""}
            className={styles.moduleStatusPanel}
          />
        )}
        <div className={styles.tableWrapper}>
          {displayInjuryRows.length > 0 ? (
            <table className={styles.injuryTable} aria-live="polite">
              <caption className={styles.visuallyHidden}>
                Recent NHL Injury Updates
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.dateColumn}>
                    Date
                  </th>
                  <th scope="col" className={styles.teamColumn}>
                    Team
                  </th>
                  <th scope="col" className={styles.nameColumn}>
                    Player
                  </th>
                  <th scope="col" className={styles.statusColumn}>
                    Status
                  </th>
                  <th scope="col" className={styles.descriptionColumn}>
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>{displayInjuryRows}</tbody>
            </table>
          ) : null}
        </div>
        <div className={styles.pagination}>
          <button
            onClick={() => setInjuryPage((prev) => Math.max(prev - 1, 0))}
            disabled={injuryPage === 0}
          >
            Previous
          </button>
          <button
            onClick={() => setInjuryPage((prev) => prev + 1)}
            disabled={
              !Array.isArray(injuries) ||
              injuries.length <= (injuryPage + 1) * INJURY_ROWS_PER_PAGE
            }
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
