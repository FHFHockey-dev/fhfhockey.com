import React, { useMemo, useState } from "react";
import Link from "next/link";
import styles from "styles/Stats.module.scss";
import { GoalieStat, SkaterStat } from "lib/NHL/statsPageTypes";

type MobileTabKey = "skaters" | "goalies";

type MobileLeaderRow = {
  id: number;
  name: string;
  href: string;
  context: string;
  value: string | number;
  detail?: string;
};

type MobileLeaderSection = {
  id: string;
  title: string;
  label: string;
  rows: MobileLeaderRow[];
};

type MobileTabInterfaceProps = {
  pointsLeaders: SkaterStat[];
  goalsLeaders: SkaterStat[];
  pppLeaders: SkaterStat[];
  bshLeaders: SkaterStat[];
  goalieLeadersWins: GoalieStat[];
  goalieLeadersSavePct: GoalieStat[];
  goalieLeadersGAA: GoalieStat[];
  goalieLeadersQS: GoalieStat[];
};

const formatDecimal = (value: number | null | undefined, digits: number) =>
  value != null && Number.isFinite(value) ? value.toFixed(digits) : "-";

const formatSavePct = (value: number | null | undefined) => {
  const formatted = formatDecimal(value, 3);
  return formatted === "-" ? "-.---" : formatted.replace(/^0/, "");
};

const formatQualityStarts = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-";

const skaterContext = (player: SkaterStat) =>
  [player.current_team_abbreviation, player.position].filter(Boolean).join(" · ");

const goalieContext = (goalie: GoalieStat) =>
  [goalie.current_team_abbreviation, goalie.sweater_number ? `#${goalie.sweater_number}` : null]
    .filter(Boolean)
    .join(" · ");

function mapSkaterRows(
  leaders: SkaterStat[],
  valueKey: keyof SkaterStat,
  detailBuilder?: (player: SkaterStat) => string
): MobileLeaderRow[] {
  return leaders.slice(0, 5).map((player) => ({
    id: player.player_id,
    name: player.fullName,
    href: `/stats/player/${player.player_id}`,
    context: skaterContext(player),
    value: player[valueKey] as number,
    detail: detailBuilder?.(player)
  }));
}

function mapGoalieRows(
  leaders: GoalieStat[],
  valueBuilder: (goalie: GoalieStat) => string | number,
  detailBuilder?: (goalie: GoalieStat) => string
): MobileLeaderRow[] {
  return leaders.slice(0, 5).map((goalie) => ({
    id: goalie.goalie_id,
    name: goalie.fullName,
    href: `/stats/player/${goalie.goalie_id}`,
    context: goalieContext(goalie),
    value: valueBuilder(goalie),
    detail: detailBuilder?.(goalie)
  }));
}

