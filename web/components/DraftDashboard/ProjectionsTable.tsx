// components/DraftDashboard/ProjectionsTable.tsx

import React, { useState, useMemo, useEffect } from "react";
import { DraftedPlayer } from "./DraftDashboard";
// Import ProcessedPlayer from the correct location
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import styles from "./ProjectionsTable.module.scss";

interface ProjectionsTableProps {
  players: ProcessedPlayer[];
  draftedPlayers: DraftedPlayer[];
  isLoading: boolean;
  error: string | null;
  onDraftPlayer: (playerId: string) => void;
  canDraft: boolean;
  // NEW: VORP metrics map
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
  // NEW: replacement baselines for tooltip/context
  replacementByPos?: Record<string, { vorp: number; vols: number }>;
  // NEW: baseline mode controls
  baselineMode?: "remaining" | "full";
  onBaselineModeChange?: (mode: "remaining" | "full") => void;
  // NEW: expected position runs before next pick
  expectedRuns?: { byPos: Record<string, number>; N: number };
  // NEW: need-weight controls and data
  needWeightEnabled?: boolean;
  onNeedWeightChange?: (enabled: boolean) => void;
  posNeeds?: Record<string, number>; // e.g., { C: 0.5, LW: 1 }
  needAlpha?: number; // 0..1 strength of weighting, default 0.5
  onNeedAlphaChange?: (alpha: number) => void;
  // NEW: pick risk context: absolute next pick number (currentPick + picksUntilNext)
  nextPickNumber?: number;
  // NEW: league type for value semantics
  leagueType?: "points" | "categories";
}

type SortableField =
  | keyof ProcessedPlayer
  | "fantasyPoints"
  | "vorp"
  | "vona"
  | "vbd"
  | "risk";

