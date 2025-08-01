import React from "react";
import Link from "next/link";
import CategoryTitle from "../CategoryTitle";
import ClientOnly from "components/ClientOnly";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { SkaterStats } from "pages/lines/[abbreviation]";
import { useTeamColor } from "contexts/TeamColorContext";

import styles from "./PlayerCard.module.scss";

const UP_ARROW = "/pictures/arrow-up-green.png";
const DOWN_ARROW = "/pictures/arrow-down-red.png";

// For large devices
const LARGE_STATS_CONFIG = [
  { key: "Goals", label: "GOALS" },
  { key: "Assists", label: "ASSISTS" },
  { key: "PTS", label: "PTS" },
  { key: "PPP", label: "PPP" },
  { key: "Shots", label: "SOG" },
  { key: "Hits", label: "HITS" },
  { key: "Blocks", label: "BLKS" },
  { key: "PlusMinus", label: "+/-" }
] as const;

// For small devices
const SMALL_STATS_CONFIG = [
  { key: "Goals", label: "G" },
  { key: "Assists", label: "A" },
  { key: "PTS", label: "PTS" },
  { key: "PPP", label: "PPP" },
  { key: "Shots", label: "SOG" },
  { key: "Hits", label: "HITS" },
  { key: "Blocks", label: "BLKS" },
  { key: "PlusMinus", label: "+/-" }
] as const;

export type LineChange = "promotion" | "demotion" | "static";

function SkaterCard({
  playerName,
  sweaterNumber,
  lineChange,
  ...rest
}: SkaterStats) {
  const names = playerName.split(" ");
  const size = useScreenSize();
  const CONFIG =
    size.screen === BreakPoint.l ? LARGE_STATS_CONFIG : SMALL_STATS_CONFIG;

  const color = useTeamColor();

  return (
    <article
      className={styles.container}
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
          {CONFIG.map((stat) => (
            <div key={stat.key} className={styles.stat}>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.value} style={{ color: color.secondary }}>
                {rest[stat.key] || 0}
              </div>
            </div>
          ))}
        </section>
      </ClientOnly>
    </article>
  );
}

export default SkaterCard;
