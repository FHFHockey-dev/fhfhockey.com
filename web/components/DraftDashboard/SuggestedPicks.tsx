// components/DraftDashboard/SuggestedPicks.tsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { usePlayerRecommendations } from "hooks/usePlayerRecommendations";
import styles from "./SuggestedPicks.module.scss";

export interface SuggestedPicksProps {
  players: ProcessedPlayer[]; // available players only
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
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
}

const SuggestedPicks: React.FC<SuggestedPicksProps> = ({
  players,
  vorpMetrics,
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
  canDraft,
  personalizeReplacement,
  onPersonalizeReplacementChange
}) => {
  // UI state
  type SortField = "rank" | "projFp" | "vorp" | "vbd" | "adp" | "avail" | "fit";
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("suggested.sortField") as SortField) || "adp"
      );
    }
    return "adp";
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("suggested.sortDir") as "asc" | "desc") || "asc"
      );
    }
    return "asc";
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
  // NEW: toggle to adjust (recalculate) displayed VORP by roster needs (lightweight client multiplier)
  const [rosterVorpEnabled, setRosterVorpEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("suggested.rosterVorpEnabled") === "true";
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
    if (typeof window === "undefined") return;
    localStorage.setItem(
      "suggested.rosterVorpEnabled",
      String(rosterVorpEnabled)
    );
  }, [rosterVorpEnabled]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "select" ||
        tag === "textarea" ||
        (target as any)?.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

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
        if (selectedId && onDraftPlayer) {
          e.preventDefault();
          onDraftPlayer(selectedId);
        }
      } else if (key === "r") {
        // quick toggle roster-adjusted VORP
        e.preventDefault();
        setRosterVorpEnabled((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sortField, limit, selectedId, onDraftPlayer]);

  // Compute recommendations
  const { recommendations } = usePlayerRecommendations({
    players,
    vorpMetrics,
    posNeeds,
    needWeightEnabled,
    needAlpha,
    limit: 200, // compute a bigger set, we'll slice after sorting/filters
    baselineMode,
    currentPick,
    teamCount,
    leagueType,
    catNeeds
  });

  // Availability heuristic: Normal CDF around ADP
  const [riskSd, setRiskSd] = useState<number>(() => {
    if (typeof window === "undefined") return 12;
    const v = parseFloat(localStorage.getItem("projections.riskSd") || "12");
    return Number.isFinite(v) ? Math.max(2, Math.min(40, v)) : 12;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "projections.riskSd" && e.newValue) {
        const v = parseFloat(e.newValue);
        if (Number.isFinite(v)) setRiskSd(Math.max(2, Math.min(40, v)));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const normalCdf = (z: number) => {
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

  const withAvail = useMemo(() => {
    if (!nextPickNumber) return recommendations;
    return recommendations.map((r) => {
      const adp = (r.player as any).yahooAvgPick;
      let availability: number | undefined = r.availability;
      if (typeof adp === "number" && Number.isFinite(adp)) {
        const z = (nextPickNumber - adp) / riskSd;
        availability = Math.max(0.01, Math.min(0.99, normalCdf(z)));
      }
      return { ...r, availability };
    });
  }, [recommendations, nextPickNumber, riskSd]);

  // NEW: apply roster-need multiplier directly to VORP (does not change underlying vorpMetrics)
  const withRosterAdjustedVorp = useMemo(() => {
    if (!rosterVorpEnabled) return withAvail;
    return withAvail.map((r) => {
      const baseVorp = r.vorp ?? 0;
      const elig = (r.player.displayPosition || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((p) => p && ["C", "LW", "RW", "D", "G"].includes(p));
      if (elig.length === 0) return { ...r, vorpAdj: baseVorp };
      const avgNeed =
        elig.reduce((acc, pos) => acc + (posNeeds[pos] || 0), 0) /
        Math.max(1, elig.length);
      // Multiplier: positions fully filled (need≈0) still retain 25% of VORP; unfilled keep ~100%.
      const multiplier = 0.25 + 0.75 * Math.max(0, Math.min(1, avgNeed));
      const adj = baseVorp * multiplier;
      return { ...r, vorpAdj: adj } as typeof r & { vorpAdj: number };
    });
  }, [withAvail, rosterVorpEnabled, posNeeds]);

  // Position filter options from players
  const availablePositions = useMemo(() => {
    const raw = new Set<string>();
    players.forEach((p) => {
      p.displayPosition?.split(",")?.forEach((pos) => raw.add(pos.trim()));
    });
    // Normalize and de-duplicate by case
    const normalized = Array.from(raw)
      .filter(Boolean)
      .map((s) => s.trim())
      .filter((s, idx, arr) => arr.findIndex((t) => t.toLowerCase() === s.toLowerCase()) === idx)
      .sort();
    const lower = new Set(normalized.map((s) => s.toLowerCase()));
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
  }, [players]);

  // Apply filters: if multi-select set has items, use it; else fallback to single select
  const filtered = useMemo(() => {
    const source = withRosterAdjustedVorp;
    if (selectedPositions.size > 0) {
      return source.filter((r) => {
        const posList = (r.player.displayPosition || "")
          .split(",")
          .map((p) => p.trim());
        return posList.some((p) => selectedPositions.has(p));
      });
    }
    if (posFilter === "ALL") return source;
    if (posFilter === "Skater") {
      return source.filter((r) => {
        const posList = (r.player.displayPosition || "")
          .split(",")
          .map((p) => p.trim().toUpperCase());
        // Skater encompasses F (C,LW,RW), D, and UTIL
        return posList.some((p) => p && p !== "G");
      });
    }
    if (posFilter === "Goalie") {
      return source.filter((r) =>
        (r.player.displayPosition || "")
          .split(",")
          .map((p) => p.trim().toUpperCase())
          .includes("G")
      );
    }
    return source.filter((r) => r.player.displayPosition?.includes(posFilter));
  }, [withRosterAdjustedVorp, posFilter, selectedPositions]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mul = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const aFp = a.player.fantasyPoints?.projected ?? 0;
      const bFp = b.player.fantasyPoints?.projected ?? 0;
      const aVorp = (rosterVorpEnabled ? (a as any).vorpAdj : a.vorp) ?? 0;
      const bVorp = (rosterVorpEnabled ? (b as any).vorpAdj : b.vorp) ?? 0;
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
          return 0; // keep incoming order
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
  }, [filtered, sortField, sortDir]);

  const top = useMemo(
    () => sorted.slice(0, Math.max(1, limit)),
    [sorted, limit]
  );

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
    if (top.length === 0) return;
    const ids = top.map((r) => String(r.player.playerId));
    const idx = selectedId ? ids.indexOf(selectedId) : -1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = idx < 0 ? 0 : Math.min(ids.length - 1, idx + 1);
      setSelectedId(ids[next]);
      onSelectPlayer && onSelectPlayer(ids[next]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = idx < 0 ? 0 : Math.max(0, idx - 1);
      setSelectedId(ids[prev]);
      onSelectPlayer && onSelectPlayer(ids[prev]);
    } else if (e.key === "Enter" || e.key.toLowerCase() === "d") {
      // Draft selected player
      if (selectedId && onDraftPlayer) {
        e.preventDefault();
        onDraftPlayer(selectedId);
      }
    }
  };

  return (
    <section className={styles.suggestedContainer} aria-label="Suggested Picks">
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          Suggested <span className={styles.titleAccent}>Picks</span>
        </h2>
        <div className={styles.controls}>
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
            <label
              className={styles.label}
              htmlFor="rosterVorpToggle"
              title="Adjust VORP values by remaining roster needs"
            >
              NeedV
            </label>
            <input
              id="rosterVorpToggle"
              type="checkbox"
              checked={rosterVorpEnabled}
              onChange={(e) => setRosterVorpEnabled(e.target.checked)}
              aria-label="Toggle roster-adjusted VORP"
            />
          </div>
          <div className={styles.controlGroup}>
            <label
              className={styles.label}
              htmlFor="personalReplaceToggle"
              title="Personalize replacement baselines using your filled slots"
            >
              PR
            </label>
            <input
              id="personalReplaceToggle"
              type="checkbox"
              checked={!!personalizeReplacement}
              onChange={(e) =>
                onPersonalizeReplacementChange &&
                onPersonalizeReplacementChange(e.target.checked)
              }
              aria-label="Toggle personalized replacement baselines"
            />
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
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className={styles.cardsRow}
          role="list"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {top.length === 0 ? (
            filtered.length === 0 ? (
              <div className={styles.loading}>No matching players</div>
            ) : (
              <div className={styles.loading}>Computing suggestions…</div>
            )
          ) : (
            top.map((r, idx) => {
              const id = String(r.player.playerId);
              const name = r.player.fullName || id;
              const team =
                (r.player as any).teamAbbrev || (r.player as any).team || "";
              const pos = (r.player.displayPosition || "").split(",")[0];
              const posClass =
                pos === "C"
                  ? styles.posC
                  : pos === "LW"
                    ? styles.posLW
                    : pos === "RW"
                      ? styles.posRW
                      : pos === "D"
                        ? styles.posD
                        : pos === "G"
                          ? styles.posG
                          : pos === "UTIL"
                            ? styles.posUTIL
                            : "";
              const adp = (r.player as any).yahooAvgPick as number | undefined;
              const projFp = r.player.fantasyPoints?.projected as
                | number
                | undefined;
              const avail =
                typeof r.availability === "number" ? r.availability : undefined;
              const selected = selectedId === id;
              return (
                <article
                  key={id}
                  role="listitem"
                  className={`${styles.card} ${posClass} ${selected ? styles.cardSelected : ""}`}
                  onClick={() => onCardClick(id)}
                  tabIndex={-1}
                  title={`${name}${team ? ` · ${team}` : ""}${typeof adp === "number" ? ` · ADP ${adp.toFixed(1)}` : ""}`}
                >
                  <div className={styles.header}>
                    <div className={styles.rankBadge}>#{idx + 1}</div>
                    <div className={styles.name} title={name}>
                      {name}
                    </div>
                    <div className={styles.meta}>
                      {team && <span className={styles.team}>{team}</span>}
                      {pos && <span className={styles.pos}>{pos}</span>}
                    </div>
                  </div>
                  <div className={styles.statsRow}>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>Proj FP</div>
                      <div className={styles.statValue}>
                        {typeof projFp === "number" ? projFp.toFixed(1) : "—"}
                      </div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statLabel}>
                        {rosterVorpEnabled ? "AdjV" : "VORP"}
                      </div>
                      <div className={styles.statValue}>
                        {typeof (rosterVorpEnabled
                          ? (r as any).vorpAdj
                          : r.vorp) === "number"
                          ? (rosterVorpEnabled
                              ? (r as any).vorpAdj
                              : r.vorp)!.toFixed(1)
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
                      <div className={styles.statLabel}>Avail</div>
                      <div className={styles.statValue}>
                        {typeof avail === "number"
                          ? `${Math.round(avail * 100)}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <div className={styles.bottomRow}>
                    {Array.isArray(r.reasonTags) && r.reasonTags.length > 0 ? (
                      <div className={styles.tagsRow}>
                        {r.reasonTags.map((t, i) => (
                          <span key={i} className={styles.tag} title={t}>
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    <div className={styles.cardFooter}>
                      {
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDraftPlayer && onDraftPlayer(id);
                          }}
                          aria-label={`Draft ${name}`}
                        >
                          Draft
                        </button>
                      }
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          // placeholder for future: open player details
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          // placeholder for future: context menu / watchlist
                        }}
                      >
                        More
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

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
              const posClass =
                pos === "C"
                  ? styles.posC
                  : pos === "LW"
                    ? styles.posLW
                    : pos === "RW"
                      ? styles.posRW
                      : pos === "D"
                        ? styles.posD
                        : pos === "G"
                          ? styles.posG
                          : pos === "UTIL"
                            ? styles.posUTIL
                            : "";
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
                <div
                  key={pos}
                  className={`${styles.progressSegment} ${posClass} ${isActive ? styles.progressSegmentActive : ""}`}
                  aria-label={`${pos} ${item.filled} of ${item.total}`}
                  aria-pressed={isActive}
                  title={`${pos}: ${item.filled}/${item.total} (${pct}%)`}
                  role="button"
                  tabIndex={0}
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
                </div>
              );
            })}
          </div>
        )}
    </section>
  );
};

export default SuggestedPicks;
