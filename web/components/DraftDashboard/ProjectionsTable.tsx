// components/DraftDashboard/ProjectionsTable.tsx

import React, { useState, useMemo, useEffect } from "react";
import { DraftedPlayer } from "./DraftDashboard";
// Import ProcessedPlayer from the correct location
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import styles from "./ProjectionsTable.module.scss";
import supabase from "lib/supabase";
import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";
import type { StatDefinition } from "lib/projectionsConfig/statsMasterList";
import ComparePlayersModal from "./ComparePlayersModal";

interface ProjectionsTableProps {
  players: ProcessedPlayer[];
  // Full pool including drafted; used for diagnostics cross-check
  allPlayers?: ProcessedPlayer[];
  draftedPlayers: DraftedPlayer[];
  isLoading: boolean;
  error: string | null;
  onDraftPlayer: (playerId: string) => void;
  canDraft: boolean;
  // VORP metrics map
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
  //  replacement baselines for tooltip/context
  replacementByPos?: Record<string, { vorp: number; vols: number }>;
  //  baseline mode controls
  baselineMode?: "remaining" | "full";
  onBaselineModeChange?: (mode: "remaining" | "full") => void;
  //  expected position runs before next pick
  expectedRuns?: { byPos: Record<string, number>; N: number };
  //  need-weight controls and data
  needWeightEnabled?: boolean;
  onNeedWeightChange?: (enabled: boolean) => void;
  posNeeds?: Record<string, number>; // e.g., { C: 0.5, LW: 1 }
  needAlpha?: number; // 0..1 strength of weighting, default 0.5
  onNeedAlphaChange?: (alpha: number) => void;
  // pick risk context: absolute next pick number (currentPick + picksUntilNext)
  nextPickNumber?: number;
  // league type for value semantics
  leagueType?: "points" | "categories";
  // forward grouping display mode (C/LW/RW vs FWD)
  forwardGrouping?: "split" | "fwd";
  activeCategoryKeys?: string[];
}

type SortableField =
  | keyof ProcessedPlayer
  | "fantasyPoints"
  | "score"
  | "vorp"
  | "vona"
  | "vbd"
  | "risk";

