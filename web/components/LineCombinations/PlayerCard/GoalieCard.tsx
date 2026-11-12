import React from "react";
import Link from "next/link";
import CategoryTitle from "../CategoryTitle";
import ClientOnly from "components/ClientOnly";
import { GoalieStats } from "pages/lines/[abbreviation]";
import { useTeamColor } from "contexts/TeamColorContext";

import styles from "./PlayerCard.module.scss";
import { readableInk } from "./teamInk";
import classNames from "classnames";

const UP_ARROW = "/pictures/arrow-up-green.png";
const DOWN_ARROW = "/pictures/arrow-down-red.png";

const formatSavePct = (value: number) =>
  value >= 1 ? value.toFixed(3) : value.toFixed(3).slice(1);

const SEASON_STATS_CONFIG = [
  { key: "Record", label: "RECORD", title: "Credited W-L-OTL" },
  { key: "GP", label: "GP" },
  { key: "SVPercentage", label: "SV%", format: formatSavePct },
  { key: "GAA", label: "GAA", format: (item: number) => item.toFixed(2) }
] as const;

const LAST10_GP_STATS_CONFIG = [
  { key: "Record", label: "RECORD", title: "Credited W-L-OTL" },
  { key: "SV", label: "SV" },
  { key: "SVPercentage", label: "SV%", format: formatSavePct },
  { key: "GAA", label: "GAA", format: (item: number) => item.toFixed(2) }
] as const;

/** Unknown stays unknown: a missing value shows a dash, never 0. */
function displayStat(
  stat: object,
  value: string | number | null | undefined
) {
  if (value == null) return "—";
  if (typeof value === "number" && "format" in stat) {
    return (stat.format as (item: number) => string)(value);
  }
  return value;
}

export type LineChange = "promotion" | "demotion" | "static";

function GoalieCard({
  playerName,
  sweaterNumber,
  lineChange,
  ...rest
}: GoalieStats) {
  const names = playerName.split(" ");

  const color = useTeamColor();
  // A goalie with no appearances would otherwise show 0-0-0 / .000 / 0.00 as if they were real stats.
  const hasNoAppearances = !rest.season?.GP;
  // Per-team ink that reads on the card fill (WCAG 4.5:1), e.g. EDM orange digits on navy fall back to white.
  const numberInk = readableInk(color.primary, [color.jersey, color.secondary]);
  const accentInk = readableInk(color.primary, [color.secondary, color.jersey]);

  return (
    <article
      className={classNames(styles.container, styles.goalie)}
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
      {hasNoAppearances ? (
        <p className={styles.noStarts}>No appearances yet this season</p>
      ) : (
        <>
          <CategoryTitle type="small">LAST 10 GP</CategoryTitle>
          <ClientOnly>
            <section className={styles.stats}>
              {LAST10_GP_STATS_CONFIG.map((stat) => (
                <div key={stat.key} className={styles.stat}>
                  <div
                    className={styles.label}
                    title={"title" in stat ? stat.title : undefined}
                  >
                    {stat.label}
                  </div>
                  <div className={styles.value} style={{ color: accentInk }}>
                    {displayStat(stat, rest.last10Games?.[stat.key])}
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
                  <div
                    className={styles.label}
                    title={"title" in stat ? stat.title : undefined}
                  >
                    {stat.label}
                  </div>
                  <div className={styles.value} style={{ color: accentInk }}>
                    {displayStat(stat, rest.season?.[stat.key])}
                  </div>
                </div>
              ))}
            </section>
          </ClientOnly>
        </>
      )}
    </article>
  );
}

export default GoalieCard;
