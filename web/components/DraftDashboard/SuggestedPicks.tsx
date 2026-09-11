// components/DraftDashboard/SuggestedPicks.tsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { buildRecommendationCandidates, usePlayerRecommendations } from "hooks/usePlayerRecommendations";
import { useDraftProRecommendations } from "hooks/useDraftProRecommendations";
import styles from "./SuggestedPicks.module.scss";
import controls from "styles/Controls.module.scss";
import type { DraftDashboardDustInsight } from "hooks/useRosterScheduleOptimizer";
import {
  getProjectionDisplayPosition,
  matchesProjectionPosition
} from "lib/draftDashboard/projectionVisibility";
import { type ForwardGrouping } from "lib/draftDashboard/forwardGrouping";
import { isGlobalShortcutBlockedTarget } from "lib/draftDashboard/keyboardShortcuts";

export interface SuggestedPicksProps {
  compact?: boolean;
  onReturnToDraft?: () => void;
  isLoading?: boolean;
  error?: string | null;
  dustInsights?: ReadonlyMap<string, DraftDashboardDustInsight>;
  players: ProcessedPlayer[]; // available players only
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
  personalizedVorpMetrics?: Map<string, PlayerVorpMetrics>;
  draftProEligible?: boolean;
  categoryWeights?: Record<string, number>;
  recommendationDataOrigin?: "server" | "local_csv" | "private_import";
  onNeedWeightEnabledChange?: (enabled: boolean) => void;
  dustSort?: "ordinary" | "schedule_fit";
  onDustSortChange?: (sort: "ordinary" | "schedule_fit") => void;
  canUseProDust?: boolean;
  dustLineupMode?: "daily" | "weekly";
  onDustLineupModeChange?: (mode: "daily" | "weekly") => void;
  needWeightEnabled?: boolean;
  needAlpha?: number; // 0..1
  posNeeds?: Record<string, number>;
  currentPick: number;
  teamCount: number;
  baselineMode?: "remaining" | "full";
  nextPickNumber?: number; // to compute availability heuristic
  defaultLimit?: number; // default 10
  onSelectPlayer?: (playerId: string | null) => void;
  // NEW: categories-mode context (optional)
  leagueType?: "points" | "categories";
  catNeeds?: Record<string, number>;
  // NEW: roster progress bar data
  rosterProgress?: { pos: string; filled: number; total: number }[];
  // NEW: allow drafting directly from suggestions
  onDraftPlayer?: (playerId: string) => void;
  canDraft?: boolean;
  // NEW: personalized replacement toggle (upstream state)
  personalizeReplacement?: boolean;
  onPersonalizeReplacementChange?: (enabled: boolean) => void;
  forwardGrouping?: ForwardGrouping;
  onComparePlayer?: (playerId: string) => void;
  compareSelectedIds?: string[];
  personalRankByPlayerId?: Readonly<Record<string, number>>;
}

