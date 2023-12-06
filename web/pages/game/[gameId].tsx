// @ts-nocheck
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import axios from "axios";

import { teamsInfo } from "lib/NHL/teamsInfo";
import { getBoxscore } from "lib/NHL/server";
import { Boxscore } from "lib/NHL/types";

type Props = {
  game: Boxscore;
};

export default function Page({ game }: Props) {
  const router = useRouter();
  const gameId = router.query.gameId as number;
  const [homeTeamStats, setHomeTeamStats] = useState(null);
  const [awayTeamStats, setAwayTeamStats] = useState(null);
  const [homeTeamRank, setHomeTeamRank] = useState(null);
  const [awayTeamRank, setAwayTeamRank] = useState(null);

  useEffect(() => {
    const fetchTeamStats = async (teamId, setType) => {
      try {
        const response = await axios.get(
          `https://statsapi.web.nhl.com/api/v1/teams/${teamId}?expand=team.stats`
        );
        console.log("Fetched Team Stats:", response.data);
        setType === "home"
          ? setHomeTeamStats(response.data.teams[0].teamStats[0].splits[0].stat)
          : setAwayTeamStats(
              response.data.teams[0].teamStats[0].splits[0].stat
            );
        setType === "home"
          ? setHomeTeamRank(response.data.teams[0].teamStats[0].splits[1].stat)
          : setAwayTeamRank(response.data.teams[0].teamStats[0].splits[1].stat);
      } catch (err) {
        console.error("Team Stats Fetching Error:", err);
      }
    };

    if (game) {
      fetchTeamStats(game.linescore.teams.home.team.id, "home");
      fetchTeamStats(game.linescore.teams.away.team.id, "away");
    }
  }, [game]);

  const homeTeamName = game.linescore.teams.home.team.name;
  const awayTeamName = game.linescore.teams.away.team.name;

  const homeTeamAbbreviation = Object.keys(teamsInfo).find(
    (key) => teamsInfo[key].name === homeTeamName
  );
  const awayTeamAbbreviation = Object.keys(teamsInfo).find(
    (key) => teamsInfo[key].name === awayTeamName
  );

  const homeTeamColors = teamsInfo[homeTeamAbbreviation] || {};
  const awayTeamColors = teamsInfo[awayTeamAbbreviation] || {};

  return (
    <div className="game-page">
      <div
        className="gamePageCard"
        style={{
          "--home-primary-color": homeTeamColors.primaryColor,
          "--home-secondary-color": homeTeamColors.secondaryColor,
          "--home-jersey-color": homeTeamColors.jersey,
          "--home-accent-color": homeTeamColors.accent,
          "--home-alt-color": homeTeamColors.alt,
          "--away-primary-color": awayTeamColors.primaryColor,
          "--away-secondary-color": awayTeamColors.secondaryColor,
          "--away-jersey-color": awayTeamColors.jersey,
          "--away-accent-color": awayTeamColors.accent,
          "--away-alt-color": awayTeamColors.alt,
        }}
      >
        <div className="GPhomeTeamLogo">
          <img
            src={`https://assets.nhle.com/logos/nhl/svg/${homeTeamAbbreviation}_light.svg`}
            className="game-page-left-image"
            alt={`${homeTeamAbbreviation} logo`}
          />
        </div>
        <div className="team-name home-team">{homeTeamName}</div>
        <div className="GPvs">VS</div>
        <div className="team-name away-team">{awayTeamName}</div>
        <div className="GPawayTeamLogo">
          <img
            src={`https://assets.nhle.com/logos/nhl/svg/${awayTeamAbbreviation}_light.svg`}
            className="game-page-right-image"
            alt={`${awayTeamAbbreviation} logo`}
          />
        </div>
      </div>
      {/* More game details can be rendered here */}
      <table className="gamePageVsTable">
        <thead>
          <tr>
            <th className="gamePageHomeTeam" colSpan={2}>
              Home
            </th>
            <th className="gamePageAdvantage">Advantage</th>
            <th className="gamePageAwayTeam" colSpan={2}>
              Away
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="gamePageHomeTeamStat">{homeTeamStats?.wins}</td>
            <td className="gamePageHomeTeamStatRank">{homeTeamRank?.wins}</td>
            {getAdvantage(
              homeTeamStats?.wins,
              awayTeamStats?.wins,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "Wins:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">{awayTeamRank?.wins}</td>
            <td className="gamePageAwayTeamStat">{awayTeamStats?.wins}</td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.goalsPerGame?.toFixed(2)}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.goalsPerGame}
            </td>
            {getAdvantage(
              homeTeamStats?.goalsPerGame,
              awayTeamStats?.goalsPerGame,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "GF/GM:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.goalsPerGame}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.goalsPerGame?.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.goalsAgainstPerGame?.toFixed(2)}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.goalsAgainstPerGame}
            </td>
            {getAdvantage(
              homeTeamStats?.goalsAgainstPerGame,
              awayTeamStats?.goalsAgainstPerGame,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "GA/GM:",
              true
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.goalsAgainstPerGame}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.goalsAgainstPerGame?.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.powerPlayPercentage}%
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.powerPlayPercentage}
            </td>
            {getAdvantage(
              homeTeamStats?.powerPlayPercentage,
              awayTeamStats?.powerPlayPercentage,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "PP%:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.powerPlayPercentage}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.powerPlayPercentage}%
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.penaltyKillPercentage}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.penaltyKillPercentage}
            </td>
            {getAdvantage(
              homeTeamStats?.penaltyKillPercentage,
              awayTeamStats?.penaltyKillPercentage,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "PK%:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.penaltyKillPercentage}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.penaltyKillPercentage}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.shotsPerGame?.toFixed(2)}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.shotsPerGame}
            </td>
            {getAdvantage(
              homeTeamStats?.shotsPerGame,
              awayTeamStats?.shotsPerGame,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "SF/GM:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.shotsPerGame}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.shotsPerGame?.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.shotsAllowed?.toFixed(2)}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.shotsAllowed}
            </td>
            {getAdvantage(
              homeTeamStats?.shotsAllowed,
              awayTeamStats?.shotsAllowed,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "SA/GM:",
              true
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.shotsAllowed}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.shotsAllowed?.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {(
                homeTeamStats?.powerPlayOpportunities /
                homeTeamStats?.gamesPlayed
              ).toFixed(2)}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.powerPlayOpportunities}
            </td>
            {getAdvantage(
              homeTeamStats?.powerPlayOpportunities,
              awayTeamStats?.powerPlayOpportunities,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "PP/GM:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.powerPlayOpportunities}
            </td>
            <td className="gamePageAwayTeamStat">
              {(
                awayTeamStats?.powerPlayOpportunities /
                awayTeamStats?.gamesPlayed
              ).toFixed(2)}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.shootingPctg}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.shootingPctRank}
            </td>
            {getAdvantage(
              homeTeamStats?.shootingPctg,
              awayTeamStats?.shootingPctg,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "S%:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.shootingPctRank}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.shootingPctg}
            </td>
          </tr>
          <tr>
            <td className="gamePageHomeTeamStat">
              {homeTeamStats?.savePctg?.toFixed(3)}
            </td>
            <td className="gamePageHomeTeamStatRank">
              {homeTeamRank?.savePctRank}
            </td>
            {getAdvantage(
              homeTeamStats?.savePctg,
              awayTeamStats?.savePctg,
              homeTeamAbbreviation,
              awayTeamAbbreviation,
              "Sv%:",
              false
            )}
            <td className="gamePageAwayTeamStatRank">
              {awayTeamRank?.savePctRank}
            </td>
            <td className="gamePageAwayTeamStat">
              {awayTeamStats?.savePctg?.toFixed(3)}
            </td>
          </tr>
          {/* More rows for other stats... */}
        </tbody>
      </table>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const gameId = Number(params.gameId);
  const data = await getBoxscore(gameId);
  return {
    props: {
      game: data,
    },
  };
}
