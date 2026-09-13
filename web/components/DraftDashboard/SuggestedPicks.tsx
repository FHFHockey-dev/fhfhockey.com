import { TierCards } from "./TierCards";
import { estimatePlayerAvailability, type SelectionHorizon } from "lib/draftDashboard/availability";
import type { PositionTiers } from "lib/draftDashboard/positionalTiers";
// components/DraftDashboard/SuggestedPicks.tsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { buildRecommendationCandidates, usePlayerRecommendations } from "hooks/usePlayerRecommendations";
import { useDraftProRecommendations } from "hooks/useDraftProRecommendations";
import styles from "./SuggestedPicks.module.scss";
import type { PickWindow } from "lib/draftDashboard/godView";
import controls from "styles/Controls.module.scss";
import type { DraftDashboardDustInsight } from "hooks/useRosterScheduleOptimizer";
import {
  getProjectionDisplayPosition,
  matchesProjectionPosition
} from "lib/draftDashboard/projectionVisibility";
import { type ForwardGrouping } from "lib/draftDashboard/forwardGrouping";
import { isGlobalShortcutBlockedTarget } from "lib/draftDashboard/keyboardShortcuts";

export interface SuggestedPicksProps {
  tierPositions?: PositionTiers[];
  tierError?: string | null;
  tierContextReady?: boolean;
  selectionHorizon?: SelectionHorizon | null;
  availabilitySpread?: number;
  onClock?: boolean;
  pickWindows?: PickWindow[];
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

const EMPTY_TIERS: PositionTiers[] = [];

const SuggestedPicks: React.FC<SuggestedPicksProps> = ({
  tierPositions = EMPTY_TIERS, tierError, tierContextReady = false,
  selectionHorizon = null, availabilitySpread = 12, onClock = false,
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
  pickWindows = [],
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
  const recommendationAccessHint = !draftProEligible
    ? " Requires Draft Pro."
    : "";
  const rosterGapDescription =
    "Adds a recommendation bonus for players at positions where you have open slots. A larger share of empty slots means a larger positional bonus. In category leagues, players who help your weak categories also get a boost. The bonus varies; it is not a fixed percentage of a player's value. Displayed VORP stays unchanged." + recommendationAccessHint;
  const filledPositionDescription =
    "As you fill a position, raises the standard used to value additional players there, generally lowering their recommendations. This changes the value comparison instead of adding a roster-needs bonus. Displayed VORP still uses the league-wide comparison." + recommendationAccessHint;
  // UI state
  type SortField = "rank" | "myRank" | "projFp" | "vorp" | "vbd" | "adp" | "avail" | "fit";
  const picksRef = React.useRef<HTMLDivElement>(null);
  const tiersRef = React.useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ start: true, end: false });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [view, setView] = useState<"picks" | "tiers">("picks");
  const tierView = view === "tiers";
  const cardsRef = tierView ? tiersRef : picksRef;
  const availableTierIds = useMemo(() => new Set(players.map(player => String(player.playerId))), [players]);
  const playerTierLabels = useMemo(() => {
    const labels = new Map<string, { position: string; label: string }[]>();
    if (!draftProEligible || tierError || isLoading || error) return labels;
    tierPositions.forEach(position => position.bands.forEach(band => {
      if (band.tier == null) return;
      band.players.forEach(player => {
        const entries = labels.get(player.id) ?? [];
        entries.push({ position: position.position, label: `${position.position} · Tier ${band.tier}` });
        labels.set(player.id, entries);
      });
    }));
    return labels;
  }, [draftProEligible, tierError, isLoading, error, tierPositions]);
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
      if (tierView && ["c", "f", "t", "o", "r"].includes(key)) return;
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
        if (draftProEligible) {
          e.preventDefault();
          onNeedWeightEnabledChange?.(!needWeightEnabled);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cardsRef, tierView, canDraft, sortField, limit, selectedId, onDraftPlayer, draftProEligible, recommendationDataOrigin, onNeedWeightEnabledChange, needWeightEnabled]);

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
    selectionHorizon,
    availabilitySpread,
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
    draftProEligible && !remoteInputOversized && recommendationCandidates.length
      ? {
          candidates: recommendationCandidates,
          dataOrigin: recommendationDataOrigin,
          leagueType: leagueType ?? "points",
          positionNeeds: posNeeds,
          categoryNeeds: catNeeds,
          categoryWeights,
          needAlpha: needWeightEnabled ? needAlpha : 0,
          currentPick,
          teamCount,
          selectionHorizon,
          availabilitySpread,
          limit: 100,
        }
      : null,
    draftProEligible && !remoteInputOversized && recommendationCandidates.length > 0,
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
    (tierView ? Array.from(new Set([...normalized, ...tierPositions.map(item => item.position)])) : normalized).forEach((p) => {
      const up = p.toUpperCase();
      const low = p.toLowerCase();
      if (low === "all" || low === "skater" || low === "goalie") return;
      if (up === "G") return; // hide raw G to prevent redundancy
      list.push(p);
    });
    return list;
  }, [forwardGrouping, players, tierView, tierPositions]);

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
      const aAvail = estimatePlayerAvailability(a.player.yahooAvgPick, selectionHorizon, availabilitySpread) ?? -1;
      const bAvail = estimatePlayerAvailability(b.player.yahooAvgPick, selectionHorizon, availabilitySpread) ?? -1;
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
  }, [selectionHorizon, availabilitySpread, dustInsights, dustSort, filtered, personalRankByPlayerId, sortField, sortDir]);

  const top = useMemo(
    () => sorted.slice(0, Math.max(1, limit)),
    [sorted, limit]
  );

  const updateScrollEdges = useCallback(() => {
    const row = cardsRef.current;
    if (row) setScrollEdges({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 });
  }, [cardsRef]);
  React.useEffect(() => {
    const row = cardsRef.current;
    if (!row) return;
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(row);
    updateScrollEdges();
    return () => observer.disconnect();
  }, [cardsRef, updateScrollEdges, top.length, rosterProgress?.length, tierView, tierPositions, posFilter]);
  React.useEffect(() => { cardsRef.current?.scrollTo({ left: 0 }); }, [cardsRef, posFilter, selectedPositions, sortField, sortDir, dustSort, limit, tierView]);
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
    if (tierView || top.length === 0 || (e.target instanceof Element && e.target.closest("button, input, select"))) return;
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
        <div role="tablist" aria-label="Suggested picks view" className={styles.viewTabs}>
          {(["picks", "tiers"] as const).map(tab => <button key={tab} id={`suggested-tab-${tab}`} type="button" role="tab" aria-selected={view === tab} aria-controls="suggested-picks-cards" tabIndex={view === tab ? 0 : -1}
            onClick={() => { setView(tab); setAdvancedOpen(false); }}
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "picks" : event.key === "End" ? "tiers" : tab === "picks" ? "tiers" : "picks";
              setView(next); setAdvancedOpen(false); document.getElementById(`suggested-tab-${next}`)?.focus();
            }}>{tab === "picks" ? "Picks" : "Tiers · Pro"}</button>)}
        </div>
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
          <div className={`${styles.controlGroup} ${tierView ? styles.sizingOnly : ""}`} aria-hidden={tierView}>
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
          <div className={`${styles.controlGroup} ${tierView ? styles.sizingOnly : ""}`} aria-hidden={tierView}>
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
            hidden={!advancedOpen || tierView}
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
          <div className={styles.controlGroup} title={rosterGapDescription}>
            <label
              className={styles.label}
              htmlFor="rosterVorpToggle"
            >
              Boost roster gaps
            </label>
            <input
              id="rosterVorpToggle"
              type="checkbox"
              checked={needWeightEnabled}
              onChange={(e) => onNeedWeightEnabledChange?.(e.target.checked)}
              disabled={!draftProEligible}
              aria-describedby="rosterGapDescription"
            />
            <span id="rosterGapDescription" hidden>{rosterGapDescription}</span>
          </div>
          <div className={styles.controlGroup} title={filledPositionDescription}>
            <label
              className={styles.label}
              htmlFor="personalReplaceToggle"
            >
              Discount filled positions
            </label>
            <input
              id="personalReplaceToggle"
              type="checkbox"
              checked={!!personalizeReplacement}
              onChange={(e) =>
                onPersonalizeReplacementChange &&
                onPersonalizeReplacementChange(e.target.checked)
              }
              disabled={!draftProEligible}
              aria-describedby="filledPositionDescription"
            />
            <span id="filledPositionDescription" hidden>{filledPositionDescription}</span>
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
            style={tierView ? { visibility: "hidden" } : undefined}
            aria-controls="suggested-picks-advanced-controls"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            Advanced
          </button>
        </div>
      </div>

      {remoteInputOversized ? <p className={styles.loading} role="status">This filtered player pool is too large for roster-aware recommendations. Narrow the position filter; no projection rows were uploaded.</p> : !draftProEligible ? null : remoteRecommendations.status === "error" ? <p className={styles.loading} role="status">{remoteRecommendations.error} Standard suggestions remain available.</p> : null}

      {compact && <button type="button" className={styles.returnToDraft} onClick={onReturnToDraft}>Return to suggested players</button>}
        <div
          id="suggested-picks-cards"
          className={styles.carousel}
          hidden={!tierView && (collapsed || compact)}
          role="tabpanel"
          aria-labelledby={`suggested-tab-${view}`}
        >
        {tierView && <div ref={tiersRef} className={`${styles.cardsRow} ${styles.tierRow}`} onScroll={updateScrollEdges} role="list" tabIndex={0}>
          {!draftProEligible ? <div className={styles.tierCard}><p>Positional tiers and pick advice require Draft Pro.</p><a href="/account?section=draft-pro">Explore Draft Pro</a></div> : tierError || isLoading || error ? <p className={styles.tierCard} role="status">{tierError || (isLoading ? "Loading positional tiers…" : "Tier analysis is unavailable while projections recover. Ordinary Picks remain available.")}</p> : <>
            <article className={styles.tierCard} role="listitem"><h3>Scoring-based tiers</h3><p>{leagueType === "categories" ? "Weighted category score" : "Custom projected fantasy points"} · {forwardGrouping === "fwd" ? "Combined forwards" : "Split forwards"}</p>
              <details><summary>How tiers and advice work</summary><p>Automatic value bands use the full projection pool. Bands wider than 5% of the positional value range are split into tighter groups at scoring boundaries. Drafted players keep their tier. A meaningful break exceeds three times the median adjacent gap and one quarter of the positional interquartile range.</p><p>Yahoo ADP estimates use a {availabilitySpread}-pick spread, conditional on availability now. Take now means fewer than 0.5 comparable players estimated to remain before a meaningful drop; Can wait requires at least 1.5, or consecutive picks. These are heuristics, not calibrated probabilities for the whole tier.</p><p>Automatic tiers do not overwrite manual tiers or reorder ordinary Picks.</p></details>
            </article>
            <TierCards positions={tierPositions} available={availableTierIds} filter={posFilter} selectedPositions={selectedPositions} horizon={selectionHorizon} spread={availabilitySpread} onClock={onClock} contextReady={tierContextReady} rosterProgress={rosterProgress} leagueType={leagueType ?? "points"} onExplore={position => { setSelectedPositions(new Set()); setPosFilter(position); }} onSelect={onCardClick} selectedId={selectedId} onDraft={onDraftPlayer} canDraft={canDraft} />
          </>}
        </div>}
        <div
          ref={picksRef}
          className={`${styles.cardsRow} ${tierView ? styles.sizingOnly : ""} ${pickWindows.length ? styles.withPickWindows : ""}`}
          aria-hidden={tierView}
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
                estimatePlayerAvailability(r.player.yahooAvgPick, selectionHorizon, availabilitySpread) ?? undefined;
              const selected = selectedId === id;
              const compareSelected = compareSelectedIds.includes(id);
              const personalRank = personalRankByPlayerId[id];
              const windowIndex = pickWindows.findIndex(window => window.offset === idx);
              const pickWindow = pickWindows[windowIndex];
              const nextOffset = pickWindows[windowIndex + 1]?.offset ?? top.length;
              const visibleSpan = Math.min(top.length, nextOffset) - idx;
              const fadeScale = pickWindow ? (nextOffset - idx) / visibleSpan : 1;
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
                  {pickWindow && <span
                    className={styles.pickWindow}
                    style={{
                      "--window-cards": visibleSpan,
                      "--fade-start": `${fadeScale * 50}%`,
                      "--fade-end": `${fadeScale * 98}%`,
                    } as React.CSSProperties}
                    aria-label={`${windowIndex === 0 ? "Your next pick" : "Upcoming pick"}, round ${pickWindow.round}, pick ${pickWindow.pickInRound}. Estimate based on displayed order.`}>
                    <span>{windowIndex === 0 ? "YOUR NEXT PICK" : `UPCOMING RD. ${pickWindow.round}, PICK ${pickWindow.pickInRound}`}</span>
                  </span>}
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
                      {playerTierLabels.get(id)?.length ? <button
                        type="button"
                        className={styles.tierBadge}
                        aria-label={`Explore positional tiers for ${name}: ${playerTierLabels.get(id)!.map(tier => tier.label).join(", ")}`}
                        onClick={event => {
                          event.stopPropagation();
                          setSelectedPositions(new Set());
                          setPosFilter(playerTierLabels.get(id)![0].position);
                          setView("tiers");
                          document.getElementById("suggested-tab-tiers")?.focus();
                        }}
                      >{playerTierLabels.get(id)!.map(tier => tier.label).join(" / ")}</button> : pos && <span className={styles.pos}>{pos}</span>}
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
                    <div className={`${styles.cardFooter} ${controls.scope}`}>
                      {
                        <button
                          type="button"
                          className={styles.linkBtn}
                          data-control-variant="primary"
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
                          data-control-variant="gold"
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
