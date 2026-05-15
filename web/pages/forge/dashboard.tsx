import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";

import styles from "styles/ForgeDashboard.module.scss";
import ForgeRouteNav from "components/forge-dashboard/ForgeRouteNav";
import TeamPowerCard from "components/forge-dashboard/TeamPowerCard";
import SustainabilityCard from "components/forge-dashboard/SustainabilityCard";
import HotColdCard from "components/forge-dashboard/HotColdCard";
import GoalieRiskCard from "components/forge-dashboard/GoalieRiskCard";
import SlateStripCard from "components/forge-dashboard/SlateStripCard";
import TopAddsRail from "components/forge-dashboard/TopAddsRail";
import {
  buildForgeHref,
  parseForgeDateParam,
  parseForgePositionParam,
  parseForgeTeamParam
} from "lib/dashboard/forgeLinks";
import { teamsInfo } from "lib/teamsInfo";

const ForgeDashboardPage: NextPage = () => {
  const router = useRouter();
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
  const [selectedPosition, setSelectedPosition] = useState<
    "all" | "f" | "d" | "g"
  >("all");
  const [insightOwnershipMin, setInsightOwnershipMin] = useState(25);
  const [insightOwnershipMax, setInsightOwnershipMax] = useState(50);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const expansionTextRef = useRef<HTMLSpanElement | null>(null);
  const teamOptions = useMemo(
    () =>
      Object.values(teamsInfo)
        .map((team) => team.abbrev)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    []
  );
  const requestedDate = useMemo(
    () => parseForgeDateParam(router.query.date, todayEt),
    [router.query.date, todayEt]
  );
  const requestedTeam = useMemo(
    () => parseForgeTeamParam(router.query.team),
    [router.query.team]
  );
  const requestedPosition = useMemo(
    () => parseForgePositionParam(router.query.position),
    [router.query.position]
  );
  const normalizedRequestedTeam = useMemo(() => {
    if (requestedTeam === "ALL") return "all";
    if (requestedTeam && teamOptions.includes(requestedTeam)) return requestedTeam;
    return null;
  }, [requestedTeam, teamOptions]);
  const requestedTeamForState = normalizedRequestedTeam ?? "all";
  const requestedPositionForState = requestedPosition ?? "all";
  const formattedDateContext = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    if (!year || !month || !day) return selectedDate;

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  }, [selectedDate]);
  const selectedPositionLabel = useMemo(() => {
    if (selectedPosition === "f") return "Forwards";
    if (selectedPosition === "d") return "Defense";
    if (selectedPosition === "g") return "Goalies";
    return "All Positions";
  }, [selectedPosition]);
  const hasCustomFilters =
    selectedDate !== todayEt ||
    selectedTeam !== "all" ||
    selectedPosition !== "all";
  const teamDetailHref =
    selectedTeam === "all" ? "/trends" : `/forge/team/${selectedTeam}`;
  const dashboardReturnHref = useMemo(
    () =>
      buildForgeHref("/forge/dashboard", {
        date: selectedDate,
        team: selectedTeam,
        position: selectedPosition
      }),
    [selectedDate, selectedPosition, selectedTeam]
  );
  useEffect(() => {
    if (!router.isReady) return;
    setSelectedDate((current) => (current === requestedDate ? current : requestedDate));
    setSelectedTeam((current) =>
      normalizedRequestedTeam && current !== normalizedRequestedTeam
        ? normalizedRequestedTeam
        : current
    );
    setSelectedPosition((current) =>
      requestedPosition && current !== requestedPosition ? requestedPosition : current
    );
  }, [normalizedRequestedTeam, requestedDate, requestedPosition, router.isReady]);

  const routeStateApplied =
    selectedDate === requestedDate &&
    selectedTeam === requestedTeamForState &&
    selectedPosition === requestedPositionForState;

  useEffect(() => {
    if (!router.isReady || !routeStateApplied) return;
    if (typeof router.replace !== "function") return;

    const nextHref = buildForgeHref("/forge/dashboard", {
      date: selectedDate,
      team: selectedTeam,
      position: selectedPosition
    });

    if (router.asPath === nextHref) return;

    void router.replace(nextHref, undefined, {
      shallow: true,
      scroll: false
    });
  }, [
    requestedDate,
    requestedPositionForState,
    requestedTeamForState,
    routeStateApplied,
    router,
    selectedDate,
    selectedPosition,
    selectedTeam
  ]);

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
      expansionEl.style.setProperty(
        "--forge-expansion-scale",
        scale.toFixed(4)
      );
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

  const handleResetFilters = () => {
    setSelectedDate(todayEt);
    setSelectedTeam("all");
    setSelectedPosition("all");
    setInsightOwnershipMin(25);
    setInsightOwnershipMax(50);
  };

  const handleInsightOwnershipMinChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) return;
    setInsightOwnershipMin(Math.min(nextValue, insightOwnershipMax));
  };

  const handleInsightOwnershipMaxChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) return;
    setInsightOwnershipMax(Math.max(nextValue, insightOwnershipMin));
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
          <div className={styles.shell}>
            <header className={styles.header}>
              <div className={styles.headerTopline}>
                <div className={styles.titleBlock}>
                  <h1 ref={titleRef} className={styles.title}>
                    FORGE DASHBOARD
                  </h1>
                  <p className={styles.titleExpansion}>
                    <span
                      ref={expansionTextRef}
                      className={styles.titleExpansionText}
                    >
                      Forecasting &amp; Outcome Reconciliation Game Engine
                    </span>
                  </p>
                </div>
                <p className={styles.subtitle}>
                  Slate-first fantasy command surface for adds, sustainability,
                  and goalie risk.
                </p>
              </div>
            </header>

            <section
              className={styles.controlsSurface}
              aria-label="Forge dashboard command surface"
            >
              <div className={styles.contextBlock}>
                <p className={styles.contextEyebrow}>Active Context</p>
                <div className={styles.contextHeadingRow}>
                  <h2 className={styles.contextTitle}>{formattedDateContext}</h2>
                  <span className={styles.contextTimezone}>ET</span>
                </div>
                <div className={styles.contextChips} aria-label="Active filters">
                  <span className={styles.contextChip}>
                    Team: {selectedTeam === "all" ? "All Teams" : selectedTeam}
                  </span>
                  <span className={styles.contextChip}>
                    Position: {selectedPositionLabel}
                  </span>
                  <span className={styles.contextChip}>
                    Slate: {selectedDate === todayEt ? "Tonight" : "Custom Date"}
                  </span>
                </div>
                <p className={styles.contextSummary}>
                  Date resets the slate. Team narrows matchup surfaces.
                  Position remaps the skater insight and add modules.
                </p>
              </div>

              <div className={styles.controlStack}>
                <nav
                  className={styles.secondaryNavWrapper}
                  aria-label="Forge dashboard navigation"
                >
                  <ForgeRouteNav
                    current="dashboard"
                    teamHref={
                      selectedTeam === "all"
                        ? null
                        : buildForgeHref(teamDetailHref, {
                            date: selectedDate,
                            team: selectedTeam,
                            position: selectedPosition
                          })
                    }
                    date={selectedDate}
                    team={selectedTeam}
                    position={selectedPosition}
                  />
                </nav>

                <section
                  className={styles.controlsRow}
                  aria-label="Global dashboard filters"
                >
                  <section className={styles.filterBar}>
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

                  <div className={styles.filterActions}>
                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={handleResetFilters}
                      disabled={!hasCustomFilters}
                    >
                      Reset Filters
                    </button>
                  </div>
                </section>
              </div>
            </section>

            <section
              className={styles.dashboardStage}
              aria-label="Forge dashboard overview"
            >
              <div className={`${styles.panel} ${styles.teamPowerPanel}`}>
                <TeamPowerCard
                  date={selectedDate}
                  team={selectedTeam}
                />
              </div>

              <div className={`${styles.panel} ${styles.focusPanel}`}>
                <SlateStripCard
                  date={selectedDate}
                  team={selectedTeam}
                />
                <GoalieRiskCard
                  date={selectedDate}
                  team={selectedTeam}
                />
              </div>

              <aside className={`${styles.panel} ${styles.topRailPanel}`}>
                <TopAddsRail
                  date={selectedDate}
                  position={selectedPosition}
                  positionLabel={selectedPositionLabel}
                />
              </aside>
            </section>

            <section
              className={styles.playerInsightBand}
              aria-label="Player insight core"
            >
              <div className={styles.playerInsightHeader}>
                <div className={styles.bandIntro}>
                  <p className={styles.bandEyebrow}>Player Insight Core</p>
                  <h2 className={styles.bandTitle}>
                    Trust, Regression, and Momentum
                  </h2>
                </div>
                <div
                  className={styles.ownershipControlCard}
                  aria-label="Player insight ownership filter"
                >
                  <p className={styles.ownershipControlEyebrow}>
                    Insight Ownership Band
                  </p>
                  <p className={styles.ownershipControlValue}>
                    {insightOwnershipMin}% - {insightOwnershipMax}%
                  </p>
                  <div className={styles.ownershipControlRows}>
                    <label className={styles.ownershipControlItem}>
                      <span>Min</span>
                      <input
                        aria-label="Player insight minimum ownership"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={insightOwnershipMin}
                        onChange={handleInsightOwnershipMinChange}
                      />
                    </label>
                    <label className={styles.ownershipControlItem}>
                      <span>Max</span>
                      <input
                        aria-label="Player insight maximum ownership"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={insightOwnershipMax}
                        onChange={handleInsightOwnershipMaxChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.insightBandLayout}>
                <div className={`${styles.panel} ${styles.sustainabilityPanel}`}>
                  <SustainabilityCard
                    date={selectedDate}
                    position={selectedPosition}
                    ownershipMin={insightOwnershipMin}
                    ownershipMax={insightOwnershipMax}
                    returnToHref={dashboardReturnHref}
                  />
                </div>
                <div className={`${styles.panel} ${styles.hotColdPanel}`}>
                  <HotColdCard
                    date={selectedDate}
                    team={selectedTeam}
                    position={selectedPosition}
                    ownershipMin={insightOwnershipMin}
                    ownershipMax={insightOwnershipMax}
                    returnToHref={dashboardReturnHref}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default ForgeDashboardPage;
