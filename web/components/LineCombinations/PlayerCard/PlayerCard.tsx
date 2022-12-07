import React from "react";
import Link from "next/link";
import CategoryTitle from "../CategoryTitle";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { Player } from "pages/lines/[abbreviation]";
import { useTeamColor } from "contexts/TeamColorContext";

import styles from "./PlayerCard.module.scss";
import useMounted from "utils/useMounted";

const UP_ARROW = "/pictures/arrow-up-green.png";
const DOWN_ARROW = "/pictures/arrow-down-red.png";

// For large devices
const LARGE_STATS_CONFIG = [
  { key: "Goals", label: "GOALS" },
  { key: "Assists", label: "ASSTS" },
  { key: "PTS", label: "PTS" },
  { key: "PPP", label: "PPP" },
  { key: "Shots", label: "SOG" },
  { key: "Hits", label: "HITS" },
  { key: "Blocks", label: "BLKS" },
  { key: "PlusMinus", label: "+/-" },
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
  { key: "PlusMinus", label: "+/-" },
] as const;

export type LineChange = "promotion" | "demotion" | "static";

function PlayerCard({ name, jerseyNumber, lineChange, ...rest }: Player) {
  const names = name.split(" ");
  const size = useScreenSize();
  const CONFIG =
    size.screen === BreakPoint.l ? LARGE_STATS_CONFIG : SMALL_STATS_CONFIG;

  const mounted = useMounted();
  const color = useTeamColor();

  return (
    <article
      className={styles.container}
      style={{
        backgroundColor: color.primary,
      }}
    >
      <div className={styles.top}>
        <h3 className={styles.names}>
          <span className={styles.firstName} style={{ color: color.secondary }}>
            {names[0]}
          </span>
          <Link
            href={{
              pathname: "/charts",
              query: {
                playerId: rest.playerId,
              },
            }}
          >
            <a>
              <span className={styles.lastName}>
                {names.slice(1).join(" ")}
                {lineChange !== "static" && (
                  <img
                    src={lineChange === "promotion" ? UP_ARROW : DOWN_ARROW}
                    alt={lineChange}
                    style={{
                      width: 12,
                      height: 12,
                      objectFit: "contain",
                    }}
                  />
                )}
              </span>
            </a>
          </Link>
        </h3>

        <div className={styles.jerseyNumber}>
          <div className={styles.hash} style={{ color: color.secondary }}>
            #
          </div>
          <span
            className={styles.number}
            style={{
              color: color.jersey,
              textShadow: `-1px 0 ${color.secondary}, 0 1px ${color.secondary}, 1px 0 ${color.secondary}, 0 -1px ${color.secondary}`,
            }}
          >
            {jerseyNumber}
          </span>
        </div>
      </div>
      <CategoryTitle type="small">LAST 10 GP</CategoryTitle>

      <section className={styles.stats}>
        {CONFIG.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <div className={styles.label}>
              {!mounted ? "-" : <>{stat.label}</>}
            </div>
            <div className={styles.value} style={{ color: color.secondary }}>
              {rest[stat.key] || 0}
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}

export default PlayerCard;
