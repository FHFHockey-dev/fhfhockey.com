import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, NextPage } from "next";
import Head from "next/head";

import styles from "styles/ForgeDashboard.module.scss";
import TeamPowerCard from "components/forge-dashboard/TeamPowerCard";
import SustainabilityCard from "components/forge-dashboard/SustainabilityCard";
import HotColdCard from "components/forge-dashboard/HotColdCard";
import GoalieRiskCard from "components/forge-dashboard/GoalieRiskCard";
import SlateStripCard from "components/forge-dashboard/SlateStripCard";
import TopMoversCard from "components/forge-dashboard/TopMoversCard";
import { teamsInfo } from "lib/teamsInfo";

const ForgeDashboardPage: NextPage = () => {
  const todayEt = useMemo(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);

    const y = parts.find((part) => part.type === "year")?.value ?? "1970";
    const m = parts.find((part) => part.type === "month")?.value ?? "01";
    const d = parts.find((part) => part.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayEt);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState<"all" | "f" | "d" | "g">("all");
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const expansionTextRef = useRef<HTMLSpanElement | null>(null);
  const [moduleResolvedDates, setModuleResolvedDates] = useState<{
    teamPower: string | null;
    sustainability: string | null;
    goalie: string | null;
    slate: string | null;
  }>({
    teamPower: null,
    sustainability: null,
    goalie: null,
    slate: null
  });
  const teamOptions = useMemo(
    () =>
      Object.values(teamsInfo)
        .map((team) => team.abbrev)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    []
  );
  const driftWarnings = useMemo(() => {
    const labels: Record<keyof typeof moduleResolvedDates, string> = {
      teamPower: "Team Power",
      sustainability: "Sustainability",
      goalie: "Goalie Risk",
      slate: "Slate Strip"
    };

    return Object.entries(moduleResolvedDates)
      .filter(([, resolvedDate]) => Boolean(resolvedDate && resolvedDate !== selectedDate))
      .map(([moduleKey, resolvedDate]) => ({
        module: labels[moduleKey as keyof typeof moduleResolvedDates],
        resolvedDate: resolvedDate as string
      }));
  }, [moduleResolvedDates, selectedDate]);

  useEffect(() => {
    const updateExpansionScale = () => {
      const titleEl = titleRef.current;
      const expansionEl = expansionTextRef.current;
      if (!titleEl || !expansionEl) return;

      expansionEl.style.setProperty("--forge-expansion-scale", "1");
      const titleWidth = titleEl.getBoundingClientRect().width;
      const textWidth = expansionEl.scrollWidth;
      if (!titleWidth || !textWidth) return;

      const scale = Math.max(0.7, Math.min(1.3, titleWidth / textWidth));
      expansionEl.style.setProperty("--forge-expansion-scale", scale.toFixed(4));
    };

    updateExpansionScale();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateExpansionScale())
        : null;

    if (titleRef.current && resizeObserver) {
      resizeObserver.observe(titleRef.current);
    }

    window.addEventListener("resize", updateExpansionScale);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateExpansionScale);
    };
  }, []);

  const updateModuleResolvedDate = (
    moduleKey: keyof typeof moduleResolvedDates,
    resolvedDate: string | null
  ) => {
    setModuleResolvedDates((current) => {
      if (current[moduleKey] === resolvedDate) return current;
      return {
        ...current,
        [moduleKey]: resolvedDate
      };
    });
  };

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
  };

  const handleTeamChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(event.target.value);
  };

  const handlePositionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "all" || value === "f" || value === "d" || value === "g") {
      setSelectedPosition(value);
    }
  };

  return (
    <>
      <Head>
        <title>Forge Dashboard | FHFHockey</title>
        <meta
          name="description"
          content="Single-screen fantasy hockey command center for team power, sustainability, streaks, and goalie decisions."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.headerTopline}>
              <div className={styles.titleBlock}>
                <h1 ref={titleRef} className={styles.title}>FORGE DASHBOARD</h1>
                <p className={styles.titleExpansion}>
                  <span ref={expansionTextRef} className={styles.titleExpansionText}>
                    Forecasting &amp; Outcome Reconciliation Game Engine
                  </span>
                </p>
              </div>
              <p className={styles.subtitle}>
                Daily fantasy hockey command center.
              </p>
            </div>
          </header>

          <section className={styles.controlsRow}>
            <section className={styles.filterBar} aria-label="Global dashboard filters">
              <label className={styles.filterItem}>
                <span>Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className={styles.filterInput}
                />
              </label>

              <label className={styles.filterItem}>
                <span>Team</span>
                <select
                  value={selectedTeam}
                  onChange={handleTeamChange}
                  className={styles.filterInput}
                >
                  <option value="all">All Teams</option>
                  {teamOptions.map((abbr) => (
                    <option key={abbr} value={abbr}>
                      {abbr}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.filterItem}>
                <span>Position</span>
                <select
                  value={selectedPosition}
                  onChange={handlePositionChange}
                  className={styles.filterInput}
                >
                  <option value="all">All Positions</option>
                  <option value="f">Forwards</option>
                  <option value="d">Defense</option>
                  <option value="g">Goalies</option>
                </select>
              </label>
            </section>

            <nav className={styles.quickLinks} aria-label="Forge dashboard quick links">
              <a href="/FORGE" className={styles.quickLink}>
                Open Legacy FORGE
              </a>
              <a href="/trends" className={styles.quickLink}>
                Open Trends Dashboard
              </a>
            </nav>
          </section>

          {driftWarnings.length > 0 && (
            <section className={styles.driftBanner} aria-live="polite">
              <strong>Data date mismatch:</strong>{" "}
              {driftWarnings
                .map((entry) => `${entry.module} using ${entry.resolvedDate}`)
                .join(" • ")}
            </section>
          )}

          <section className={styles.slateRailPanel}>
            <SlateStripCard
              date={selectedDate}
              team={selectedTeam}
              onResolvedDate={(resolvedDate) =>
                updateModuleResolvedDate("slate", resolvedDate)
              }
            />
          </section>

          <section className={styles.dashboardGrid} aria-label="Forge dashboard">
            <div className={`${styles.panel} ${styles.teamPowerPanel}`}>
              <TeamPowerCard
                date={selectedDate}
                team={selectedTeam}
                onResolvedDate={(resolvedDate) =>
                  updateModuleResolvedDate("teamPower", resolvedDate)
                }
              />
            </div>
            <div className={`${styles.panel} ${styles.sustainabilityPanel}`}>
              <SustainabilityCard
                date={selectedDate}
                position={selectedPosition}
                onResolvedDate={(resolvedDate) =>
                  updateModuleResolvedDate("sustainability", resolvedDate)
                }
              />
            </div>
            <div className={`${styles.panel} ${styles.goaliePanel}`}>
              <GoalieRiskCard
                date={selectedDate}
                team={selectedTeam}
                onResolvedDate={(resolvedDate) =>
                  updateModuleResolvedDate("goalie", resolvedDate)
                }
              />
            </div>
            <div className={`${styles.panel} ${styles.hotColdPanel}`}>
              <HotColdCard team={selectedTeam} />
            </div>
            <div className={`${styles.panel} ${styles.moversPanel}`}>
              <TopMoversCard position={selectedPosition} />
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default ForgeDashboardPage;