const ProjectionsTable: React.FC<ProjectionsTableProps> = ({
  players,
  allPlayers,
  draftedPlayers,
  isLoading,
  error,
  onDraftPlayer,
  canDraft,
  vorpMetrics,
  replacementByPos,
  baselineMode = "remaining",
  onBaselineModeChange,
  expectedRuns,
  needWeightEnabled = false,
  onNeedWeightChange,
  posNeeds = {},
  needAlpha = 0.5,
  onNeedAlphaChange,
  nextPickNumber,
  forwardGrouping = "split",
  leagueType = "points",
  activeCategoryKeys = []
}) => {
  const [sortField, setSortField] = useState<SortableField>("yahooAvgPick");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // Value band scope: overall or per-position (default per-position)
  const [bandScope, setBandScope] = useState<"overall" | "position">(
    "position"
  );
  // configurable risk standard deviation (in picks)
  const [riskSd, setRiskSd] = useState<number>(12);
  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("projections.favorites");
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set((Array.isArray(arr) ? arr : []).map(String));
    } catch {
      return new Set();
    }
  });
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("projections.favoritesOnly") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "projections.favorites",
        JSON.stringify(Array.from(favoriteIds))
      );
      window.localStorage.setItem(
        "projections.favoritesOnly",
        String(favoritesOnly)
      );
    } catch {}
  }, [favoriteIds, favoritesOnly]);
  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // Optional stat sort
  const [statSortKey, setStatSortKey] = useState<string>("");
  const statDefByKey = useMemo(() => {
    const m = new Map<string, StatDefinition>();
    STATS_MASTER_LIST.forEach((s) => m.set(s.key, s));
    return m;
  }, []);

  // Toggle: show stat columns instead of value columns
  const [statColumnsMode, setStatColumnsMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem("projections.statColumnsMode") === "true"
    );
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "projections.statColumnsMode",
        String(statColumnsMode)
      );
    } catch {}
  }, [statColumnsMode]);

  // 82G Proration toggle (skater counting stats pacing)
  const [prorate82, setProrate82] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("projections.prorate82") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("projections.prorate82", String(prorate82));
    } catch {}
  }, [prorate82]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.value === "boolean") {
        setProrate82(detail.value);
      }
    };
    window.addEventListener("projections:prorate82", handler as EventListener);
    return () =>
      window.removeEventListener(
        "projections:prorate82",
        handler as EventListener
      );
  }, []);

  const DEFAULT_SKATER_STAT_KEYS = [
    "GOALS",
    "ASSISTS",
    "POINTS",
    "SHOTS_ON_GOAL",
    "HITS",
    "BLOCKED_SHOTS",
    "PP_POINTS"
  ];
  const DEFAULT_GOALIE_STAT_KEYS = [
    "WINS_GOALIE",
    "GOALS_AGAINST_AVERAGE",
    "SAVE_PERCENTAGE",
    "SHUTOUTS_GOALIE"
  ];
  const statColumns = useMemo(() => {
    // If viewing only goalies, show goalie columns; otherwise show skater columns
    if (positionFilter === "G") return DEFAULT_GOALIE_STAT_KEYS;
    return DEFAULT_SKATER_STAT_KEYS;
  }, [positionFilter]);

  const handleStatHeaderSort = (key: string) => {
    if (statSortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setStatSortKey(key);
      const higher = statDefByKey.get(key)?.higherIsBetter;
      setSortDirection(higher ? "desc" : "asc");
    }
  };

  const formatStatValue = (key: string, value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "-";
    const def = statDefByKey.get(key);
    if (!def) return String(value);
    const dp = def.decimalPlaces ?? (def.dataType === "percentage" ? 1 : 0);
    if (def.dataType === "percentage") {
      return `${(value * 100).toFixed(dp)}%`;
    }
    return Number(value).toFixed(dp);
  };
  // hide drafted toggle (persisted)
  const [hideDrafted, setHideDrafted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("projections.hideDrafted");
    return v === "true";
  });
  // Temporary diagnostics toggle to surface excluded counts
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  // Cross-check results against projection source tables
  const [crosscheckRunning, setCrosscheckRunning] = useState(false);
  const [crosscheckError, setCrosscheckError] = useState<string | null>(null);
  const [crosscheckMissing, setCrosscheckMissing] = useState<
    Array<{ player_id: number; name: string | null; sourceIds: string[] }>
  >([]);
  // settings drawer visibility
  const [settingsOpen, setSettingsOpen] = useState(false);
  // compare players modal state
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand/collapse and last season totals cache per player
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [seasonTotals, setSeasonTotals] = useState<
    Record<
      string,
      {
        type: "skater" | "goalie";
        seasonLabel: string;
        data: any;
      } | null
    >
  >({});
  const [seasonLoading, setSeasonLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [seasonError, setSeasonError] = useState<Record<string, string | null>>(
    {}
  );

  const isGoaliePlayer = (player: ProcessedPlayer) => {
    const pos = player.displayPosition?.toUpperCase() || "";
    // Treat pure G or multi-position including G as goalie
    return pos
      .split(",")
      .map((p) => p.trim())
      .includes("G");
  };

  // Map raw displayPosition to UI display based on forward grouping
  const getDisplayPos = (player: ProcessedPlayer): string => {
    // Prefer Yahoo eligible positions for display when available
    const elig = Array.isArray((player as any).eligiblePositions)
      ? ((player as any).eligiblePositions as string[])
      : null;
    const raw = (player.displayPosition || "").toUpperCase();
    const pretty = elig && elig.length ? elig.join(", ") : raw;
    if (!pretty) return pretty;
    if (forwardGrouping !== "fwd") return pretty;
    const parts = raw.split(",").map((p) => p.trim());
    if (parts.includes("G")) return "G";
    if (parts.includes("D")) return "D";
    if (parts.some((p) => p === "C" || p === "LW" || p === "RW")) return "F";
    return raw;
  };

  const formatSeasonLabel = (season: string | number | null) => {
    if (season == null) return "";
    const s = String(season);
    if (s.length === 8) {
      const start = s.slice(0, 4);
      const end = s.slice(6, 8);
      return `${start}-${end}`;
    }
    return s;
  };

  const fetchLastSeasonTotals = async (player: ProcessedPlayer) => {
    const id = String(player.playerId);
    if (seasonLoading[id]) return;
    setSeasonLoading((m) => ({ ...m, [id]: true }));
    setSeasonError((m) => ({ ...m, [id]: null }));
    try {
      if (isGoaliePlayer(player)) {
        const { data, error } = await supabase
          .from("wgo_goalie_stats_totals")
          .select(
            "season_id, games_played, wins, losses, ot_losses, goals_against_avg, save_pct, shutouts, saves"
          )
          .eq("goalie_id", Number(player.playerId))
          .order("season_id", { ascending: false })
          .limit(1);
        if (error) throw error;
        const row = data?.[0] || null;
        setSeasonTotals((m) => ({
          ...m,
          [id]: row
            ? {
                type: "goalie",
                seasonLabel: formatSeasonLabel(row.season_id),
                data: row
              }
            : null
        }));
      } else {
        const { data, error } = await supabase
          .from("wgo_skater_stats_totals")
          .select(
            "season, games_played, goals, assists, points, shots, hits, blocked_shots, pp_points, toi_per_game, plus_minus, shooting_percentage, gw_goals"
          )
          .eq("player_id", Number(player.playerId))
          .order("season", { ascending: false })
          .limit(1);
        if (error) throw error;
        const row = data?.[0] || null;
        setSeasonTotals((m) => ({
          ...m,
          [id]: row
            ? {
                type: "skater",
                seasonLabel: formatSeasonLabel(row.season),
                data: row
              }
            : null
        }));
      }
    } catch (e: any) {
      setSeasonError((m) => ({ ...m, [id]: e?.message || "Failed to load" }));
    } finally {
      setSeasonLoading((m) => ({ ...m, [id]: false }));
    }
  };

  const toggleExpand = async (player: ProcessedPlayer) => {
    const id = String(player.playerId);
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
    const next = !expanded[id];
    if (next && seasonTotals[id] === undefined) {
      await fetchLastSeasonTotals(player);
    }
  };

  // Load persisted bandScope on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("projections.bandScope");
      if (saved === "overall" || saved === "position") {
        setBandScope(saved);
      }
      // Load risk SD
      const savedSd = window.localStorage.getItem("projections.riskSd");
      const v = savedSd != null ? parseFloat(savedSd) : NaN;
      if (!Number.isNaN(v) && v > 0) setRiskSd(Math.max(2, Math.min(40, v)));
      // Load position filter
      const savedPos = window.localStorage.getItem(
        "projections.positionFilter"
      );
      if (savedPos) setPositionFilter(savedPos);
      // Load sort
      const allowedSort: string[] = [
        "fullName",
        "displayPosition",
        "displayTeam",
        "yahooAvgPick",
        "fantasyPoints",
        "score",
        "vorp",
        "vona",
        "vbd",
        "risk"
      ];
      const savedSortField = window.localStorage.getItem(
        "projections.sortField"
      );
      if (savedSortField && allowedSort.includes(savedSortField)) {
        setSortField(savedSortField as SortableField);
      }
      const savedSortDir = window.localStorage.getItem(
        "projections.sortDirection"
      );
      if (savedSortDir === "asc" || savedSortDir === "desc") {
        setSortDirection(savedSortDir);
      }
    } catch {}
  }, []);

  // Persist bandScope on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("projections.bandScope", bandScope);
    } catch {}
  }, [bandScope]);

  // Persist risk SD on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("projections.riskSd", String(riskSd));
    } catch {}
  }, [riskSd]);

  // Persist hide drafted on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "projections.hideDrafted",
        String(hideDrafted)
      );
    } catch {}
  }, [hideDrafted]);

  // Persist position filter
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("projections.positionFilter", positionFilter);
    } catch {}
  }, [positionFilter]);

  // Persist sort prefs
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("projections.sortField", String(sortField));
      window.localStorage.setItem(
        "projections.sortDirection",
        String(sortDirection)
      );
    } catch {}
  }, [sortField, sortDirection]);

  // Load/persist stat sort key
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedStatKey = window.localStorage.getItem(
        "projections.statSortKey"
      );
      if (savedStatKey) setStatSortKey(savedStatKey);
    } catch {}
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!statSortKey)
        window.localStorage.removeItem("projections.statSortKey");
      else window.localStorage.setItem("projections.statSortKey", statSortKey);
    } catch {}
  }, [statSortKey]);

  useEffect(() => {
    // Exit stat sort when leaving stat columns mode
    if (!statColumnsMode && statSortKey) setStatSortKey("");
  }, [statColumnsMode]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchTerm(searchTerm), 150);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // drafted player ID set for quick checks (moved before diagnostics)
  const draftedIdSet = useMemo(() => {
    const s = new Set<string>();
    draftedPlayers?.forEach((dp) => s.add(String(dp.playerId)));
    return s;
  }, [draftedPlayers]);

  const diagnostics = useMemo(() => {
    const total = players.length;
    const q = debouncedSearchTerm.toLowerCase();
    const reasons: Record<string, number> = {};
    const inc = (k: string) => (reasons[k] = (reasons[k] || 0) + 1);
    players.forEach((p) => {
      let excluded = false;
      if (positionFilter !== "ALL") {
        const ok = getDisplayPos(p)?.includes(positionFilter);
        if (!ok) {
          inc("positionFilter");
          excluded = true;
        }
      }
      if (!excluded && q) {
        const ok =
          p.fullName.toLowerCase().includes(q) ||
          (p.displayTeam || "").toLowerCase().includes(q);
        if (!ok) {
          inc("searchFilter");
          excluded = true;
        }
      }
      if (!excluded && hideDrafted) {
        if (draftedIdSet.has(String(p.playerId))) {
          inc("hideDrafted");
          excluded = true;
        }
      }
    });
    const shown = (() => {
      // Mirror visibility logic (minus sort)
      let arr = [...players];
      if (positionFilter !== "ALL") {
        arr = arr.filter((p) => getDisplayPos(p)?.includes(positionFilter));
      }
      if (debouncedSearchTerm) {
        arr = arr.filter((p) => {
          const q2 = debouncedSearchTerm.toLowerCase();
          return (
            p.fullName.toLowerCase().includes(q2) ||
            (p.displayTeam || "").toLowerCase().includes(q2)
          );
        });
      }
      if (hideDrafted) {
        arr = arr.filter((p) => !draftedIdSet.has(String(p.playerId)));
      }
      return arr.length;
    })();
    const excluded = Math.max(0, total - shown);
    return { total, shown, excluded, reasons };
  }, [players, positionFilter, debouncedSearchTerm, hideDrafted, draftedIdSet]);

  // Build a quick lookup for each player's primary position (first listed)
  const primaryPosById = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => {
      const first = getDisplayPos(p)?.split(",")[0]?.trim()?.toUpperCase();
      if (first) m.set(String(p.playerId), first);
    });
    return m;
  }, [players, forwardGrouping]);

  // Precompute VORP/VONA/VBD for quick lookup (with need-adjusted VBD when enabled)
  const vorpMap = useMemo(() => {
    const m = new Map<
      string,
      {
        vorp: number;
        vona: number;
        vbd: number;
        bestPos?: string;
        vbdAdj: number;
        value?: number;
      }
    >();
    if (vorpMetrics) {
      vorpMetrics.forEach((metrics, id) => {
        const baseVbd = metrics.vbd;
        const posKey = (
          metrics.bestPos ||
          primaryPosById.get(String(id)) ||
          "UTIL"
        ).toUpperCase();
        const need = posNeeds[posKey] ?? 0;
        const weight = needWeightEnabled ? 1 + (need - 0.5) * 2 * needAlpha : 1;
        const vbdAdj = baseVbd * weight;
        m.set(id, {
          vorp: metrics.vorp,
          vona: metrics.vona,
          vbd: baseVbd,
          bestPos: metrics.bestPos,
          vbdAdj,
          value: metrics.value
        });
      });
    }
    return m;
  }, [vorpMetrics, needWeightEnabled, needAlpha, posNeeds, primaryPosById]);

  // Precompute pick-risk based on ADP vs next pick number using a Normal CDF model
  const normalCdf = (z: number) => {
    // Abramowitz and Stegun approximation for Phi(z)
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
    const p =
      d *
      (0.31938153 * t -
        0.356563782 * Math.pow(t, 2) +
        1.781477937 * Math.pow(t, 3) -
        1.821255978 * Math.pow(t, 4) +
        1.330274429 * Math.pow(t, 5));
    return z >= 0 ? 1 - p : p;
  };

  const riskMap = useMemo(() => {
    const m = new Map<string, number>();
    if (!players?.length || !nextPickNumber) return m;
    const sd = Math.max(2, Math.min(40, riskSd)); // clamp reasonable range
    players.forEach((p) => {
      const adp = p.yahooAvgPick;
      // Treat 0 or negative ADP as missing
      if (typeof adp === "number" && Number.isFinite(adp) && adp > 0) {
        const z = (nextPickNumber - adp) / sd;
        const risk = Math.max(0, Math.min(1, normalCdf(z)));
        m.set(String(p.playerId), risk);
      }
    });
    return m;
  }, [players, nextPickNumber, riskSd]);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = [...players];

    // Apply position filter
    if (positionFilter !== "ALL") {
      filtered = filtered.filter((player) =>
        getDisplayPos(player)?.includes(positionFilter)
      );
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (player) =>
          player.fullName.toLowerCase().includes(q) ||
          player.displayTeam?.toLowerCase().includes(q)
      );
    }

    // Apply favorites-only filter
    if (favoritesOnly) {
      filtered = filtered.filter((p) => favoriteIds.has(String(p.playerId)));
    }

    // Helper: treat ADP <= 0 as missing
    const normAdp = (v: any): number | null =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

    // Sort players
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (statSortKey) {
        const av = (a.combinedStats as any)?.[statSortKey]?.projected;
        const bv = (b.combinedStats as any)?.[statSortKey]?.projected;
        aValue = typeof av === "number" ? av : -Infinity;
        bValue = typeof bv === "number" ? bv : -Infinity;
      } else if (sortField === "fantasyPoints") {
        aValue = a.fantasyPoints.projected;
        bValue = b.fantasyPoints.projected; // fix: use 'b'
      } else if (sortField === "yahooAvgPick") {
        const aAdp = normAdp(a.yahooAvgPick);
        const bAdp = normAdp(b.yahooAvgPick);
        // Place missing ADP at bottom for asc; at top for desc
        if (aAdp == null && bAdp == null) {
          // Tie-breakers for missing ADP: project FP desc, then name asc
          const aFp = a.fantasyPoints.projected ?? -Infinity;
          const bFp = b.fantasyPoints.projected ?? -Infinity;
          if (aFp !== bFp) return bFp - aFp;
          const aName = a.fullName || "";
          const bName = b.fullName || "";
          return aName.localeCompare(bName);
        }
        if (aAdp == null) return sortDirection === "asc" ? 1 : -1;
        if (bAdp == null) return sortDirection === "asc" ? -1 : 1;
        return sortDirection === "asc" ? aAdp - bAdp : bAdp - aAdp;
      } else if (sortField === "score") {
        aValue = vorpMap.get(String(a.playerId))?.value ?? 0;
        bValue = vorpMap.get(String(b.playerId))?.value ?? 0;
      } else if (sortField === "vorp") {
        aValue = vorpMap.get(String(a.playerId))?.vorp ?? 0;
        bValue = vorpMap.get(String(b.playerId))?.vorp ?? 0;
      } else if (sortField === "vona") {
        aValue = vorpMap.get(String(a.playerId))?.vona ?? 0;
        bValue = vorpMap.get(String(b.playerId))?.vona ?? 0;
      } else if (sortField === "vbd") {
        const aM = vorpMap.get(String(a.playerId));
        const bM = vorpMap.get(String(b.playerId));
        aValue = needWeightEnabled ? (aM?.vbdAdj ?? 0) : (aM?.vbd ?? 0);
        bValue = needWeightEnabled ? (bM?.vbdAdj ?? 0) : (bM?.vbd ?? 0);
      } else if (sortField === "risk") {
        aValue = riskMap.get(String(a.playerId));
        bValue = riskMap.get(String(b.playerId));
      } else {
        if (sortField === "displayPosition") {
          aValue = getDisplayPos(a);
          bValue = getDisplayPos(b);
        } else {
          aValue = (a as any)[sortField];
          bValue = (b as any)[sortField]; // fix: use 'b'
        }
      }

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "asc" ? 1 : -1;
      if (bValue == null) return sortDirection === "asc" ? -1 : 1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [
    players,
    positionFilter,
    debouncedSearchTerm,
    sortField,
    sortDirection,
    vorpMap,
    needWeightEnabled,
    riskMap,
    statSortKey,
    favoritesOnly,
    favoriteIds
  ]);

  // Helpers for percentile calculations
  const getPrimaryPos = (p: ProcessedPlayer, bestPos?: string): string => {
    if (bandScope === "overall") return "ALL";
    if (bestPos) return bestPos;
    const first = getDisplayPos(p)?.split(",")[0]?.trim();
    return first || "ALL";
  };

  const percentileBands = useMemo(() => {
    // Consider only players left in the list
    const eligible = filteredAndSortedPlayers.filter(
      (p) =>
        // Exclude already drafted from banding; bands represent remaining pool
        !draftedIdSet.has(String(p.playerId))
    );

    // Group values by scope key (ALL or position)
    const groups: Record<string, { vbdVals: number[]; valVals: number[] }> = {};
    const pushVal = (key: string, vbd?: number | null, val?: number | null) => {
      if (!groups[key]) groups[key] = { vbdVals: [], valVals: [] };
      if (typeof vbd === "number") groups[key].vbdVals.push(vbd);
      if (typeof val === "number") groups[key].valVals.push(val);
    };

    eligible.forEach((p) => {
      const key = String(p.playerId);
      const m = vorpMap.get(key);
      // Use adjusted VBD when enabled for banding
      const vbd = needWeightEnabled ? m?.vbdAdj : m?.vbd;
      const fpOrScore =
        leagueType === "categories"
          ? (m?.value ?? null)
          : p.fantasyPoints.projected;
      const scopeKey = getPrimaryPos(p, m?.bestPos);
      pushVal(scopeKey, vbd, fpOrScore);
    });

    // Sort arrays ascending for percentile rank
    Object.values(groups).forEach((g) => {
      g.vbdVals.sort((a, b) => a - b);
      g.valVals.sort((a, b) => a - b);
    });

    const rank = (val: number, arr: number[]): number | null => {
      const n = arr.length;
      if (n < 2) return null;
      // position of last <= val
      let idx = 0;
      for (let i = 0; i < n; i++) {
        if (val >= arr[i]) idx = i;
        else break;
      }
      return n > 1 ? idx / (n - 1) : 0;
    };

    const toBand = (
      pct: number | null
    ): "valueSuccess" | "valueWarning" | "valueDanger" | null => {
      if (pct == null) return null;
      // Map deciles to 3 colors: bottom 0-30%=danger, 30-70%=warning, 70-100%=success
      if (pct >= 0.7) return "valueSuccess";
      if (pct >= 0.3) return "valueWarning";
      return "valueDanger";
    };

    const vbdBandById = new Map<string, string | null>();
    const valBandById = new Map<string, string | null>();

    eligible.forEach((p) => {
      const id = String(p.playerId);
      const m = vorpMap.get(id);
      const scopeKey = getPrimaryPos(p, m?.bestPos);
      const vbd = needWeightEnabled ? m?.vbdAdj : m?.vbd;
      const fpOrScore =
        leagueType === "categories"
          ? (m?.value ?? null)
          : p.fantasyPoints.projected;
      const g = groups[scopeKey];
      if (g) {
        const vbdPct = typeof vbd === "number" ? rank(vbd, g.vbdVals) : null;
        const valPct =
          typeof fpOrScore === "number" ? rank(fpOrScore, g.valVals) : null;
        vbdBandById.set(id, toBand(vbdPct));
        valBandById.set(id, toBand(valPct));
      } else {
        vbdBandById.set(id, null);
        valBandById.set(id, null);
      }
    });

    return { vbdBandById, valBandById };
  }, [
    filteredAndSortedPlayers,
    vorpMap,
    bandScope,
    needWeightEnabled,
    leagueType
  ]);

  const handleSort = (field: SortableField) => {
    if (statSortKey) setStatSortKey("");
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(
        field === "vorp" ||
          field === "fantasyPoints" ||
          field === "vona" ||
          field === "vbd" ||
          field === "risk"
          ? "desc"
          : "asc"
      );
    }
  };

  // Cross-check helper: fetch unique player_ids from all projection sources and compare to allPlayers
  const runCrosscheck = async () => {
    setCrosscheckRunning(true);
    setCrosscheckError(null);
    setCrosscheckMissing([]);
    try {
      // Build set of player_ids present in UI pool (include drafted via allPlayers when provided)
      const pool =
        (allPlayers && allPlayers.length ? allPlayers : players) || [];
      const uiIds = new Set<string>(pool.map((p) => String(p.playerId)));

      // Import config dynamically
      const { PROJECTION_SOURCES_CONFIG } = await import(
        "lib/projectionsConfig/projectionSourcesConfig"
      );

      // Group by tableName to avoid duplicate queries for same table
      const tableToSourceIds = new Map<string, string[]>();
      PROJECTION_SOURCES_CONFIG.forEach((cfg) => {
        const arr = tableToSourceIds.get(cfg.tableName) || [];
        arr.push(cfg.id);
        tableToSourceIds.set(cfg.tableName, arr);
      });

      type Row = {
        player_id?: number | null;
        Player_Name?: string | null;
        Goalie?: string | null;
      };
      const missing: Map<number, { name: string | null; sourceIds: string[] }> =
        new Map();

      for (const [tableName, sourceIds] of tableToSourceIds.entries()) {
        const { data, error } = await supabase
          .from(tableName as any)
          .select("player_id, Player_Name, Goalie")
          .not("player_id", "is", null);
        if (error) throw error;
        (data as Row[]).forEach((r) => {
          const id = r.player_id != null ? Number(r.player_id) : null;
          if (id == null || Number.isNaN(id)) return;
          if (!uiIds.has(String(id))) {
            const prev = missing.get(id) || {
              name: r.Player_Name || r.Goalie || null,
              sourceIds: []
            };
            sourceIds.forEach((sid) => {
              if (!prev.sourceIds.includes(sid)) prev.sourceIds.push(sid);
            });
            if (!prev.name && (r.Player_Name || r.Goalie)) {
              prev.name = (r.Player_Name as any) || (r.Goalie as any) || null;
            }
            missing.set(id, prev);
          }
        });
      }

      const out = Array.from(missing.entries())
        .map(([player_id, info]) => ({
          player_id,
          name: info.name || null,
          sourceIds: info.sourceIds.sort()
        }))
        .sort((a, b) => a.player_id - b.player_id);
      setCrosscheckMissing(out);
    } catch (e: any) {
      setCrosscheckError(e?.message || "Cross-check failed");
    } finally {
      setCrosscheckRunning(false);
    }
  };

  const handleDraftClick = (playerId: number) => {
    // Always allow drafting; assignment goes to currentTurn in parent
    onDraftPlayer(String(playerId));
  };

  // Get unique positions for filter
  const availablePositions = useMemo(() => {
    const positions = new Set<string>();
    players.forEach((player) => {
      const disp = getDisplayPos(player);
      if (disp) {
        disp.split(",").forEach((pos) => {
          positions.add(pos.trim());
        });
      }
    });
    return Array.from(positions).sort();
  }, [players, forwardGrouping]);

  const getAriaSort = (
    field: SortableField
  ): "none" | "ascending" | "descending" => {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  if (isLoading) {
    return (
      <div className={styles.projectionsContainer}>
        <div className={styles.controlsBar}>
          <h2 className={styles.panelTitle}>
            Available <span className={styles.panelTitleAccent}>Players</span>
          </h2>
        </div>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading player projections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.projectionsContainer}>
        <div className={styles.controlsBar}>
          <h2 className={styles.panelTitle}>
            Available <span className={styles.panelTitleAccent}>Players</span>
          </h2>
        </div>
        <div className={styles.errorState}>
          <p>Error loading projections:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.projectionsContainer}>
      {/* Primary Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.controlsBarTitle}>
          <h2 className={styles.panelTitle} title="Available Players">
            Available <span className={styles.panelTitleAccent}>Players</span>
          </h2>
          <div className={styles.settingsAndTooltips}>
            {/* 82G Prorate Toggle */}
            <div
              className={styles.stackedControl}
              style={{ alignItems: "flex-end" }}
            >
              <span className={styles.controlLabelMini}>82G Prorate</span>
              <div className={styles.toggleButtonsGroup}>
                <button
                  type="button"
                  className={`${styles.controlToggleBtn} ${prorate82 ? styles.controlToggleBtnActive : ""}`}
                  onClick={() => {
                    setProrate82((v) => {
                      const next = !v;
                      try {
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem(
                            "projections.prorate82",
                            String(next)
                          );
                          window.dispatchEvent(
                            new CustomEvent("projections:prorate82", {
                              detail: { value: next }
                            })
                          );
                        }
                      } catch {}
                      return next;
                    });
                  }}
                  aria-pressed={prorate82}
                  aria-label="Toggle 82-game prorated skater stats"
                  title="Display skater counting stats on 82-game pace (asterisk indicates prorated)"
                >
                  {prorate82 ? "On" : "Off"}
                </button>
              </div>
            </div>
            <div
              className={styles.stackedControl}
              style={{ alignItems: "flex-end" }}
            >
              <span className={styles.controlLabelMini}>Settings</span>
              <div className={styles.toggleButtonsGroup}>
                <button
                  type="button"
                  className={`${styles.controlToggleBtn} ${settingsOpen ? styles.controlToggleBtnActive : ""}`}
                  onClick={() => setSettingsOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={settingsOpen}
                  aria-controls="draft-settings-drawer"
                  aria-label="Open settings drawer"
                >
                  Open
                </button>
              </div>
            </div>
            <div
              className={styles.stackedControl}
              style={{ width: "auto", alignItems: "flex-end" }}
            >
              <div className={styles.infoTooltip}>
                <button
                  type="button"
                  className={styles.infoButton}
                  aria-describedby="projections-help"
                  aria-label="Legend"
                >
                  i
                </button>
                <div
                  id="projections-help"
                  role="tooltip"
                  className={styles.tooltipContent}
                >
                  <div className={styles.tooltipTitle}>Legend</div>
                  <div className={styles.tooltipBody}>
                    <ul>
                      {leagueType === "categories" && (
                        <li>
                          <strong>Score</strong>: percentile-weighted composite
                          (0–100) across your selected categories, weighted by
                          your category weights and by metric scarcity.
                        </li>
                      )}
                      <li>VORP: Value over replacement.</li>
                      <li>VONA: Over next available.</li>
                      <li>VBD: Blended draft value.</li>
                      <li>Bands: Percentile tiers.</li>
                      <li>Next-Pick %: Risk before your pick.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.primaryControls}>
          <div className={`${styles.stackedControl} ${styles.searchStack}`}>
            <span className={styles.controlLabelMini}>Search</span>
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              aria-label="Search players"
            />
          </div>
          <div className={styles.stackedControlsRow}>
            <div className={styles.stackedControl}>
              <span className={styles.controlLabelMini}>Position</span>
              <select
                id="position-filter"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className={styles.inlineSelect}
                aria-label="Position filter"
              >
                <option value="ALL">ALL</option>
                {availablePositions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.stackedControl}>
              <span className={styles.controlLabelMini}>Favorites</span>
              <div className={styles.toggleButtonsGroup}>
                <button
                  type="button"
                  className={`${styles.controlToggleBtn} ${
                    favoritesOnly ? styles.controlToggleBtnActive : ""
                  }`}
                  onClick={() => setFavoritesOnly((v) => !v)}
                  aria-pressed={favoritesOnly}
                  aria-label="Toggle favorites only"
                >
                  Only
                </button>
              </div>
            </div>
            <div className={styles.stackedControl}>
              <span className={styles.controlLabelMini}>Stat Columns</span>
              <div className={styles.toggleButtonsGroup}>
                <button
                  type="button"
                  className={`${styles.controlToggleBtn} ${
                    statColumnsMode ? styles.controlToggleBtnActive : ""
                  }`}
                  onClick={() => setStatColumnsMode((v) => !v)}
                  aria-pressed={statColumnsMode}
                  aria-label="Toggle stat columns"
                >
                  Show
                </button>
              </div>
            </div>
            <div className={styles.stackedControl}>
              <span className={styles.controlLabelMini}>Hide Drafted</span>
              <div className={styles.toggleButtonsGroup}>
                <button
                  type="button"
                  className={`${styles.controlToggleBtn} ${
                    hideDrafted ? styles.controlToggleBtnActive : ""
                  }`}
                  onClick={() => setHideDrafted((v) => !v)}
                  aria-pressed={hideDrafted}
                  aria-label="Toggle hide drafted"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className={styles.stackedControl}>
              <span className={styles.controlLabelMini}>
                Compare ({selectedIds.size})
              </span>
              <div className={styles.toggleButtonsGroup}>
                <button
                  type="button"
                  className={`${styles.controlToggleBtn} ${styles.compareLaunchButton}`}
                  onClick={() => setCompareOpen(true)}
                  disabled={selectedIds.size < 2}
                  aria-label="Open compare players"
                  title={
                    selectedIds.size < 2
                      ? "Select 2+ players in the table"
                      : "Compare selected players"
                  }
                >
                  {`Compare`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Run Forecast Row */}
      {expectedRuns && (
        <div className={styles.miniRunForecast}>
          <div className={styles.miniRunDescriptor}>
            Projected Next {expectedRuns.N} Picks by Position
          </div>
          <div className={styles.miniRunItems}>
            {" "}
            {/* new wrapper */}
            {["C", "LW", "RW", "D", "G"].map((pos) => {
              const val = Math.max(
                0,
                Math.round((expectedRuns.byPos?.[pos] ?? 0) * 10) / 10
              );
              const max = Math.max(1, expectedRuns.N || 1);
              const pct = Math.min(100, Math.round((val / max) * 100));
              return (
                <div
                  key={pos}
                  className={styles.miniRunItem}
                  title={`${pos} ${val} / ${expectedRuns.N}`}
                >
                  <span className={styles.miniRunLabel}>{pos}</span>
                  <span className={styles.miniRunBar}>
                    <span
                      className={styles.miniRunFill}
                      style={{ width: pct + "%" }}
                    />
                  </span>
                  <span className={styles.miniRunVal}>{val.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Drawer Overlay */}
      {settingsOpen && (
        <div
          className={styles.drawerOverlay}
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        />
      )}
      {settingsOpen && (
        <aside
          id="draft-settings-drawer"
          className={styles.settingsDrawer}
          role="dialog"
          aria-label="Draft advanced settings"
        >
          <div className={styles.drawerHeader}>
            <h3>Advanced Settings</h3>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className={styles.drawerClose}
              aria-label="Close settings"
            >
              ×
            </button>
          </div>
          <div className={styles.drawerContent}>
            <section className={styles.drawerSection}>
              <h4>Value Band Scope</h4>
              <select
                value={bandScope}
                onChange={(e) => setBandScope(e.target.value as any)}
                className={styles.drawerSelect}
                aria-label="Value band scope"
              >
                <option value="position">Per Position</option>
                <option value="overall">Overall</option>
              </select>
            </section>
            <section className={styles.drawerSection}>
              <h4>VORP Baseline</h4>
              <select
                value={baselineMode}
                onChange={(e) =>
                  onBaselineModeChange &&
                  onBaselineModeChange(e.target.value as any)
                }
                className={styles.drawerSelect}
                aria-label="VORP baseline mode"
              >
                <option value="remaining">Remaining (AVAIL)</option>
                <option value="full">Full Pool (ALL)</option>
              </select>
            </section>
            <section className={styles.drawerSection}>
              <h4>Need Weighting</h4>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={!!needWeightEnabled}
                  onChange={(e) =>
                    onNeedWeightChange && onNeedWeightChange(e.target.checked)
                  }
                  aria-label="Enable need weighting"
                />
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
                <span className={styles.toggleText}>Enabled</span>
              </label>
              {needWeightEnabled && (
                <div className={styles.sliderRow}>
                  <label htmlFor="need-alpha" className={styles.sliderLabel}>
                    Strength (α {needAlpha.toFixed(2)})
                  </label>
                  <input
                    id="need-alpha"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={needAlpha}
                    onChange={(e) =>
                      onNeedAlphaChange &&
                      onNeedAlphaChange(parseFloat(e.target.value))
                    }
                    className={styles.rangeInput}
                  />
                </div>
              )}
            </section>
            <section className={styles.drawerSection}>
              <h4>Risk Model</h4>
              <div className={styles.sliderRow}>
                <label htmlFor="risk-sd" className={styles.sliderLabel}>
                  SD (picks): {riskSd}
                </label>
                <input
                  id="risk-sd"
                  type="range"
                  min={2}
                  max={40}
                  step={1}
                  value={riskSd}
                  onChange={(e) => setRiskSd(parseInt(e.target.value, 10))}
                  className={styles.rangeInput}
                />
              </div>
            </section>
            <section className={styles.drawerSection}>
              <h4>Diagnostics</h4>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={showDiagnostics}
                  onChange={(e) => setShowDiagnostics(e.target.checked)}
                  aria-label="Show diagnostics"
                />
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
                <span className={styles.toggleText}>Show Excluded</span>
              </label>
              <div className={styles.drawerNote} style={{ marginTop: 8 }}>
                <button
                  onClick={runCrosscheck}
                  disabled={crosscheckRunning}
                  className={styles.collapseButton}
                  title="Cross-check source coverage"
                  aria-busy={crosscheckRunning}
                >
                  {crosscheckRunning ? "Checking…" : "Cross-check Sources"}
                </button>
                {crosscheckError && (
                  <div className={styles.errorText} style={{ marginTop: 6 }}>
                    {crosscheckError}
                  </div>
                )}
                {crosscheckMissing.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <strong>Missing from UI but present in sources:</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {crosscheckMissing.slice(0, 25).map((m) => (
                        <div key={m.player_id}>
                          {m.name || "Unknown"} (ID {m.player_id}) —{" "}
                          {m.sourceIds.join(", ")}
                        </div>
                      ))}
                      {crosscheckMissing.length > 25 && (
                        <div>…and {crosscheckMissing.length - 25} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
            {replacementByPos && (
              <section className={styles.drawerSection}>
                <h4>Replacement Baselines</h4>
                <ul className={styles.baselineList}>
                  {Object.entries(replacementByPos).map(([pos, vals]) => (
                    <li key={pos}>
                      <strong>{pos}</strong>: VORP {vals.vorp.toFixed(1)} | VOLS{" "}
                      {vals.vols.toFixed(1)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className={styles.drawerSection}>
              <h4>Value Colors</h4>
              <p className={styles.drawerNote}>
                Green = top 30%, Yellow = middle 40%, Red = bottom 30% within
                selected scope.
              </p>
            </section>
          </div>
        </aside>
      )}

      {/* Players Table */}
      <div className={styles.tableContainer}>
        <table className={styles.playersTable}>
          <colgroup>
            <col className={styles.colFav} />
            <col className={styles.colName} />
            <col className={styles.colPos} />
            <col className={styles.colTeam} />
            {!statColumnsMode && (
              <>
                <col className={styles.colFP} />
                <col className={styles.colVorp} />
                <col className={styles.colVorp} />
                <col className={styles.colVorp} />
              </>
            )}
            {statColumnsMode && (
              <>
                {statColumns.map((k) => (
                  <col key={`col-${k}`} className={styles.colStat} />
                ))}
              </>
            )}
            <col className={styles.colAdp} />
            <col className={styles.colNextPick} />
            <col className={styles.colAction} />
            <col className={styles.colCompare} />
          </colgroup>
          <thead>
            <tr>
              <th className={styles.colFav} scope="col" title="Favorite">
                Fav
              </th>
              <th
                onClick={() => handleSort("fullName")}
                className={`${styles.sortableHeader} ${styles.colName}`}
                aria-sort={getAriaSort("fullName")}
                scope="col"
              >
                Player{" "}
                {sortField === "fullName" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("displayPosition")}
                className={`${styles.sortableHeader} ${styles.colPos}`}
                aria-sort={getAriaSort("displayPosition")}
                scope="col"
              >
                Pos{" "}
                {sortField === "displayPosition" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("displayTeam")}
                className={`${styles.sortableHeader} ${styles.colTeam}`}
                aria-sort={getAriaSort("displayTeam")}
                scope="col"
              >
                Team{" "}
                {sortField === "displayTeam" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              {!statColumnsMode ? (
                <>
                  <th
                    onClick={() =>
                      handleSort(
                        leagueType === "categories"
                          ? ("score" as any)
                          : "fantasyPoints"
                      )
                    }
                    className={`${styles.sortableHeader} ${styles.colFP}`}
                    aria-sort={getAriaSort(
                      leagueType === "categories"
                        ? ("score" as any)
                        : "fantasyPoints"
                    )}
                    scope="col"
                    title={
                      leagueType === "categories"
                        ? "Score: percentile-weighted composite (0–100) across selected categories, weighted by category weights and metric scarcity."
                        : "Projected Fantasy Points"
                    }
                  >
                    {leagueType === "categories" ? "Score" : "Proj FP"}{" "}
                    {sortField ===
                      (leagueType === "categories"
                        ? "score"
                        : "fantasyPoints") &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("vorp")}
                    className={`${styles.sortableHeader} ${styles.colVorp}`}
                    title="Value Over Replacement Player"
                    aria-sort={getAriaSort("vorp")}
                    scope="col"
                  >
                    VORP{" "}
                    {sortField === "vorp" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("vona")}
                    className={`${styles.sortableHeader} ${styles.colVorp}`}
                    title="Value Over Next Available"
                    aria-sort={getAriaSort("vona")}
                    scope="col"
                  >
                    VONA{" "}
                    {sortField === "vona" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => handleSort("vbd")}
                    className={`${styles.sortableHeader} ${styles.colVorp}`}
                    title="Value Based Drafting (blend)"
                    aria-sort={getAriaSort("vbd")}
                    scope="col"
                  >
                    VBD{" "}
                    {sortField === "vbd" &&
                      (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                </>
              ) : (
                <>
                  {statColumns.map((key) => (
                    <th
                      key={`h-${key}`}
                      onClick={() => handleStatHeaderSort(key)}
                      className={`${styles.sortableHeader} ${styles.statHeader}`}
                      scope="col"
                      title={`Projected ${statDefByKey.get(key)?.displayName || key}`}
                    >
                      {statDefByKey.get(key)?.displayName || key}{" "}
                      {statSortKey === key &&
                        (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                  ))}
                </>
              )}
              <th
                onClick={() => handleSort("yahooAvgPick")}
                className={`${styles.sortableHeader} ${styles.colAdp}`}
                aria-sort={getAriaSort("yahooAvgPick")}
                scope="col"
              >
                ADP{" "}
                {sortField === "yahooAvgPick" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("risk")}
                className={`${styles.sortableHeader} ${styles.colNextPick}`}
                aria-sort={getAriaSort("risk")}
                scope="col"
                title="Probability of being drafted before your next pick (ADP-based)"
              >
                AVL%{" "}
              </th>
              <th className={styles.colAction} scope="col">
                Action
              </th>
              <th
                className={styles.colCompare}
                scope="col"
                title="Select players via right-side checkboxes; need 2+ to enable compare"
              >
                <span
                  aria-label="Compare column header"
                  title="Select players (checkboxes) then click Open to compare. Risk (AVL%) color: green low, yellow med, red high chance player is gone before next pick."
                >
                  COMP.
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const displayPlayers = (() => {
                let arr = [...filteredAndSortedPlayers];
                if (hideDrafted) {
                  arr = arr.filter(
                    (p) => !draftedIdSet.has(String(p.playerId))
                  );
                } else {
                  const undrafted = arr.filter(
                    (p) => !draftedIdSet.has(String(p.playerId))
                  );
                  const drafted = arr.filter((p) =>
                    draftedIdSet.has(String(p.playerId))
                  );
                  arr = [...undrafted, ...drafted];
                }
                return arr;
              })();

              return displayPlayers.flatMap((player) => {
                const key = String(player.playerId);
                const m = vorpMap.get(key);
                const vorp = m?.vorp ?? 0;
                const vona = m?.vona ?? 0;
                const vbdBase = m?.vbd ?? 0;
                const vbdAdj = m?.vbdAdj ?? vbdBase;
                const bestPos = m?.bestPos;
                const vbdDisplay = needWeightEnabled ? vbdAdj : vbdBase;
                const vbdBand = percentileBands.vbdBandById.get(key);
                const fpBand = percentileBands.valBandById.get(key);
                const vbdClasses = [styles.vorp, styles.valueNumeric];
                if (vbdBand) vbdClasses.push(styles.valueBand, styles[vbdBand]);
                const fpClasses = [styles.fantasyPoints, styles.valueNumeric];
                if (fpBand) fpClasses.push(styles.valueBand, styles[fpBand]);
                const risk = riskMap.get(key);
                const riskPct =
                  typeof risk === "number" ? Math.round(risk * 100) : null;
                const riskClass =
                  riskPct == null
                    ? undefined
                    : riskPct >= 70
                      ? styles.riskHigh
                      : riskPct >= 30
                        ? styles.riskMed
                        : styles.riskLow;
                const metricColumnsCount = 4; // FP/Score, VORP, VONA, VBD
                const detailColSpan =
                  1 + // favorite star
                  1 + // name
                  1 + // pos
                  1 + // team
                  (statColumnsMode ? statColumns.length : metricColumnsCount) +
                  1 + // ADP
                  1 + // Next Pick
                  1 + // Action
                  1; // Compare

                const mainRow = (
                  <tr
                    key={player.playerId}
                    className={`${styles.playerRow} ${draftedIdSet.has(key) ? styles.draftedRow : ""} ${
                      favoriteIds.has(key) ? styles.favoritedRow : ""
                    }`}
                  >
                    <td className={styles.colFav}>
                      <button
                        type="button"
                        className={`${styles.favoriteButton} ${favoriteIds.has(key) ? styles.favorited : ""}`}
                        onClick={() => toggleFavorite(key)}
                        aria-label={
                          favoriteIds.has(key)
                            ? `Unfavorite ${player.fullName}`
                            : `Favorite ${player.fullName}`
                        }
                        title={
                          favoriteIds.has(key)
                            ? "Unfavorite player"
                            : "Favorite player"
                        }
                      >
                        {favoriteIds.has(key) ? "★" : "☆"}
                      </button>
                    </td>
                    <td className={styles.playerName}>
                      <div className={styles.nameContainer}>
                        <button
                          className={styles.expandToggle}
                          onClick={() => toggleExpand(player)}
                          title={
                            expanded[key]
                              ? "Hide last season"
                              : "Show last season"
                          }
                          aria-expanded={!!expanded[key]}
                          aria-label={
                            expanded[key]
                              ? `Collapse details for ${player.fullName}`
                              : `Expand details for ${player.fullName}`
                          }
                        >
                          {expanded[key] ? "−" : "+"}
                        </button>
                        <span
                          className={styles.fullName}
                          title={player.fullName}
                        >
                          {player.fullName}
                        </span>
                      </div>
                    </td>
                    <td
                      className={styles.position}
                      title={(() => {
                        const disp = getDisplayPos(player) || "-";
                        const elig = Array.isArray(
                          (player as any).eligiblePositions
                        )
                          ? ((player as any).eligiblePositions as string[])
                          : [];
                        return elig.length
                          ? `${disp} (Eligible: ${elig.join("/")})`
                          : disp;
                      })()}
                    >
                      {getDisplayPos(player) || "-"}
                    </td>
                    <td
                      className={styles.team}
                      title={player.displayTeam || undefined}
                    >
                      {player.displayTeam || "-"}
                    </td>
                    {!statColumnsMode ? (
                      <>
                        <td className={fpClasses.join(" ")}>
                          {leagueType === "categories"
                            ? typeof m?.value === "number"
                              ? m.value.toFixed(1)
                              : "-"
                            : player.fantasyPoints.projected?.toFixed(1) || "-"}
                        </td>
                        <td
                          className={styles.vorp}
                          title={bestPos ? `Best Pos: ${bestPos}` : undefined}
                        >
                          {typeof vorp === "number" ? vorp.toFixed(1) : "-"}
                        </td>
                        <td
                          className={styles.vorp}
                          title="Value Over Next Available"
                        >
                          {typeof vona === "number" ? vona.toFixed(1) : "-"}
                        </td>
                        <td
                          className={vbdClasses.join(" ")}
                          title={
                            needWeightEnabled
                              ? "Value Based Drafting (need-adjusted)"
                              : "Value Based Drafting"
                          }
                        >
                          {typeof vbdDisplay === "number"
                            ? vbdDisplay.toFixed(1)
                            : "-"}
                        </td>
                      </>
                    ) : (
                      <>
                        {statColumns.map((k) => {
                          const val = (player.combinedStats as any)?.[k]
                            ?.projected as number | null | undefined;
                          return (
                            <td
                              key={`c-${k}-${key}`}
                              className={styles.statCol}
                            >
                              {formatStatValue(k, val)}
                            </td>
                          );
                        })}
                      </>
                    )}
                    <td className={styles.adp}>
                      {typeof player.yahooAvgPick === "number" &&
                      player.yahooAvgPick > 0
                        ? player.yahooAvgPick.toFixed(1)
                        : "-"}
                    </td>
                    <td
                      className={`${styles.nextPick} ${riskClass ? riskClass : ""}`}
                      title={
                        riskPct == null
                          ? undefined
                          : `${riskPct}% chance gone before your next pick`
                      }
                    >
                      {riskPct == null ? "-" : `${riskPct}%`}
                    </td>
                    <td className={styles.colAction}>
                      <button
                        className={styles.draftButton}
                        onClick={() => handleDraftClick(player.playerId)}
                        disabled={draftedIdSet.has(key)}
                        title={
                          draftedIdSet.has(key)
                            ? "Player already drafted"
                            : "Draft this player"
                        }
                      >
                        {draftedIdSet.has(key) ? "Drafted" : "Draft"}
                      </button>
                    </td>
                    <td className={`${styles.compareCell}`}>
                      <input
                        type="checkbox"
                        className={styles.compareCheckbox}
                        checked={selectedIds.has(key)}
                        onChange={() => toggleSelected(key)}
                        aria-label={`Select ${player.fullName} for comparison`}
                      />
                    </td>
                  </tr>
                );

                const detailRow = expanded[key] ? (
                  <tr
                    key={`${player.playerId}-details`}
                    className={styles.expandRow}
                  >
                    <td colSpan={detailColSpan}>
                      {seasonLoading[key] && (
                        <div style={{ padding: "8px 12px", opacity: 0.8 }}>
                          Loading last season totals...
                        </div>
                      )}
                      {!seasonLoading[key] && seasonError[key] && (
                        <div style={{ padding: "8px 12px", color: "#c66" }}>
                          {seasonError[key]}
                        </div>
                      )}
                      {!seasonLoading[key] &&
                        !seasonError[key] &&
                        seasonTotals[key] == null && (
                          <div style={{ padding: "8px 12px", opacity: 0.8 }}>
                            No last season totals available.
                          </div>
                        )}
                      {!seasonLoading[key] &&
                        !seasonError[key] &&
                        seasonTotals[key] && (
                          <div style={{ padding: "10px 12px" }}>
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.8,
                                marginBottom: 6
                              }}
                            >
                              Last Season: {seasonTotals[key]?.seasonLabel}
                            </div>
                            {seasonTotals[key]?.type === "skater" ? (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(110px, 1fr))",
                                  gap: 8
                                }}
                              >
                                <StatPill
                                  label="GP"
                                  value={seasonTotals[key]!.data.games_played}
                                />
                                <StatPill
                                  label="G"
                                  value={seasonTotals[key]!.data.goals}
                                />
                                <StatPill
                                  label="A"
                                  value={seasonTotals[key]!.data.assists}
                                />
                                <StatPill
                                  label="P"
                                  value={seasonTotals[key]!.data.points}
                                />
                                <StatPill
                                  label="SOG"
                                  value={seasonTotals[key]!.data.shots}
                                />
                                <StatPill
                                  label="HIT"
                                  value={seasonTotals[key]!.data.hits}
                                />
                                <StatPill
                                  label="BLK"
                                  value={seasonTotals[key]!.data.blocked_shots}
                                />
                                <StatPill
                                  label="PPP"
                                  value={seasonTotals[key]!.data.pp_points}
                                />
                                <StatPill
                                  label="TOI/G"
                                  value={
                                    seasonTotals[
                                      key
                                    ]!.data.toi_per_game?.toFixed?.(2) ??
                                    seasonTotals[key]!.data.toi_per_game
                                  }
                                />
                                <StatPill
                                  label="+/-"
                                  value={seasonTotals[key]!.data.plus_minus}
                                />
                                <StatPill
                                  label="S%"
                                  value={
                                    seasonTotals[key]!.data.shooting_percentage
                                  }
                                />
                                <StatPill
                                  label="GWG"
                                  value={seasonTotals[key]!.data.gw_goals}
                                />
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(130px, 1fr))",
                                  gap: 8
                                }}
                              >
                                <StatPill
                                  label="GP"
                                  value={seasonTotals[key]!.data.games_played}
                                />
                                <StatPill
                                  label="W-L-OT"
                                  value={`${seasonTotals[key]!.data.wins ?? 0}-${seasonTotals[key]!.data.losses ?? 0}-${seasonTotals[key]!.data.ot_losses ?? 0}`}
                                />
                                <StatPill
                                  label="SV%"
                                  value={seasonTotals[key]!.data.save_pct}
                                />
                                <StatPill
                                  label="GAA"
                                  value={
                                    seasonTotals[key]!.data.goals_against_avg
                                  }
                                />
                                <StatPill
                                  label="SO"
                                  value={seasonTotals[key]!.data.shutouts}
                                />
                                <StatPill
                                  label="SVS"
                                  value={seasonTotals[key]!.data.saves}
                                />
                              </div>
                            )}
                          </div>
                        )}
                    </td>
                  </tr>
                ) : null;

                return [mainRow, detailRow];
              });
            })()}
          </tbody>
        </table>

        {(() => {
          const anyPlayers = hideDrafted
            ? filteredAndSortedPlayers.some(
                (p) => !draftedIdSet.has(String(p.playerId))
              )
            : filteredAndSortedPlayers.length > 0;
          return !anyPlayers ? (
            <div className={styles.emptyState}>
              <p>No players found matching your filters.</p>
            </div>
          ) : null;
        })()}
      </div>

      {showDiagnostics && (
        <div
          className={styles.diagnostics}
          style={{
            margin: "8px 0 0",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            fontSize: 12
          }}
        >
          <div style={{ marginBottom: 4 }}>
            Excluded: <strong>{diagnostics.excluded}</strong> of{" "}
            <strong>{diagnostics.total}</strong> (shown {diagnostics.shown})
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.keys(diagnostics.reasons).length === 0 ? (
              <span style={{ opacity: 0.7 }}>No exclusions at present.</span>
            ) : (
              Object.entries(diagnostics.reasons).map(([k, v]) => (
                <span key={k} style={{ opacity: 0.9 }}>
                  {k}: {v}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      <ComparePlayersModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        selectedIds={Array.from(selectedIds)}
        allPlayers={allPlayers || players}
        leagueType={leagueType}
      />
    </div>
  );
};

// Simple pill component for compact stat display
const StatPill = ({ label, value }: { label: string; value: any }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "6px 8px",
      borderRadius: 6,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      fontSize: 12
    }}
    title={`${label}: ${value ?? "-"}`}
    aria-label={`${label} ${value ?? "-"}`}
  >
    <span style={{ opacity: 0.65 }}>{label}</span>
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {value == null
        ? "-"
        : typeof value === "number"
          ? Number(value).toFixed(0)
          : String(value)}
    </span>
  </div>
);

export default ProjectionsTable;