const ProjectionsTable: React.FC<ProjectionsTableProps> = ({
  players,
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
  nextPickNumber
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
  // NEW: configurable risk standard deviation (in picks)
  const [riskSd, setRiskSd] = useState<number>(12);

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

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchTerm(searchTerm), 150);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Build a quick lookup for each player's primary position (first listed)
  const primaryPosById = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => {
      const first = p.displayPosition?.split(",")[0]?.trim()?.toUpperCase();
      if (first) m.set(String(p.playerId), first);
    });
    return m;
  }, [players]);

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
          vbdAdj
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
      if (typeof adp === "number" && Number.isFinite(adp)) {
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
        player.displayPosition?.includes(positionFilter)
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

    // Sort players
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === "fantasyPoints") {
        aValue = a.fantasyPoints.projected;
        bValue = b.fantasyPoints.projected; // fix: use 'b'
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
        aValue = (a as any)[sortField];
        bValue = (b as any)[sortField]; // fix: use 'b'
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
    riskMap
  ]);

  // Helpers for percentile calculations
  const getPrimaryPos = (p: ProcessedPlayer, bestPos?: string): string => {
    if (bandScope === "overall") return "ALL";
    if (bestPos) return bestPos;
    const first = p.displayPosition?.split(",")[0]?.trim();
    return first || "ALL";
  };

  const percentileBands = useMemo(() => {
    // Consider only players left in the list that have ADP
    const eligible = filteredAndSortedPlayers.filter(
      (p) => typeof p.yahooAvgPick === "number" && !Number.isNaN(p.yahooAvgPick)
    );

    // Group values by scope key (ALL or position)
    const groups: Record<string, { vbdVals: number[]; fpVals: number[] }> = {};
    const pushVal = (key: string, vbd?: number | null, fp?: number | null) => {
      if (!groups[key]) groups[key] = { vbdVals: [], fpVals: [] };
      if (typeof vbd === "number") groups[key].vbdVals.push(vbd);
      if (typeof fp === "number") groups[key].fpVals.push(fp);
    };

    eligible.forEach((p) => {
      const key = String(p.playerId);
      const m = vorpMap.get(key);
      // Use adjusted VBD when enabled for banding
      const vbd = needWeightEnabled ? m?.vbdAdj : m?.vbd;
      const fp = p.fantasyPoints.projected;
      const scopeKey = getPrimaryPos(p, m?.bestPos);
      pushVal(scopeKey, vbd, fp);
    });

    // Sort arrays ascending for percentile rank
    Object.values(groups).forEach((g) => {
      g.vbdVals.sort((a, b) => a - b);
      g.fpVals.sort((a, b) => a - b);
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
    const fpBandById = new Map<string, string | null>();

    eligible.forEach((p) => {
      const id = String(p.playerId);
      const m = vorpMap.get(id);
      const scopeKey = getPrimaryPos(p, m?.bestPos);
      const vbd = needWeightEnabled ? m?.vbdAdj : m?.vbd;
      const fp = p.fantasyPoints.projected;
      const g = groups[scopeKey];
      if (g) {
        const vbdPct = typeof vbd === "number" ? rank(vbd, g.vbdVals) : null;
        const fpPct = typeof fp === "number" ? rank(fp, g.fpVals) : null;
        vbdBandById.set(id, toBand(vbdPct));
        fpBandById.set(id, toBand(fpPct));
      } else {
        vbdBandById.set(id, null);
        fpBandById.set(id, null);
      }
    });

    return { vbdBandById, fpBandById };
  }, [filteredAndSortedPlayers, vorpMap, bandScope, needWeightEnabled]);

  const handleSort = (field: SortableField) => {
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

  const handleDraftClick = (playerId: number) => {
    if (canDraft) {
      onDraftPlayer(String(playerId));
    }
  };

  // Get unique positions for filter
  const availablePositions = useMemo(() => {
    const positions = new Set<string>();
    players.forEach((player) => {
      if (player.displayPosition) {
        player.displayPosition.split(",").forEach((pos) => {
          positions.add(pos.trim());
        });
      }
    });
    return Array.from(positions).sort();
  }, [players]);

  const getAriaSort = (
    field: SortableField
  ): "none" | "ascending" | "descending" => {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  if (isLoading) {
    return (
      <div className={styles.projectionsContainer}>
        <div className={styles.panelHeader}>
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
        <div className={styles.panelHeader}>
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
      {/* Header */}
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Available <span className={styles.panelTitleAccent}>Players</span>
        </h2>
        <div className={styles.headerActions}>
          {/* Moved run forecast below filters */}
          <div className={styles.scopeToggle}>
            <label htmlFor="band-scope" style={{ fontSize: "12px" }}>
              Scope
            </label>
            <select
              id="band-scope"
              className={styles.scopeSelect}
              value={bandScope}
              onChange={(e) => setBandScope(e.target.value as any)}
              title="Value band scope"
            >
              <option value="overall">Overall</option>
              <option value="position">Per Position</option>
            </select>
          </div>
          <div className={styles.scopeToggle}>
            <label htmlFor="baseline-mode" style={{ fontSize: "12px" }}>
              Baseline
            </label>
            <select
              id="baseline-mode"
              className={styles.scopeSelect}
              value={baselineMode}
              onChange={(e) =>
                onBaselineModeChange &&
                onBaselineModeChange(e.target.value as any)
              }
              title="VORP baseline source"
            >
              <option value="remaining">Remaining</option>
              <option value="full">Full Pool</option>
            </select>
          </div>
          {/* NEW: Need weighting toggle */}
          <div className={styles.scopeToggle}>
            <label htmlFor="need-weight" style={{ fontSize: "12px" }}>
              Need
            </label>
            <input
              id="need-weight"
              type="checkbox"
              checked={!!needWeightEnabled}
              onChange={(e) =>
                onNeedWeightChange && onNeedWeightChange(e.target.checked)
              }
              title="Weight VBD by your positional needs"
              style={{ width: 16, height: 16 }}
            />
          </div>
          {needWeightEnabled && (
            <div
              className={styles.scopeToggle}
              title="Adjust need weighting strength (alpha)"
            >
              <label htmlFor="need-alpha" style={{ fontSize: "12px" }}>
                α
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
                style={{ width: 80 }}
              />
              <span style={{ fontSize: 12, width: 28, textAlign: "right" }}>
                {Number(needAlpha).toFixed(2)}
              </span>
            </div>
          )}
          {/* NEW: Risk model sensitivity */}
          <div
            className={styles.scopeToggle}
            title="Risk model standard deviation (picks)"
          >
            <label htmlFor="risk-sd" style={{ fontSize: "12px" }}>
              Risk SD
            </label>
            <input
              id="risk-sd"
              type="range"
              min={2}
              max={40}
              step={1}
              value={riskSd}
              onChange={(e) => setRiskSd(parseInt(e.target.value, 10))}
              style={{ width: 100 }}
            />
            <span style={{ fontSize: 12, width: 24, textAlign: "right" }}>
              {riskSd}
            </span>
          </div>
          <div className={styles.infoTooltip}>
            <button
              type="button"
              className={styles.infoButton}
              aria-describedby="projections-help"
              aria-label="How to use Available Players table"
            >
              i
            </button>
            <div
              id="projections-help"
              role="tooltip"
              className={styles.tooltipContent}
            >
              <div className={styles.tooltipTitle}>Draft Value Metrics</div>
              <div className={styles.tooltipBody}>
                <p>
                  VORP: Projected points over a replacement-level player at the
                  same position for your league size and roster settings.
                </p>
                <p>
                  VONA: Projected points over the player likely to be available
                  at your next pick, based on expected position run-outs.
                </p>
                <p>
                  VBD: Blended draft value: 60% VORP, 30% VONA, 10% VOLS (last
                  starter over replacement).
                </p>
                <p>
                  Value bands: VBD and Proj FP cells are tinted by percentile
                  among remaining players (
                  {bandScope === "position" ? "per-position" : "overall"}).
                  Green = top, Yellow = middle, Red = bottom. Only players with
                  ADP are included.
                </p>
                <p>
                  Baselines:{" "}
                  {baselineMode === "remaining"
                    ? "Remaining players"
                    : "Full player pool"}{" "}
                  determine replacement levels for VORP/VOLS.
                </p>
                {replacementByPos && (
                  <div className={styles.tooltipBaselines}>
                    <div className={styles.tooltipSubTitle}>
                      Current replacement baselines
                    </div>
                    <ul>
                      {Object.entries(replacementByPos).map(([pos, vals]) => (
                        <li key={pos}>
                          {pos}: VORP base {vals.vorp.toFixed(1)}, VOLS base{" "}
                          {vals.vols.toFixed(1)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {needWeightEnabled && (
                  <p className={styles.tooltipFootnote}>
                    Need weighting active: VBD is adjusted by your positional
                    needs (α={needAlpha}).
                  </p>
                )}
                <p className={styles.tooltipFootnote}>
                  Tip: Hover VORP to see a player’s best position for VORP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.positionFilter}>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className={styles.positionSelect}
          >
            <option value="ALL">All Positions</option>
            {availablePositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>
        {/* NEW: Position Run Forecast under the search bar, full-width */}
        {expectedRuns && (
          <div
            className={`${styles.runForecast} ${styles.runForecastWide}`}
            title="Expected players taken at each position before your next pick"
          >
            <div className={styles.runTitle}>
              Next {expectedRuns.N} projected picks by position
            </div>
            <div className={styles.runBars}>
              {(["C", "LW", "RW", "D", "G"] as const).map((pos) => {
                const val = Math.max(
                  0,
                  Math.round((expectedRuns.byPos?.[pos] ?? 0) * 10) / 10
                );
                const max = Math.max(1, expectedRuns.N || 1);
                const pct = Math.min(100, Math.round((val / max) * 100));
                return (
                  <div key={pos} className={styles.runRow}>
                    <span className={styles.runPosPill}>{pos}</span>
                    <div
                      className={styles.runBar}
                      aria-label={`${pos} expected ${val} of ${expectedRuns.N}`}
                    >
                      <div
                        className={styles.runBarFill}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={styles.runCount}>{val.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Players Table */}
      <div className={styles.tableContainer}>
        <table className={styles.playersTable}>
          <colgroup>
            <col className={styles.colName} />
            <col className={styles.colPos} />
            <col className={styles.colTeam} />
            <col className={styles.colFP} />
            <col className={styles.colVorp} />
            <col className={styles.colVorp} />
            <col className={styles.colVorp} />
            <col className={styles.colAdp} />
            <col className={styles.colNextPick} />
            <col className={styles.colAction} />
          </colgroup>
          <thead>
            <tr>
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
              <th
                onClick={() => handleSort("fantasyPoints")}
                className={`${styles.sortableHeader} ${styles.colFP}`}
                aria-sort={getAriaSort("fantasyPoints")}
                scope="col"
              >
                Proj FP{" "}
                {sortField === "fantasyPoints" &&
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
                {sortField === "vorp" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              {/* NEW: VONA and VBD columns */}
              <th
                onClick={() => handleSort("vona")}
                className={`${styles.sortableHeader} ${styles.colVorp}`}
                title="Value Over Next Available"
                aria-sort={getAriaSort("vona")}
                scope="col"
              >
                VONA{" "}
                {sortField === "vona" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                onClick={() => handleSort("vbd")}
                className={`${styles.sortableHeader} ${styles.colVorp}`}
                title="Value Based Drafting (blend)"
                aria-sort={getAriaSort("vbd")}
                scope="col"
              >
                VBD{" "}
                {sortField === "vbd" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
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
                title="Probability drafted before your next pick (ADP-based)"
              >
                Next-Pick %{" "}
              </th>
              <th className={styles.colAction} scope="col">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPlayers.map((player) => {
              const key = String(player.playerId);
              const m = vorpMap.get(key);
              const vorp = m?.vorp ?? 0;
              const vona = m?.vona ?? 0;
              const vbdBase = m?.vbd ?? 0;
              const vbdAdj = m?.vbdAdj ?? vbdBase;
              const bestPos = m?.bestPos;
              const vbdDisplay = needWeightEnabled ? vbdAdj : vbdBase;
              const vbdBand = percentileBands.vbdBandById.get(key);
              const fpBand = percentileBands.fpBandById.get(key);
              const vbdClasses = [styles.vorp, styles.valueNumeric];
              if (vbdBand) vbdClasses.push(styles.valueBand, styles[vbdBand]);
              const fpClasses = [styles.fantasyPoints, styles.valueNumeric];
              if (fpBand) fpClasses.push(styles.valueBand, styles[fpBand]);
              const risk = riskMap.get(key);
              const riskPct =
                typeof risk === "number" ? Math.round(risk * 100) : null;
              const riskLabel =
                riskPct == null
                  ? "-"
                  : riskPct >= 70
                    ? "High"
                    : riskPct >= 30
                      ? "Med"
                      : "Low";
              return (
                <tr key={player.playerId} className={styles.playerRow}>
                  <td className={styles.playerName}>
                    <div className={styles.nameContainer}>
                      <span className={styles.fullName} title={player.fullName}>
                        {player.fullName}
                      </span>
                    </div>
                  </td>
                  <td
                    className={styles.position}
                    title={player.displayPosition || undefined}
                  >
                    {player.displayPosition || "-"}
                  </td>
                  <td
                    className={styles.team}
                    title={player.displayTeam || undefined}
                  >
                    {player.displayTeam || "-"}
                  </td>
                  <td className={fpClasses.join(" ")}>
                    {player.fantasyPoints.projected?.toFixed(1) || "-"}
                  </td>
                  <td
                    className={styles.vorp}
                    title={bestPos ? `Best Pos: ${bestPos}` : undefined}
                  >
                    {vorp ? vorp.toFixed(1) : "-"}
                  </td>
                  <td className={styles.vorp} title="Value Over Next Available">
                    {vona ? vona.toFixed(1) : "-"}
                  </td>
                  <td
                    className={vbdClasses.join(" ")}
                    title={
                      needWeightEnabled
                        ? "Value Based Drafting (need-adjusted)"
                        : "Value Based Drafting"
                    }
                  >
                    {vbdDisplay ? vbdDisplay.toFixed(1) : "-"}
                  </td>
                  <td className={styles.adp}>
                    {player.yahooAvgPick?.toFixed(1) || "-"}
                  </td>
                  <td
                    className={styles.nextPick}
                    title={
                      riskPct == null
                        ? undefined
                        : `${riskPct}% chance gone by your next pick`
                    }
                  >
                    {riskPct == null ? "-" : `${riskLabel} (${riskPct}%)`}
                  </td>
                  <td className={styles.colAction}>
                    <button
                      className={styles.draftButton}
                      onClick={() => handleDraftClick(player.playerId)}
                      disabled={!canDraft}
                    >
                      Draft
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedPlayers.length === 0 && (
          <div className={styles.emptyState}>
            <p>No players found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectionsTable;