export default function MobileTabInterface({
  pointsLeaders,
  goalsLeaders,
  pppLeaders,
  bshLeaders,
  goalieLeadersWins,
  goalieLeadersSavePct,
  goalieLeadersGAA,
  goalieLeadersQS
}: MobileTabInterfaceProps) {
  const [activeTab, setActiveTab] = useState<MobileTabKey>("skaters");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "skaters-points": true,
    "goalies-save-pct": true
  });

  const sections = useMemo<Record<MobileTabKey, MobileLeaderSection[]>>(
    () => ({
      skaters: [
        {
          id: "skaters-points",
          title: "Points",
          label: "PTS",
          rows: mapSkaterRows(
            pointsLeaders,
            "points",
            (player) => `${player.goals} G · ${Math.max(player.points - player.goals, 0)} A`
          )
        },
        {
          id: "skaters-goals",
          title: "Goals",
          label: "G",
          rows: mapSkaterRows(
            goalsLeaders,
            "goals",
            (player) => `${player.pp_goals} PPG · ${player.sh_goals} SHG`
          )
        },
        {
          id: "skaters-ppp",
          title: "Power Play",
          label: "PPP",
          rows: mapSkaterRows(
            pppLeaders,
            "pp_points",
            (player) => `${player.pp_goals} G · ${(player.pp_primary_assists ?? 0) + (player.pp_secondary_assists ?? 0)} A`
          )
        },
        {
          id: "skaters-bsh",
          title: "BSH",
          label: "BSH",
          rows: mapSkaterRows(
            bshLeaders,
            "bsh",
            (player) => `${player.blocked_shots} BLK · ${player.shots} SOG · ${player.hits} HIT`
          )
        }
      ],
      goalies: [
        {
          id: "goalies-save-pct",
          title: "Save %",
          label: "SV%",
          rows: mapGoalieRows(
            goalieLeadersSavePct,
            (goalie) => formatSavePct(goalie.save_pct),
            (goalie) => `${goalie.games_played} GP`
          )
        },
        {
          id: "goalies-wins",
          title: "Wins",
          label: "W",
          rows: mapGoalieRows(
            goalieLeadersWins,
            (goalie) => goalie.wins,
            (goalie) => `${goalie.games_played} GP`
          )
        },
        {
          id: "goalies-gaa",
          title: "GAA",
          label: "GAA",
          rows: mapGoalieRows(
            goalieLeadersGAA,
            (goalie) => formatDecimal(goalie.goals_against_avg, 2),
            (goalie) => `${goalie.games_played} GP`
          )
        },
        {
          id: "goalies-quality-starts",
          title: "Quality Starts",
          label: "QS%",
          rows: mapGoalieRows(
            goalieLeadersQS,
            (goalie) => formatQualityStarts(goalie.quality_starts_pct),
            (goalie) => `${goalie.games_played} GP`
          )
        }
      ]
    }),
    [
      bshLeaders,
      goalieLeadersGAA,
      goalieLeadersQS,
      goalieLeadersSavePct,
      goalieLeadersWins,
      goalsLeaders,
      pointsLeaders,
      pppLeaders
    ]
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId]
    }));
  };

  return (
    <section className={styles.mobileLeaderboardSection} aria-label="Mobile leaderboards">
      <div className={styles.mobileTabShell}>
        <div className={styles.mobileTabHeader}>
          <h2 className={styles.mobileCardTitle}>Leaderboards</h2>
          <div className={styles.mobileTabs} role="tablist" aria-label="Leaderboard type">
            {(["skaters", "goalies"] as MobileTabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`mobile-${tab}-panel`}
                className={`${styles.mobileTabButton} ${
                  activeTab === tab ? styles.mobileTabButtonActive : ""
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "skaters" ? "Skaters" : "Goalies"}
              </button>
            ))}
          </div>
        </div>

        <div
          id={`mobile-${activeTab}-panel`}
          role="tabpanel"
          className={styles.mobileTabPanel}
        >
          {sections[activeTab].map((section) => {
            const isExpanded = Boolean(expandedSections[section.id]);
            return (
              <article key={section.id} className={styles.mobileLeaderboardCard}>
                <button
                  type="button"
                  className={styles.mobileSectionToggle}
                  aria-expanded={isExpanded}
                  aria-controls={`${section.id}-rows`}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className={styles.mobileSectionTitle}>{section.title}</span>
                  <span className={styles.mobileCardType}>{section.label}</span>
                </button>
                {isExpanded && section.rows.length > 0 ? (
                  <div id={`${section.id}-rows`} className={styles.mobileLeadersList}>
                    {section.rows.map((row, index) => (
                      <Link
                        key={`${section.id}-${row.id}`}
                        href={row.href}
                        className={styles.mobileLeaderItem}
                      >
                        <span className={styles.mobileLeaderRank}>{index + 1}</span>
                        <span className={styles.mobileLeaderInfo}>
                          <span className={styles.mobileLeaderName}>{row.name}</span>
                          <span className={styles.mobileLeaderTeam}>
                            {row.context || "NHL"}
                            {row.detail ? ` · ${row.detail}` : ""}
                          </span>
                        </span>
                        <span className={styles.mobileLeaderValue}>{row.value}</span>
                      </Link>
                    ))}
                  </div>
                ) : isExpanded ? (
                  <div id={`${section.id}-rows`} className={styles.mobileEmptyState}>
                    No leaders available.
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
