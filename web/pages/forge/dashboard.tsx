import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import { evaluateMixedEffectiveDates } from "lib/dashboard/freshness";

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
  const [routeStateHydrated, setRouteStateHydrated] = useState(false);
  const [insightOwnershipMin, setInsightOwnershipMin] = useState(25);
  const [insightOwnershipMax, setInsightOwnershipMax] = useState(50);
  const [moduleDates, setModuleDates] = useState<Record<string, string | null>>({});
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
  const updateModuleDate = useCallback((source: string, value: string | null) => {
    setModuleDates((current) =>
      current[source] === value ? current : { ...current, [source]: value }
    );
  }, []);
  const mixedDateAudit = useMemo(
    () =>
      evaluateMixedEffectiveDates([
        { source: "team-ratings", label: "Team ratings", date: moduleDates.teamRatings },
        { source: "team-ctpi", label: "Team momentum", date: moduleDates.teamCtpi },
        { source: "slate", label: "Slate", date: moduleDates.slate },
        { source: "goalies", label: "Goalies", date: moduleDates.goalies },
        { source: "top-adds", label: "Top Adds", date: moduleDates.topAdds },
        { source: "sustainability", label: "Trust/fade", date: moduleDates.sustainability },
        { source: "movement", label: "Player movement", date: moduleDates.movement }
      ]),
    [moduleDates]
  );

  useEffect(() => {
    setModuleDates({});
  }, [selectedDate]);
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
    setRouteStateHydrated(true);
  }, [normalizedRequestedTeam, requestedDate, requestedPosition, router.isReady]);

  const routeStateApplied =
    selectedDate === requestedDate &&
    selectedTeam === requestedTeamForState &&
    selectedPosition === requestedPositionForState;
  const dashboardReady = router.isReady && routeStateHydrated;

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
          content="Fantasy hockey dashboard for waiver adds, team strength, player trust, and goalie start decisions."
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
                      Fantasy Hockey Forecast Engine
                    </span>
                  </p>
                </div>
                <p className={styles.subtitle}>
                  Plain-English picks for waivers, lineup calls, team strength,
                  and goalie starts.
                </p>
              </div>
            </header>

            <section
              className={styles.controlsSurface}
              aria-label="Forge dashboard filters"
            >
              <div className={styles.contextBlock}>
                <p className={styles.contextEyebrow}>Your View</p>
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
                    Games: {selectedDate === todayEt ? "Tonight" : "Custom Date"}
                  </span>
                </div>
                <p className={styles.contextSummary}>
                  Pick a date, team, or position to narrow every card below.
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
              className={styles.controlCenter}
              aria-label="Forge dashboard"
            >
              {dashboardReady ? (
                <>
                  {mixedDateAudit.isMixed ? (
                    <p className={`${styles.panelState} ${styles.panelStateStale}`} role="status">
                      {mixedDateAudit.message}
                    </p>
                  ) : null}
                  <section
                    className={styles.dashboardStage}
                    aria-label="Forge dashboard overview"
                  >
                <div className={`${styles.panel} ${styles.teamPowerPanel}`}>
                  <TeamPowerCard
                    date={selectedDate}
                    team={selectedTeam}
                    onResolvedDate={(value) => updateModuleDate("teamRatings", value)}
                    onCtpiResolvedDate={(value) => updateModuleDate("teamCtpi", value)}
                  />
                </div>

                <div className={`${styles.panel} ${styles.focusPanel}`}>
                  <SlateStripCard
                    date={selectedDate}
                    team={selectedTeam}
                    onResolvedDate={(value) => updateModuleDate("slate", value)}
                  />
                  <GoalieRiskCard
                    date={selectedDate}
                    team={selectedTeam}
                    onResolvedDate={(value) => updateModuleDate("goalies", value)}
                  />
                </div>

                <aside className={`${styles.panel} ${styles.topRailPanel}`}>
                  <TopAddsRail
                    date={selectedDate}
                    position={selectedPosition}
                    positionLabel={selectedPositionLabel}
                    onResolvedDate={(value) => updateModuleDate("topAdds", value)}
                  />
                </aside>
                  </section>

                  <section
                    className={styles.playerInsightBand}
                    aria-label="Player insight core"
                  >
                <div className={styles.playerInsightHeader}>
                  <div className={styles.bandIntro}>
                    <p className={styles.bandEyebrow}>Player Calls</p>
                    <h2 className={styles.bandTitle}>
                      Who To Trust, Who To Fade, Who Is Moving
                    </h2>
                    <p className={styles.bandSummary}>
                      These cards translate recent form into fantasy actions:
                      add, hold, stream, or be careful.
                    </p>
                  </div>
                  <div
                    className={styles.ownershipControlCard}
                    aria-label="Player insight ownership filter"
                  >
                    <p className={styles.ownershipControlEyebrow}>
                      Show Players Owned In
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
                      onResolvedDate={(value) => updateModuleDate("sustainability", value)}
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
                      onResolvedDate={(value) => updateModuleDate("movement", value)}
                    />
                  </div>
                </div>
                  </section>
                </>
              ) : (
                <p className={styles.panelState} role="status">
                  Loading selected dashboard context...
                </p>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default ForgeDashboardPage;
