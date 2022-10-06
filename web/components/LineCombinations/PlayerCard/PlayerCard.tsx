import React from "react";
import Image from "next/image";
import CategoryTitle from "../CategoryTitle";

import styles from "./PlayerCard.module.scss";
import UP_ARROW from "public/pictures/arrow-up-green.png";
import DOWN_ARROW from "public/pictures/arrow-down-red.png";
import ClientOnly from "components/ClientOnly";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import { Player } from "pages/lines/[abbreviation]";

// For large devices
const LARGE_STATS_CONFIG = [
  { key: "Goals", label: "GOALS" },
  { key: "Assists", label: "ASSISTS" },
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

function PlayerCard({ name, jerseyNumber, lineChange, ...stats }: Player) {
  const names = name.split(" ");
  const size = useScreenSize();
  const CONFIG =
    size.screen === BreakPoint.l ? LARGE_STATS_CONFIG : SMALL_STATS_CONFIG;
  return (
    <article className={styles.container}>
      <div className={styles.top}>
        <h3 className={styles.names}>
          <span className={styles.firstName}>{names[0]}</span>
          <span className={styles.lastName}>
            {names.slice(1).join(" ")}
            {lineChange !== "static" && (
              <Image
                src={lineChange === "promotion" ? UP_ARROW : DOWN_ARROW}
                alt={lineChange}
                layout="fixed"
                objectFit="contain"
                width={12}
                height={12}
              />
            )}
          </span>
        </h3>
        <div className={styles.jerseyNumber}>
          {/* TODO: use team theme */}
          <span style={{ color: "#DDCBA4BF" }}>#</span>
          <span className={styles.number}>{jerseyNumber}</span>
        </div>
      </div>
      <CategoryTitle type="small">LAST 10 GP</CategoryTitle>

      <ClientOnly>
        <section className={styles.stats}>
          {CONFIG.map((stat) => (
            <div key={stat.key} className={styles.stat}>
              <div className={styles.label}>{stat.label}</div>
              <div className={styles.value}>{stats[stat.key] || 0}</div>
            </div>
          ))}
        </section>
      </ClientOnly>
    </article>
  );
}

export default PlayerCard;
