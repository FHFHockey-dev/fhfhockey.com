import React from "react";
import Link from "next/link";
import ClientOnly from "components/ClientOnly";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { SkaterStats } from "pages/lines/[abbreviation]";
import { useTeamColor } from "contexts/TeamColorContext";

import styles from "./PlayerCard.module.scss";
import { readableInk } from "./teamInk";

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

// For small devices: three-letter labels so four columns fit at 10px on a ~110px card.
const SMALL_STATS_CONFIG = [
  { key: "Goals", label: "G" },
  { key: "Assists", label: "A" },
  { key: "PTS", label: "PTS" },
  { key: "PPP", label: "PPP" },
  { key: "Shots", label: "SOG" },
  { key: "Hits", label: "HIT" },
  { key: "Blocks", label: "BLK" },
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
  // Per-team ink that reads on the card fill (WCAG 4.5:1), e.g. EDM orange digits on navy fall back to white.
  const numberInk = readableInk(color.primary, [color.jersey, color.secondary]);
  const accentInk = readableInk(color.primary, [color.secondary, color.jersey]);

  return (
    <article
      className={styles.container}
      style={{
        backgroundColor: color.primary
      }}
    >
      <div className={styles.top}>
        <p className={styles.names}>
          <span className={styles.firstName} style={{ color: accentInk }}>
            {names[0]}
          </span>
          <Link href={`/stats/player/${rest.playerId}`}>
            <span className={styles.lastName}>
              {names.slice(1).join(" ")}
              {lineChange !== "static" && (
                <img
                  src={lineChange === "promotion" ? UP_ARROW : DOWN_ARROW}
                  alt={lineChange === "promotion" ? "moved up" : "moved down"}
                  style={{
                    width: 12,
                    height: 12,
                    objectFit: "contain"
                  }}
                />
              )}
            </span>
          </Link>
        </p>

        {sweaterNumber ? (
          <div className={styles.sweaterNumber} style={{ color: numberInk }}>
            <span aria-hidden="true">#</span>
            <span className={styles.number}>
              <span className={styles.visuallyHidden}>Number </span>
              {sweaterNumber}
            </span>
          </div>
        ) : null}
      </div>
      <ClientOnly>
        <section className={styles.stats}>
          {CONFIG.map((stat) => (
            <div key={stat.key} className={styles.stat}>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.value} style={{ color: accentInk }}>
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
