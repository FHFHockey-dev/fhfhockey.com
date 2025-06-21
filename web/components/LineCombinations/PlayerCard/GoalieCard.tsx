import React from "react";
import Link from "next/link";
import CategoryTitle from "../CategoryTitle";
import ClientOnly from "components/ClientOnly";
import { GoalieStats } from "pages/lines/[abbreviation]";
import { useTeamColor } from "contexts/TeamColorContext";

import styles from "./PlayerCard.module.scss";
import classNames from "classnames";

const UP_ARROW = "/pictures/arrow-up-green.png";
const DOWN_ARROW = "/pictures/arrow-down-red.png";

const SEASON_STATS_CONFIG = [
  { key: "Record", label: "RECORD" },
  { key: "GP", label: "GP" },
  {
    key: "SVPercentage",
    label: "SV%",
    format: (item: number) =>
      item === 0 ? item.toFixed(3) : item.toFixed(3).slice(1)
  },
  { key: "GAA", label: "GAA", format: (item: number) => item.toFixed(2) }
] as const;

const LAST10_GP_STATS_CONFIG = [
  { key: "Record", label: "RECORD" },
  { key: "SV", label: "SV" },
  {
    key: "SVPercentage",
    label: "SV%",
    format: (item: number) =>
      item === 0 ? item.toFixed(3) : item.toFixed(3).slice(1)
  },
  { key: "GAA", label: "GAA", format: (item: number) => item.toFixed(2) }
] as const;

export type LineChange = "promotion" | "demotion" | "static";

function GoalieCard({
  playerName,
  sweaterNumber,
  lineChange,
  ...rest
}: GoalieStats) {
  const names = playerName.split(" ");

  const color = useTeamColor();

  return (
    <article
      className={classNames(styles.container, styles.goalie)}
      style={{
        backgroundColor: color.primary
      }}
    >
      <div className={styles.top}>
        <h3 className={styles.names}>
          <span className={styles.firstName} style={{ color: color.secondary }}>
            {names[0]}
          </span>
          <Link href={`/stats/player/${rest.playerId}`}>
            <span className={styles.lastName}>
              {names.slice(1).join(" ")}
              {lineChange !== "static" && (
                <img
                  src={lineChange === "promotion" ? UP_ARROW : DOWN_ARROW}
                  alt={lineChange}
                  style={{
                    width: 12,
                    height: 12,
                    objectFit: "contain"
                  }}
                />
              )}
            </span>
          </Link>
        </h3>

        <div className={styles.sweaterNumber}>
          <span style={{ color: color.secondary }}>#</span>
          <span
            className={styles.number}
            style={{
              color: color.jersey,
              textShadow: `-1px 0 ${color.secondary}, 0 1px ${color.secondary}, 1px 0 ${color.secondary}, 0 -1px ${color.secondary}`
            }}
          >
            {sweaterNumber}
          </span>
        </div>
      </div>
      <CategoryTitle type="small">LAST 10 GP</CategoryTitle>
      <ClientOnly>
        <section className={styles.stats}>
          {LAST10_GP_STATS_CONFIG.map((stat) => (
            <div key={stat.key} className={styles.stat}>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.value} style={{ color: color.secondary }}>
                {"format" in stat
                  ? stat.format(rest.last10Games[stat.key] || 0)
                  : rest.last10Games[stat.key] || 0}
              </div>
            </div>
          ))}
        </section>
      </ClientOnly>
      <CategoryTitle type="small">SEASON</CategoryTitle>
      <ClientOnly>
        <section className={styles.stats}>
          {SEASON_STATS_CONFIG.map((stat) => (
            <div key={stat.key} className={styles.stat}>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.value} style={{ color: color.secondary }}>
                {"format" in stat
                  ? stat.format(rest.season[stat.key] || 0)
                  : rest.season[stat.key] || 0}
              </div>
            </div>
          ))}
        </section>
      </ClientOnly>
    </article>
  );
}

export default GoalieCard;
