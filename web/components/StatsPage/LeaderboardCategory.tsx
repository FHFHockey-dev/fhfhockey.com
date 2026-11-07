// /components/StatsPage/LeaderboardCategory.tsx

import React from "react";
import Link from "next/link";
import styles from "styles/Stats.module.scss";
import { SkaterStat } from "lib/NHL/statsPageTypes";
import Segment, { PART_COLORS } from "./Segment";
import LeaderboardHeadshot from "./LeaderboardHeadshot";

interface LeaderboardCategoryProps {
  title: string;
  leaders?: SkaterStat[]; // make it optional
  statKey: keyof SkaterStat;
}

const LeaderboardCategory: React.FC<LeaderboardCategoryProps> = ({
  title,
  leaders = [], // default to an empty array
  statKey
}) => {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {leaders.map((player, index) => {
        let bar: JSX.Element | null = null;
        if (title === "Points" && player.points > 0) {
          const goalsFlex = player.goals;
          const assistTotal = player.points - player.goals;
          const primaryFlex =
            assistTotal > 0 ? player.total_primary_assists : 0;
          const secondaryFlex =
            assistTotal > 0 ? player.total_secondary_assists : 0;
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={goalsFlex}
                color={PART_COLORS[0]}
                label="G"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={primaryFlex}
                color={PART_COLORS[1]}
                label="A1"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={secondaryFlex}
                color={PART_COLORS[2]}
                label="A2"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        } else if (title === "Goals" && player.goals > 0) {
          const total = player.goals;
          const ppg = player.pp_goals;
          const shg = player.sh_goals;
          const esg = total - ppg - shg;
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={esg}
                color={PART_COLORS[0]}
                label="ESG"
                isFirst={true}
                isLast={false}
              />
              <Segment
                flexValue={ppg}
                color={PART_COLORS[1]}
                label="PPG"
                isFirst={false}
                isLast={false}
              />
              <Segment
                flexValue={shg}
                color={PART_COLORS[2]}
                label="SHG"
                isFirst={false}
                isLast={true}
              />
            </div>
          );
        } else if (
          (title === "Power Play Points" || title === "PPP") &&
          player.pp_points > 0
        ) {
          const totalPPP = player.pp_points;
          const pppGoals = player.pp_goals;
          const remainingAssists = totalPPP - pppGoals;
          const primaryAssists = player.pp_primary_assists || 0;
          const secondaryAssists = player.pp_secondary_assists || 0;
          bar = (
            <div className={styles.angledBarContainer}>
              <Segment
                flexValue={pppGoals}
                color={PART_COLORS[0]}
                label="G"
                isFirst={true}
                isLast={false}
              />
              {remainingAssists > 0 && (
                <>
                  <Segment
                    flexValue={primaryAssists}
                    color={PART_COLORS[1]}
                    label="A1"
                    isFirst={false}
                    isLast={false}
                  />
                  <Segment
                    flexValue={secondaryAssists}
                    color={PART_COLORS[2]}
                    label="A2"
                    isFirst={false}
                    isLast={true}
                  />
                </>
              )}
            </div>
          );
        }
        const rowClasses =
          index === 0
            ? `${styles.leaderRow} ${styles.leaderRowExpanded}`
            : styles.leaderRow;
        return (
          <div key={player.player_id} className={rowClasses}>
            <div className={styles.cardContainer}>
              <div className={styles.cardLeft}>
                <Link href={`/stats/player/${player.player_id}`}>
                  <LeaderboardHeadshot
                    imageUrl={player.image_url}
                    playerId={player.player_id}
                    playerName={player.fullName}
                    className={styles.playerHeadshot}
                  />
                </Link>
              </div>
              <div className={styles.cardRight}>
                <div className={styles.topRow}>
                  <div className={styles.leaderMain}>
                    <div className={styles.nameValueRow}>
                      <div className={styles.leaderNameDetails}>
                        <div className={styles.leaderName}>
                          {player.fullName}
                        </div>
                        <div className={styles.playerDetails}>
                          {player.current_team_abbreviation} &middot; #
                          {player.sweater_number} &middot; {player.position}
                        </div>
                      </div>
                      <div className={styles.leaderValue}>
                        {player[statKey]}
                      </div>
                    </div>
                  </div>
                  {bar && <div className={styles.leaderBar}>{bar}</div>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LeaderboardCategory;
