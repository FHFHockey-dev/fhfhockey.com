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

type DashboardModuleStatus = {
  loading: boolean;
  error: string | null;
  staleMessage: string | null;
  empty: boolean;
};

type DashboardModuleKey =
  | "slate"
  | "adds"
  | "teamPower"
  | "sustainability"
  | "hotCold"
  | "goalie";

type DashboardBandKey = "top" | "team" | "insight" | "goalie";

const EMPTY_MODULE_STATUS: DashboardModuleStatus = {
  loading: true,
  error: null,
  staleMessage: null,
  empty: false
};

const STATIC_MODULE_STATUS: DashboardModuleStatus = {
  loading: false,
  error: null,
  staleMessage: null,
  empty: false
};

const MODULE_LABELS: Record<DashboardModuleKey, string> = {
  slate: "Slate",
  adds: "Top Adds",
  teamPower: "Team Context",
  sustainability: "Sustainability",
  hotCold: "Trend Movement",
  goalie: "Goalies"
};

const MOBILE_ACCORDION_QUERY = "(max-width: 767px)";
const DEFAULT_MOBILE_BAND_STATE: Record<DashboardBandKey, boolean> = {
  top: true,
  team: false,
  insight: true,
  goalie: true
};

function BandStatusSummary({
  status,
  label
}: {
  status: {
    loadingCount: number;
    errors: Array<{ module: string; message: string }>;
    staleMessages: string[];
    allEmpty: boolean;
  };
  label: string;
}) {
  const hasAlerts =
    status.loadingCount > 0 ||
    status.errors.length > 0 ||
    status.staleMessages.length > 0 ||
    status.allEmpty;

  if (!hasAlerts) return null;

  return (
    <div
      className={styles.bandStatusStack}
      aria-live="polite"
      aria-label={`${label} status`}
    >
      <div className={styles.bandStatusPills}>
        {status.loadingCount > 0 && (
          <span
            className={`${styles.bandStatusPill} ${styles.bandStatusPillLoading}`}
          >
            Loading {status.loadingCount}
          </span>
        )}
        {status.errors.length > 0 && (
          <span
            className={`${styles.bandStatusPill} ${styles.bandStatusPillError}`}
          >
            Error {status.errors.length}
          </span>
        )}
        {status.staleMessages.length > 0 && (
          <span
            className={`${styles.bandStatusPill} ${styles.bandStatusPillStale}`}
          >
            Stale {status.staleMessages.length}
          </span>
        )}
        {status.allEmpty && (
          <span
            className={`${styles.bandStatusPill} ${styles.bandStatusPillEmpty}`}
          >
            Empty
          </span>
        )}
      </div>

      {status.loadingCount > 0 && (
        <div className={styles.bandLoadingShell} aria-hidden="true">
          <span className={styles.bandLoadingBarLg} />
          <span className={styles.bandLoadingBarSm} />
        </div>
      )}

      {status.errors.length > 0 && (
        <div className={`${styles.bandAlert} ${styles.bandAlertError}`}>
          {status.errors.map((entry) => (
            <p key={`${entry.module}-${entry.message}`} className={styles.bandAlertLine}>
              {entry.module}: {entry.message}
            </p>
          ))}
        </div>
      )}

      {status.staleMessages.length > 0 && (
        <div className={`${styles.bandAlert} ${styles.bandAlertStale}`}>
          {status.staleMessages.map((message) => (
            <p key={message} className={styles.bandAlertLine}>
              {message}
            </p>
          ))}
        </div>
      )}

      {status.allEmpty &&
        status.loadingCount === 0 &&
        status.errors.length === 0 && (
          <div className={`${styles.bandAlert} ${styles.bandAlertEmpty}`}>
            <p className={styles.bandAlertLine}>
              No {label.toLowerCase()} signals are available for the current
              filters yet.
            </p>
          </div>
        )}
    </div>
  );
}

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
  const [isMobileAccordionMode, setIsMobileAccordionMode] = useState(false);
  const [mobileBandState, setMobileBandState] = useState<
    Record<DashboardBandKey, boolean>
  >(DEFAULT_MOBILE_BAND_STATE);
  const [insightOwnershipMin, setInsightOwnershipMin] = useState(25);
  const [insightOwnershipMax, setInsightOwnershipMax] = useState(50);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const expansionTextRef = useRef<HTMLSpanElement | null>(null);
  const [moduleResolvedDates, setModuleResolvedDates] = useState<{
    adds: string | null;
    teamPower: string | null;
    sustainability: string | null;
    hotCold: string | null;
    goalie: string | null;
    slate: string | null;
  }>({
    adds: null,
    teamPower: null,
    sustainability: null,
    hotCold: null,
    goalie: null,
    slate: null
  });
  const [moduleStatuses, setModuleStatuses] = useState<
    Record<DashboardModuleKey, DashboardModuleStatus>
  >({
    slate: EMPTY_MODULE_STATUS,
    adds: STATIC_MODULE_STATUS,
    teamPower: EMPTY_MODULE_STATUS,
    sustainability: EMPTY_MODULE_STATUS,
    hotCold: EMPTY_MODULE_STATUS,
    goalie: EMPTY_MODULE_STATUS
  });
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
  const driftWarnings = useMemo(() => {
    const labels: Record<keyof typeof moduleResolvedDates, string> = {
      adds: "Top Adds",
      teamPower: "Team Power",
      sustainability: "Sustainability",
      hotCold: "Trend Movement",
      goalie: "Goalie Risk",
      slate: "Slate Strip"
    };

    return Object.entries(moduleResolvedDates)
      .filter(([, resolvedDate]) =>
        Boolean(resolvedDate && resolvedDate !== selectedDate)
      )
      .map(([moduleKey, resolvedDate]) => ({
        module: labels[moduleKey as keyof typeof moduleResolvedDates],
        resolvedDate: resolvedDate as string
      }));
  }, [moduleResolvedDates, selectedDate]);

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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_ACCORDION_QUERY);
    const syncViewportState = (event?: MediaQueryListEvent) => {
      setIsMobileAccordionMode(event?.matches ?? mediaQuery.matches);
    };

    syncViewportState();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewportState);
      return () => {
        mediaQuery.removeEventListener("change", syncViewportState);
      };
    }

    mediaQuery.addListener(syncViewportState);
    return () => {
      mediaQuery.removeListener(syncViewportState);
    };
  }, []);

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

  const updateModuleStatus = (
    moduleKey: DashboardModuleKey,
    status: DashboardModuleStatus
  ) => {
    setModuleStatuses((current) => {
      const previous = current[moduleKey];
      if (
        previous.loading === status.loading &&
        previous.error === status.error &&
        previous.staleMessage === status.staleMessage &&
        previous.empty === status.empty
      ) {
        return current;
      }

      return {
        ...current,
        [moduleKey]: status
      };
    });
  };

  const getBandStatus = (keys: DashboardModuleKey[]) => {
    const statuses = keys.map((key) => ({
      module: MODULE_LABELS[key],
      ...moduleStatuses[key]
    }));

    return {
      loadingCount: statuses.filter((status) => status.loading).length,
      errors: statuses
        .filter((status) => Boolean(status.error))
        .map((status) => ({
          module: status.module,
          message: status.error as string
        })),
      staleMessages: statuses
        .map((status) => status.staleMessage)
        .filter((message): message is string => Boolean(message)),
      allEmpty:
        statuses.length > 0 &&
        statuses.every(
          (status) =>
            !status.loading && !status.error && status.empty
        )
    };
  };

  const topBandStatus = getBandStatus(["slate", "adds"]);
  const teamBandStatus = getBandStatus(["teamPower"]);
  const playerInsightStatus = getBandStatus(["sustainability", "hotCold"]);
  const goalieBandStatus = getBandStatus(["goalie"]);
  const toggleBand = (bandKey: DashboardBandKey) => {
    setMobileBandState((current) => ({
      ...current,
      [bandKey]: !current[bandKey]
    }));
  };
  const isBandExpanded = (bandKey: DashboardBandKey) =>
    !isMobileAccordionMode || mobileBandState[bandKey];

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

            {driftWarnings.length > 0 && (
              <section className={styles.driftBanner} aria-live="polite">
                <strong>Data date mismatch:</strong>{" "}
                {driftWarnings
                  .map((entry) => `${entry.module} using ${entry.resolvedDate}`)
                  .join(" • ")}
              </section>
            )}

            <section
              className={styles.sectionBand}
              aria-label="Top command band"
            >
              <div className={styles.bandHeader}>
                <div className={styles.bandHeaderMain}>
                  <div className={styles.bandIntro}>
                    <p className={styles.bandEyebrow}>Band 1</p>
                    <h2 className={styles.bandTitle}>Tonight&apos;s Slate</h2>
                    <p className={styles.bandSummary}>
                      The slate stays anchored beside the opportunity rail.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.bandMobileToggle}
                    aria-expanded={isBandExpanded("top")}
                    aria-controls="forge-band-top"
                    onClick={() => toggleBand("top")}
                  >
                    {isBandExpanded("top") ? "Collapse" : "Expand"}
                    <span className={styles.bandMobileToggleLabel}>
                      Tonight&apos;s Slate
                    </span>
                  </button>
                </div>
              </div>
              <div
                id="forge-band-top"
                className={styles.sectionBandBody}
                hidden={!isBandExpanded("top")}
              >
                <BandStatusSummary
                  label="Tonight's Slate"
                  status={topBandStatus}
                />

                <div className={styles.topBandLayout}>
                  <div className={`${styles.panel} ${styles.topHeroPanel}`}>
                    <SlateStripCard
                      date={selectedDate}
                      team={selectedTeam}
                      onStatusChange={(status) =>
                        updateModuleStatus("slate", status)
                      }
                      onResolvedDate={(resolvedDate) =>
                        updateModuleResolvedDate("slate", resolvedDate)
                      }
                    />
                  </div>

                  <aside className={`${styles.panel} ${styles.topRailPanel}`}>
                    <div className={styles.railHeader}>
                      <p className={styles.railEyebrow}>Right Rail</p>
                      <h3 className={styles.railTitle}>Top Player Adds</h3>
                      <p className={styles.railSummary}>
                        Ownership-aware adds stay beside the slate so the first
                        scan surfaces matchups and pickups together.
                      </p>
                    </div>
                    <TopAddsRail
                      date={selectedDate}
                      position={selectedPosition}
                      positionLabel={selectedPositionLabel}
                      onResolvedDate={(resolvedDate) =>
                        updateModuleResolvedDate("adds", resolvedDate)
                      }
                      onStatusChange={(status) =>
                        updateModuleStatus("adds", status)
                      }
                    />
                  </aside>
                </div>
              </div>
            </section>

            <section
              className={styles.sectionBand}
              aria-label="Team trend context band"
            >
              <div className={styles.bandHeader}>
                <div className={styles.bandHeaderMain}>
                  <div className={styles.bandIntro}>
                    <p className={styles.bandEyebrow}>Band 2</p>
                    <h2 className={styles.bandTitle}>Team Trend Context</h2>
                    <p className={styles.bandSummary}>
                      Team strength, momentum, and matchup context frame the
                      player opportunity view.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.bandMobileToggle}
                    aria-expanded={isBandExpanded("team")}
                    aria-controls="forge-band-team"
                    onClick={() => toggleBand("team")}
                  >
                    {isBandExpanded("team") ? "Collapse" : "Expand"}
                    <span className={styles.bandMobileToggleLabel}>
                      Team Trend Context
                    </span>
                  </button>
                </div>
              </div>
              <div
                id="forge-band-team"
                className={styles.sectionBandBody}
                hidden={!isBandExpanded("team")}
              >
                <BandStatusSummary
                  label="Team Trend Context"
                  status={teamBandStatus}
                />

                <div className={styles.contextBandLayout}>
                  <div className={`${styles.panel} ${styles.teamPowerPanel}`}>
                    <TeamPowerCard
                      date={selectedDate}
                      team={selectedTeam}
                      onStatusChange={(status) =>
                        updateModuleStatus("teamPower", status)
                      }
                      onResolvedDate={(resolvedDate) =>
                        updateModuleResolvedDate("teamPower", resolvedDate)
                      }
                    />
                  </div>
                </div>
              </div>
            </section>

            <section
              className={styles.sectionBand}
              aria-label="Player insight core"
            >
              <div className={styles.bandHeader}>
                <div className={styles.bandHeaderMain}>
                  <div className={styles.bandIntro}>
                    <p className={styles.bandEyebrow}>Band 3</p>
                    <h2 className={styles.bandTitle}>Player Insight Core</h2>
                    <p className={styles.bandSummary}>
                      Sustainability and short-term movement live together here,
                      while staying separate signal families.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.bandMobileToggle}
                    aria-expanded={isBandExpanded("insight")}
                    aria-controls="forge-band-insight"
                    onClick={() => toggleBand("insight")}
                  >
                    {isBandExpanded("insight") ? "Collapse" : "Expand"}
                    <span className={styles.bandMobileToggleLabel}>
                      Player Insight Core
                    </span>
                  </button>
                </div>
              </div>
              <div
                id="forge-band-insight"
                className={styles.sectionBandBody}
                hidden={!isBandExpanded("insight")}
              >
                <div className={styles.bandInlineControlRow}>
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
                    <p className={styles.contextSummary}>
                      Applies only to the insight cards. Top Adds keeps its own
                      band in the rail.
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
                <BandStatusSummary
                  label="Player Insight Core"
                  status={playerInsightStatus}
                />

                <div className={styles.insightBandLayout}>
                  <div className={`${styles.panel} ${styles.sustainabilityPanel}`}>
                    <SustainabilityCard
                      date={selectedDate}
                      position={selectedPosition}
                      ownershipMin={insightOwnershipMin}
                      ownershipMax={insightOwnershipMax}
                      returnToHref={dashboardReturnHref}
                      onStatusChange={(status) =>
                        updateModuleStatus("sustainability", status)
                      }
                      onResolvedDate={(resolvedDate) =>
                        updateModuleResolvedDate("sustainability", resolvedDate)
                      }
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
                      onResolvedDate={(resolvedDate) =>
                        updateModuleResolvedDate("hotCold", resolvedDate)
                      }
                      onStatusChange={(status) =>
                        updateModuleStatus("hotCold", status)
                      }
                    />
                  </div>
                </div>
              </div>
            </section>

            <section
              className={styles.sectionBand}
              aria-label="Goalie and risk band"
            >
              <div className={styles.bandHeader}>
                <div className={styles.bandHeaderMain}>
                  <div className={styles.bandIntro}>
                    <p className={styles.bandEyebrow}>Band 4</p>
                    <h2 className={styles.bandTitle}>Goalie and Risk</h2>
                    <p className={styles.bandSummary}>
                      High-leverage goalie calls stay visible as their own
                      decision band.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.bandMobileToggle}
                    aria-expanded={isBandExpanded("goalie")}
                    aria-controls="forge-band-goalie"
                    onClick={() => toggleBand("goalie")}
                  >
                    {isBandExpanded("goalie") ? "Collapse" : "Expand"}
                    <span className={styles.bandMobileToggleLabel}>
                      Goalie and Risk
                    </span>
                  </button>
                </div>
              </div>
              <div
                id="forge-band-goalie"
                className={styles.sectionBandBody}
                hidden={!isBandExpanded("goalie")}
              >
                <BandStatusSummary
                  label="Goalie and Risk"
                  status={goalieBandStatus}
                />

                <div className={styles.goalieBandLayout}>
                  <div className={`${styles.panel} ${styles.goaliePanel}`}>
                    <GoalieRiskCard
                      date={selectedDate}
                      team={selectedTeam}
                      onStatusChange={(status) =>
                        updateModuleStatus("goalie", status)
                      }
                      onResolvedDate={(resolvedDate) =>
                        updateModuleResolvedDate("goalie", resolvedDate)
                      }
                    />
                  </div>
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