const SuggestedPicks: React.FC<SuggestedPicksProps> = ({
  compact = false,
  onReturnToDraft,
  players,
  isLoading = false,
  error,
  dustInsights,
  vorpMetrics,
  personalizedVorpMetrics,
  draftProEligible = false,
  categoryWeights = {},
  recommendationDataOrigin = "server",
  onNeedWeightEnabledChange,
  dustSort = "ordinary",
  onDustSortChange,
  canUseProDust = false,
  dustLineupMode = "daily",
  onDustLineupModeChange,
  needWeightEnabled = false,
  needAlpha = 0.5,
  posNeeds = {},
  currentPick,
  teamCount,
  baselineMode,
  nextPickNumber,
  defaultLimit = 10,
  onSelectPlayer,
  // accept but not used yet
  leagueType,
  catNeeds,
  rosterProgress,
  onDraftPlayer,
  canDraft = true,
  personalizeReplacement,
  onPersonalizeReplacementChange,
  forwardGrouping = "split",
  onComparePlayer,
  compareSelectedIds = [],
  personalRankByPlayerId = {}
}) => {
  // UI state
  type SortField = "rank" | "myRank" | "projFp" | "vorp" | "vbd" | "adp" | "avail" | "fit";
  const cardsRef = React.useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ start: true, end: false });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasPersonalRanks = Object.keys(personalRankByPlayerId).length > 0;
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("suggested.sortField") as SortField) || "rank"
      );
    }
    return "rank";
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("suggested.sortDir") as "asc" | "desc") || "desc"
      );
    }
    return "desc";
  });
  const [posFilter, setPosFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("suggested.posFilter") || "ALL";
    }
    return "ALL";
  });
  // NEW: multi-select position filter via roster segments (persisted). If empty => ALL
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(
    () => {
      if (typeof window === "undefined") return new Set();
      try {
        const raw = localStorage.getItem("suggested.posFilterMulti");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return new Set(arr.map((s) => String(s)));
        }
        // migrate from legacy single filter if present and not ALL
        const single = localStorage.getItem("suggested.posFilter");
        if (single && single !== "ALL") return new Set([single]);
      } catch {}
      return new Set();
    }
  );
  const [limit, setLimit] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const v = parseInt(
        localStorage.getItem("suggested.limit") || String(defaultLimit),
        10
      );
      return Number.isFinite(v) && v > 0 ? v : defaultLimit;
    }
    return defaultLimit;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("suggested.collapsed") === "true";
    }
    return false;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // NEW: preference to show/hide roster progress bar
  const [showRosterBar, setShowRosterBar] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("suggested.showRosterBar");
    return v == null ? true : v === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("suggested.sortField", sortField);
    localStorage.setItem("suggested.sortDir", sortDir);
  }, [sortField, sortDir]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("suggested.posFilter", posFilter);
  }, [posFilter]);
  // persist multi-select positions
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "suggested.posFilterMulti",
        JSON.stringify(Array.from(selectedPositions))
      );
    } catch {}
  }, [selectedPositions]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("suggested.limit", String(limit));
  }, [limit]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("suggested.collapsed", String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("suggested.showRosterBar", String(showRosterBar));
  }, [showRosterBar]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        isGlobalShortcutBlockedTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;

      const key = e.key.toLowerCase();
      if (key === "c") {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if (key === "p") {
        e.preventDefault();
        setShowRosterBar((v) => !v);
      } else if (key === "f") {
        e.preventDefault();
        const order: SortField[] = [
          "rank",
          "vorp",
          "vbd",
          "projFp",
          "adp",
          "avail",
          "fit"
        ];
        const idx = order.indexOf(sortField);
        setSortField(order[(idx + 1) % order.length]);
      } else if (key === "t") {
        e.preventDefault();
        const options = [5, 10, 12, 16, 20];
        const i = options.indexOf(limit);
        setLimit(options[(i + 1) % options.length]);
      } else if (key === "o") {
        e.preventDefault();
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else if (key === "d") {
        if (canDraft && selectedId && onDraftPlayer && cardsRef.current?.querySelector(`[data-player-id="${selectedId}"]`)) {
          e.preventDefault();
          onDraftPlayer(selectedId);
        }
      } else if (key === "r") {
        if (draftProEligible && recommendationDataOrigin === "server") {
          e.preventDefault();
          onNeedWeightEnabledChange?.(!needWeightEnabled);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canDraft, sortField, limit, selectedId, onDraftPlayer, draftProEligible, recommendationDataOrigin, onNeedWeightEnabledChange, needWeightEnabled]);

  // Compute recommendations
  const { recommendations } = usePlayerRecommendations({
    players,
    vorpMetrics,
    personalizedVorpMetrics,
    usePersonalizedReplacement: false,
    posNeeds,
    // Free recommendations stay on the established local baseline. The
    // capability-gated endpoint owns personalized rank changes.
    needWeightEnabled: false,
    needAlpha,
    limit: 200, // compute a bigger set, we'll slice after sorting/filters
    baselineMode,
    currentPick,
    teamCount,
    leagueType,
    catNeeds,
    forwardGrouping,
  });

  const requestPlayers = useMemo(() => {
    if (selectedPositions.size > 0) {
      return players.filter((player) => Array.from(selectedPositions).some((position) =>
        matchesProjectionPosition(player, position === "Goalie" ? "G" : position === "Skater" ? "SKATER" : position, forwardGrouping),
      ));
    }
    if (posFilter === "ALL") return players;
    if (posFilter === "Skater") return players.filter((player) => matchesProjectionPosition(player, "SKATER", forwardGrouping));
    if (posFilter === "Goalie") return players.filter((player) => matchesProjectionPosition(player, "G", forwardGrouping));
    return players.filter((player) => matchesProjectionPosition(player, posFilter, forwardGrouping));
  }, [forwardGrouping, players, posFilter, selectedPositions]);
  const remoteInputOversized = requestPlayers.length > 2_000;

  const recommendationCandidates = useMemo(() => buildRecommendationCandidates({
    players: requestPlayers,
    vorpMetrics,
    personalizedVorpMetrics,
    usePersonalizedReplacement: draftProEligible && Boolean(personalizeReplacement),
    forwardGrouping,
  }), [draftProEligible, forwardGrouping, personalizedVorpMetrics, personalizeReplacement, requestPlayers, vorpMetrics]);
  const remoteRecommendations = useDraftProRecommendations(
    draftProEligible && recommendationDataOrigin === "server" && !remoteInputOversized && recommendationCandidates.length
      ? {
          candidates: recommendationCandidates,
          dataOrigin: "server",
          leagueType: leagueType ?? "points",
          positionNeeds: posNeeds,
          categoryNeeds: catNeeds,
          categoryWeights,
          needAlpha: needWeightEnabled ? needAlpha : 0,
          currentPick,
          teamCount,
          limit: 100,
        }
      : null,
    draftProEligible && recommendationDataOrigin === "server" && !remoteInputOversized && recommendationCandidates.length > 0,
  );
  const activeRecommendations = useMemo(() => {
    if (!remoteRecommendations.results) return recommendations;
    const playerById = new Map(players.map((player) => [String(player.playerId), player]));
    return remoteRecommendations.results.flatMap((result) => {
      const player = playerById.get(result.candidate.id);
      if (!player) return [];
      const metrics = vorpMetrics?.get(result.candidate.id);
      return [{
        player,
        score: result.recommendationScore,
        value: metrics?.value ?? player.fantasyPoints?.projected ?? 0,
        vorp: result.globalVorp,
        vona: metrics?.vona ?? 0,
        vbd: metrics?.vbd ?? metrics?.vorp ?? 0,
        availability: result.availabilityEstimate ?? undefined,
        fitScore: 0,
        reasonTags: result.reasons,
      }];
    });
  }, [players, recommendations, remoteRecommendations.results, vorpMetrics]);

  const scheduleFitRecommendations = useMemo(() => {
    if (dustSort !== "schedule_fit" || !dustInsights?.size) return null;
    return players.flatMap((player) => {
      if (!dustInsights.has(String(player.playerId))) return [];
      const metrics = vorpMetrics?.get(String(player.playerId));
      return [{
        player,
        score: metrics?.value ?? player.fantasyPoints?.projected ?? 0,
        value: metrics?.value ?? player.fantasyPoints?.projected ?? 0,
        vorp: metrics?.vorp ?? 0,
        vona: metrics?.vona ?? 0,
        vbd: metrics?.vbd ?? metrics?.vorp ?? 0,
        availability: undefined,
        fitScore: undefined,
        reasonTags: undefined,
      }];
    });
  }, [dustInsights, dustSort, players, vorpMetrics]);

  const withRosterAdjustedVorp = useMemo(() => {
    if (scheduleFitRecommendations) return scheduleFitRecommendations;
    // Preserve the established free rank ordering while using the shared
    // availability estimate generated by the recommendation contract.
    if (remoteRecommendations.results) return activeRecommendations;
    return activeRecommendations.map((recommendation) => {
      const availability = recommendation.availability;
      const riskBoost = typeof availability === "number"
        ? 0.25 * (1 - availability) * Math.max(0, recommendation.vbd ?? 0)
        : 0;
      return { ...recommendation, score: recommendation.score + riskBoost };
    });
  }, [activeRecommendations, remoteRecommendations.results, scheduleFitRecommendations]);

  // Position filter options from players
  const availablePositions = useMemo(() => {
    const normalized = Array.from(
      new Set(
        players
          .flatMap((player) =>
            getProjectionDisplayPosition(player, forwardGrouping).split(",")
          )
          .map((position) => position.trim())
          .filter(Boolean)
      )
    ).sort();
    const list: string[] = ["ALL"];
    // Prefer composite labels over raw singulars
    list.push("Skater");
    list.push("Goalie");
    // Avoid listing raw 'G' since 'Goalie' covers it
    normalized.forEach((p) => {
      const up = p.toUpperCase();
      const low = p.toLowerCase();
      if (low === "all" || low === "skater" || low === "goalie") return;
      if (up === "G") return; // hide raw G to prevent redundancy
      list.push(p);
    });
    return list;
  }, [forwardGrouping, players]);

  useEffect(() => {
    const allowed = new Set(availablePositions);
    setSelectedPositions((previous) => {
      const next = new Set(Array.from(previous).filter((position) => allowed.has(position)));
      return next.size === previous.size ? previous : next;
    });
    if (!allowed.has(posFilter)) setPosFilter("ALL");
  }, [availablePositions, posFilter]);

  // Apply filters: if multi-select set has items, use it; else fallback to single select
  const filtered = useMemo(() => {
    const source = withRosterAdjustedVorp;
    if (selectedPositions.size > 0) {
      return source.filter((r) => {
        return Array.from(selectedPositions).some((position) =>
          matchesProjectionPosition(
            r.player,
            position === "Goalie"
              ? "G"
              : position === "Skater"
                ? "SKATER"
                : position,
            forwardGrouping
          )
        );
      });
    }
    if (posFilter === "ALL") return source;
    if (posFilter === "Skater") {
      return source.filter((r) =>
        matchesProjectionPosition(r.player, "SKATER", forwardGrouping)
      );
    }
    if (posFilter === "Goalie") {
      return source.filter((r) =>
        matchesProjectionPosition(r.player, "G", forwardGrouping)
      );
    }
    return source.filter((r) =>
      matchesProjectionPosition(r.player, posFilter, forwardGrouping)
    );
  }, [forwardGrouping, withRosterAdjustedVorp, posFilter, selectedPositions]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mul = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (dustSort === "schedule_fit" && dustInsights?.size) {
        const aDust = dustInsights.get(String(a.player.playerId));
        const bDust = dustInsights.get(String(b.player.playerId));
        const byActiveGames = (bDust?.activeGamesAdded ?? Number.NEGATIVE_INFINITY) - (aDust?.activeGamesAdded ?? Number.NEGATIVE_INFINITY);
        if (byActiveGames) return byActiveGames;
        const byValue = (b.value ?? 0) - (a.value ?? 0);
        if (byValue) return byValue;
        return String(a.player.playerId).localeCompare(String(b.player.playerId));
      }
      const aFp = a.player.fantasyPoints?.projected ?? 0;
      const bFp = b.player.fantasyPoints?.projected ?? 0;
      const aVorp = a.vorp ?? 0;
      const bVorp = b.vorp ?? 0;
      const aVbd = a.vbd ?? 0;
      const bVbd = b.vbd ?? 0;
      const aAdp = (a.player as any).yahooAvgPick || Infinity;
      const bAdp = (b.player as any).yahooAvgPick || Infinity;
      const aAvail = typeof a.availability === "number" ? a.availability : -1;
      const bAvail = typeof b.availability === "number" ? b.availability : -1;
      const aFit = a.fitScore ?? 0;
      const bFit = b.fitScore ?? 0;
      switch (sortField) {
        case "rank":
          return mul * (a.score - b.score);
        case "myRank": {
          const aRank = personalRankByPlayerId[String(a.player.playerId)];
          const bRank = personalRankByPlayerId[String(b.player.playerId)];
          if (aRank == null && bRank == null) return 0;
          if (aRank == null) return 1;
          if (bRank == null) return -1;
          return mul * (aRank - bRank);
        }
        case "projFp":
          return mul * (aFp - bFp);
        case "vorp":
          return mul * (aVorp - bVorp);
        case "vbd":
          return mul * (aVbd - bVbd);
        case "adp":
          return mul * ((aAdp as number) - (bAdp as number));
        case "avail":
          return mul * (aAvail - bAvail);
        case "fit":
          return mul * (aFit - bFit);
      }
    });
    return arr;
  }, [dustInsights, dustSort, filtered, personalRankByPlayerId, sortField, sortDir]);

  const top = useMemo(
    () => sorted.slice(0, Math.max(1, limit)),
    [sorted, limit]
  );

  const updateScrollEdges = useCallback(() => {
    const row = cardsRef.current;
    if (row) setScrollEdges({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 });
  }, []);
  React.useEffect(() => {
    const row = cardsRef.current;
    if (!row) return;
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(row);
    updateScrollEdges();
    return () => observer.disconnect();
  }, [updateScrollEdges, top.length, rosterProgress?.length]);
  React.useEffect(() => { cardsRef.current?.scrollTo({ left: 0 }); }, [posFilter, selectedPositions, sortField, sortDir, dustSort, limit]);
  const scrollCards = (direction: number) => {
    const row = cardsRef.current;
    if (row) row.scrollBy({ left: direction * row.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  const onCardClick = useCallback(
    (id: string) => {
      setSelectedId((prev) => {
        const next = prev === id ? null : id;
        onSelectPlayer && onSelectPlayer(next);
        return next;
      });
    },
    [onSelectPlayer]
  );

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (top.length === 0 || (e.target instanceof Element && e.target.closest("button, input, select"))) return;
    const ids = top.map((r) => String(r.player.playerId));
    const idx = selectedId ? ids.indexOf(selectedId) : -1;
    const row = cardsRef.current;
    const firstVisible = row ? Math.max(0, Array.from(row.children).findIndex(child => child.getBoundingClientRect().right > row.getBoundingClientRect().left + 1)) : 0;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = idx < 0 ? firstVisible : Math.min(ids.length - 1, idx + 1);
      cardsRef.current?.children[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      setSelectedId(ids[next]);
      onSelectPlayer && onSelectPlayer(ids[next]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = idx < 0 ? firstVisible : Math.max(0, idx - 1);
      cardsRef.current?.children[prev]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      setSelectedId(ids[prev]);
      onSelectPlayer && onSelectPlayer(ids[prev]);
    } else if (e.key === "Enter" || e.key.toLowerCase() === "d") {
      // Draft selected player
      if (canDraft && selectedId && onDraftPlayer && top.some((entry) => String(entry.player.playerId) === selectedId)) {
        e.preventDefault();
        onDraftPlayer(selectedId);
      }
    }
  };

  return (
    <section className={styles.suggestedContainer} aria-label="Suggested Picks" style={{ "--roster-lanes": rosterProgress?.length || 6 } as React.CSSProperties}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          Suggested <span className={styles.titleAccent}>Picks</span>
        </h2>
        <nav className={styles.scrollControls} aria-label="Scroll suggested players">
          <button type="button" aria-label="Previous suggested players" disabled={scrollEdges.start} onClick={() => scrollCards(-1)}>‹</button>
          <button type="button" aria-label="Next suggested players" disabled={scrollEdges.end} onClick={() => scrollCards(1)}>›</button>
        </nav>
        <div className={`${styles.controls} ${controls.scope}`}>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Pos</label>
            <select
              className={styles.select}
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
              aria-label="Filter by position"
            >
              {availablePositions.map((p) => (
                <option key={`opt-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Sort</label>
            <select
              className={styles.select}
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              aria-label="Sort suggested picks"
            >
              <option value="rank">Rank</option>
              {hasPersonalRanks && <option value="myRank">My Rank</option>}
              <option value="vorp">VORP</option>
              <option value="vbd">VBD</option>
              <option value="projFp">Proj FP</option>
              <option value="adp">ADP</option>
              <option value="avail">Avail %</option>
              <option value="fit">Cat Fit</option>
            </select>
            <button
              type="button"
              className={styles.sortDirBtn}
              data-control-size="icon"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              aria-label={`Toggle sort direction (${sortDir})`}
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Show</label>
            <select
              className={styles.select}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              aria-label="How many suggestions to show"
            >
              {[5, 10, 12, 16, 20].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
          <div
            id="suggested-picks-advanced-controls"
            className={styles.advancedControls}
            hidden={!advancedOpen}
          >
          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="dust-lineup-mode">DUST lineup</label>
            <select id="dust-lineup-mode" className={styles.select} value={dustLineupMode} onChange={(event) => onDustLineupModeChange?.(event.target.value as "daily" | "weekly")} disabled={!canUseProDust} aria-label="DUST lineup mode">
              <option value="daily">Daily lineup</option>
              <option value="weekly">Weekly lock (unavailable)</option>
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="dust-sort">DUST sort</label>
            <select id="dust-sort" className={styles.select} value={dustSort} onChange={(event) => onDustSortChange?.(event.target.value as "ordinary" | "schedule_fit")} disabled={!canUseProDust} aria-label="DUST sort">
              <option value="ordinary">Ordinary value</option>
              <option value="schedule_fit">Schedule fit</option>
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label
              className={styles.label}
              htmlFor="rosterVorpToggle"
              title={draftProEligible ? "Use Draft Pro roster-aware ranking" : "Draft Pro access is required for roster-aware ranking"}
            >
              Prioritize roster needs
            </label>
            <input
              id="rosterVorpToggle"
              type="checkbox"
              checked={needWeightEnabled}
              onChange={(e) => onNeedWeightEnabledChange?.(e.target.checked)}
              disabled={!draftProEligible || recommendationDataOrigin !== "server"}
              aria-label="Prioritize my roster needs"
            />
          </div>
          <div className={styles.controlGroup}>
            <label
              className={styles.label}
              htmlFor="personalReplaceToggle"
              title="Personalize replacement baselines using your filled slots"
            >
              Personalized
            </label>
            <input
              id="personalReplaceToggle"
              type="checkbox"
              checked={!!personalizeReplacement}
              onChange={(e) =>
                onPersonalizeReplacementChange &&
                onPersonalizeReplacementChange(e.target.checked)
              }
              disabled={!draftProEligible || recommendationDataOrigin !== "server"}
              aria-label="Toggle personalized replacement baselines"
            />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="rosterBarToggle">
              Roster
            </label>
            <input
              id="rosterBarToggle"
              type="checkbox"
              checked={showRosterBar}
              onChange={(e) => setShowRosterBar(e.target.checked)}
              aria-label="Toggle roster progress bar"
            />
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            aria-expanded={!collapsed}
            aria-controls="suggested-picks-cards"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? "Show cards" : "Hide cards"}
          </button>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            aria-expanded={advancedOpen}
            aria-controls="suggested-picks-advanced-controls"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            Advanced
          </button>
        </div>
      </div>

      {recommendationDataOrigin !== "server" ? <p className={styles.loading} role="status">Roster-aware Draft Pro recommendations are unavailable for local CSV data. Save the import to your account first; your local draft and rows stay unchanged.</p> : remoteInputOversized ? <p className={styles.loading} role="status">This filtered player pool is too large for roster-aware recommendations. Narrow the position filter; no projection rows were uploaded.</p> : !draftProEligible ? null : remoteRecommendations.status === "error" ? <p className={styles.loading} role="status">{remoteRecommendations.error} Standard suggestions remain available.</p> : null}

      {compact && <button type="button" className={styles.returnToDraft} onClick={onReturnToDraft}>Return to suggested players</button>}
        <div
          id="suggested-picks-cards"
          className={styles.carousel}
          hidden={collapsed || compact}
        >
        <div
          ref={cardsRef}
          className={styles.cardsRow}
          onScroll={updateScrollEdges}
          role="list"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {top.length === 0 ? (
            filtered.length === 0 ? (
              <div className={styles.loading} role="status">{isLoading ? "Loading recommendations…" : error ? "Recommendations unavailable while projection sources recover." : "No matching available players"}</div>
            ) : (
              <div className={styles.loading}>Computing suggestions…</div>
            )
          ) : (
            top.map((r, idx) => {
              const id = String(r.player.playerId);
              const name = r.player.fullName || id;
              const team =
                r.player.displayTeam || "";
              const pos = getProjectionDisplayPosition(
                r.player,
                forwardGrouping
              );
              const adp = (r.player as any).yahooAvgPick as number | undefined;
              const projFp = r.player.fantasyPoints?.projected as
                | number
                | undefined;
              const avail =
                typeof r.availability === "number" ? r.availability : undefined;
              const selected = selectedId === id;
              const compareSelected = compareSelectedIds.includes(id);
              const personalRank = personalRankByPlayerId[id];
              return (
                <article
                  key={id}
                  role="listitem"
                  className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
                  data-position={pos.split(",")[0]?.trim() || "UTIL"}
                  data-player-id={id}
                  onClick={() => onCardClick(id)}
                  tabIndex={-1}
                  title={`${name}${team ? ` · ${team}` : ""}${typeof adp === "number" ? ` · ADP ${adp.toFixed(1)}` : ""}`}
                >
                  <div className={styles.header}>
                    <div className={styles.rankBadge}>#{idx + 1}</div>
                    <div className={styles.name} title={name}>
                      {name}
                    </div>
                    <div className={styles.tagsRow}>
                      <span className={styles.tag}>VONA {typeof r.vona === "number" ? r.vona.toFixed(1) : "—"}</span>
                      {dustInsights?.has(id) && <span className={styles.tag} title="Additional scheduled games benched by lineup conflicts">DUST +{dustInsights.get(id)!.marginalDustGames}</span>}
                    </div>
                    <div className={styles.meta}>
                      {team && <span className={styles.team}>{team}</span>}
                      {pos && <span className={styles.pos}>{pos}</span>}
                    </div>
                  </div>
                  <div className={styles.statsRow}>
                    {hasPersonalRanks && (
                      <div className={styles.stat}>
                        <div className={styles.statLabel}>My Rank</div>
                        <div className={styles.statValue}>
                          {personalRank ?? "—"}
                        </div>
                      </div>
                    )}
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>Proj FP</div>
                      <div className={styles.statValue}>
                        {typeof projFp === "number" ? projFp.toFixed(1) : "—"}
                      </div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>VORP</div>
                      <div className={styles.statValue}>
                        {typeof r.vorp === "number"
                          ? r.vorp.toFixed(1)
                          : "—"}
                      </div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>VBD</div>
                      <div className={styles.statValue}>
                        {typeof r.vbd === "number" ? r.vbd.toFixed(1) : "—"}
                      </div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>ADP</div>
                      <div className={styles.statValue}>
                        {typeof adp === "number" ? adp.toFixed(1) : "—"}
                      </div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>AVL%</div>
                      <div className={styles.statValue} data-availability={avail == null ? undefined : avail >= .7 ? "high" : avail >= .3 ? "medium" : "low"} title="Probability of remaining available at your next pick">
                        {typeof avail === "number"
                          ? `${Math.round(avail * 100)}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <div className={styles.bottomRow}>
                    <div className={styles.cardFooter}>
                      {
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDraftPlayer && onDraftPlayer(id);
                          }}
                          disabled={!canDraft}
                          title={
                            canDraft
                              ? "Draft this player"
                              : "Manual drafting is locked while Yahoo sync is authoritative"
                          }
                          aria-label={`Draft ${name}`}
                        >
                          Draft
                        </button>
                      }
                      {onComparePlayer && (
                        <button
                          type="button"
                          className={styles.linkBtn}
                          aria-pressed={compareSelected}
                          aria-label={`${compareSelected ? "Remove" : "Add"} ${name} ${compareSelected ? "from" : "to"} comparison`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onComparePlayer(id);
                          }}
                        >
                          {compareSelected ? "Compared" : "Compare"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        </div>

      {/* Roster progress bar across positions */}
      {showRosterBar &&
        Array.isArray(rosterProgress) &&
        rosterProgress.length > 0 && (
          <div
            className={styles.progressBar}

            role="group"
            aria-label="Roster progress by position"
          >
            {rosterProgress.map((item) => {
              const pos = item.pos.toUpperCase();
              const pct =
                item.total > 0
                  ? Math.round((item.filled / item.total) * 100)
                  : 0;
              const isActive = selectedPositions.has(pos);
              const togglePos = () => {
                if (pos === "UTIL") {
                  // UTIL acts as a quick reset to show all
                  setSelectedPositions(new Set());
                  setPosFilter("ALL");
                  return;
                }
                setSelectedPositions((prev) => {
                  const next = new Set(prev);
                  if (next.has(pos)) {
                    next.delete(pos);
                  } else {
                    next.add(pos);
                  }
                  return next;
                });
                // Ensure dropdown is in ALL state when using segment filters
                setPosFilter("ALL");
              };
              return (
                <button
                  type="button"
                  key={pos}
                  className={`${styles.progressSegment} ${isActive ? styles.progressSegmentActive : ""}`}
                  data-position={pos}
                  aria-label={`${pos} ${item.filled} of ${item.total}`}
                  aria-pressed={isActive}
                  title={`${pos}: ${item.filled}/${item.total} (${pct}%)`}
                  onClick={togglePos}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      togglePos();
                    }
                  }}
                >
                  <div className={styles.segmentHeader}>
                    <span className={styles.segmentPos}>{pos}</span>
                    <span className={styles.segmentCount}>
                      {item.filled}/{item.total}
                    </span>
                  </div>
                  <div className={styles.segmentTrack} aria-hidden="true">
                    <div
                      className={styles.segmentFill}
                      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
    </section>
  );
};

export default SuggestedPicks;
