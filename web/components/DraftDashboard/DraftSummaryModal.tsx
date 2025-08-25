import React, { useMemo, useRef, useState } from "react";
import styles from "./DraftSummaryModal.module.scss";
import type {
  DraftSettings,
  DraftedPlayer,
  TeamDraftStats
} from "./DraftDashboard";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { toPng } from "html-to-image";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import Image from "next/image";

interface DraftSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftSettings: DraftSettings;
  draftedPlayers: DraftedPlayer[];
  teamStats: TeamDraftStats[];
  allPlayers: ProcessedPlayer[];
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
}

const MAX_TEAMS_PER_ROW = 16;

export default function DraftSummaryModal({
  isOpen,
  onClose,
  draftSettings,
  draftedPlayers,
  teamStats,
  allPlayers,
  vorpMetrics
}: DraftSummaryModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"roster" | "recap">("recap");

  const playerMap = useMemo(() => {
    const m = new Map<string, ProcessedPlayer>();
    allPlayers.forEach((p) => m.set(String(p.playerId), p));
    return m;
  }, [allPlayers]);

  const sortedTeams = useMemo(() => {
    return [...teamStats]
      .slice(0, draftSettings.teamCount)
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [teamStats, draftSettings.teamCount]);

  const teamsInDraftOrder = useMemo(() => {
    const byId = new Map(sortedTeams.map((t) => [t.teamId, t]));
    return draftSettings.draftOrder
      .map((id) => byId.get(id))
      .filter((t): t is (typeof sortedTeams)[number] => !!t);
  }, [sortedTeams, draftSettings.draftOrder]);

  const chunkedRosters = useMemo(() => {
    const chunks: (typeof teamsInDraftOrder)[] = [];
    for (let i = 0; i < teamsInDraftOrder.length; i += MAX_TEAMS_PER_ROW) {
      chunks.push(teamsInDraftOrder.slice(i, i + MAX_TEAMS_PER_ROW));
    }
    return chunks;
  }, [teamsInDraftOrder]);

  const picksByTeam = useMemo(() => {
    const m = new Map<string, DraftedPlayer[]>();
    draftedPlayers.forEach((dp) => {
      if (!m.has(dp.teamId)) m.set(dp.teamId, []);
      m.get(dp.teamId)!.push(dp);
    });
    m.forEach((arr) => arr.sort((a, b) => a.pickNumber - b.pickNumber));
    return m;
  }, [draftedPlayers]);

  const totalRounds = useMemo(() => {
    const tc = draftSettings.teamCount || 12;
    return Math.max(1, Math.ceil(draftedPlayers.length / Math.max(1, tc)));
  }, [draftedPlayers.length, draftSettings.teamCount]);

  const leagueLabel =
    (draftSettings.leagueType || "points") === "categories"
      ? "Categories League"
      : "Points League";

  const highlights = useMemo(() => {
    let biggestSteal: {
      player?: ProcessedPlayer;
      teamId?: string;
      adp?: number;
      overall?: number;
      round?: number;
      pickInRound?: number;
      delta?: number;
    } = {};
    let biggestReach: typeof biggestSteal = {};
    let topVorp: {
      player?: ProcessedPlayer;
      teamId?: string;
      vorp?: number;
      overall?: number;
      round?: number;
      pickInRound?: number;
    } = {};

    const getAdp = (p?: ProcessedPlayer) => {
      const v = (p as any)?.yahooAvgPick ?? (p as any)?.adp;
      const n = typeof v === "string" ? parseFloat(v) : v;
      return typeof n === "number" && Number.isFinite(n) ? n : undefined;
    };

    draftedPlayers.forEach((dp) => {
      const p = playerMap.get(dp.playerId);
      const overall = dp.pickNumber;
      const adp = getAdp(p);

      if (adp && overall) {
        const delta = overall - adp;
        if (
          biggestSteal.delta === undefined ||
          delta > (biggestSteal.delta as number)
        ) {
          biggestSteal = {
            player: p,
            teamId: dp.teamId,
            adp,
            overall,
            round: dp.round,
            pickInRound: dp.pickInRound,
            delta
          };
        }
        if (
          biggestReach.delta === undefined ||
          delta < (biggestReach.delta as number)
        ) {
          biggestReach = {
            player: p,
            teamId: dp.teamId,
            adp,
            overall,
            round: dp.round,
            pickInRound: dp.pickInRound,
            delta
          };
        }
      }

      if (vorpMetrics) {
        const m = vorpMetrics.get(dp.playerId);
        const v = m?.vorp;
        if (typeof v === "number" && Number.isFinite(v)) {
          if (topVorp.vorp === undefined || v > (topVorp.vorp as number)) {
            topVorp = {
              player: p,
              teamId: dp.teamId,
              vorp: v,
              overall,
              round: dp.round,
              pickInRound: dp.pickInRound
            };
          }
        }
      }
    });

    return { biggestSteal, biggestReach, topVorp };
  }, [draftedPlayers, playerMap, vorpMetrics]);

  const draftWinner = useMemo(() => {
    if (!teamStats?.length) return null;
    const pts = teamStats.map((t) => t.projectedPoints);
    const vorps = teamStats.map((t) => t.teamVorp || 0);
    const minMax = (arr: number[]) => ({
      min: Math.min(...arr),
      max: Math.max(...arr)
    });
    const pmm = minMax(pts);
    const vmm = minMax(vorps);
    const norm = (x: number, mm: { min: number; max: number }) =>
      mm.max === mm.min ? 0.5 : (x - mm.min) / (mm.max - mm.min);
    const scored = teamStats.map((t) => ({
      team: t,
      score:
        0.6 * norm(t.projectedPoints, pmm) + 0.4 * norm(t.teamVorp || 0, vmm)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }, [teamStats]);

  const downloadImage = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: "#0c0f14",
        pixelRatio: 2,
        cacheBust: true,
        // Avoid cross-origin CSS font embedding errors
        // @ts-ignore: option supported in html-to-image
        skipFonts: true
      });
      const link = document.createElement("a");
      link.download = `fhfh-draft-summary-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Failed to download image", e);
    }
  };

  if (!isOpen) return null;

  const renderTeamRoster = (team: TeamDraftStats) => {
    const rosterSlots = team.rosterSlots || {};
    const bench = team.bench || [];

    const renderPlayers = (arr: DraftedPlayer[]) => (
      <ul className={styles.playerListTight}>
        {arr.map((dp) => {
          const p = playerMap.get(dp.playerId);
          return (
            <li
              key={`${team.teamId}-${dp.playerId}`}
              className={styles.playerRow}
            >
              <span
                className={styles.playerName}
                title={p?.fullName || dp.playerId}
              >
                {p?.fullName || dp.playerId}
              </span>
              <span className={styles.pickMeta}>
                R{dp.round} · P{dp.pickInRound} · #{dp.pickNumber}
              </span>
            </li>
          );
        })}
      </ul>
    );

    const rc: any = draftSettings.rosterConfig || {};
    const order: Array<{ key: string; label: string; list: DraftedPlayer[] }> =
      [];

    ["C", "LW", "RW", "D"].forEach((pos) => {
      if (rc[pos] > 0) {
        order.push({ key: pos, label: pos, list: rosterSlots[pos] || [] });
      }
    });

    if ((rc.utility || 0) > 0) {
      order.push({
        key: "UTILITY",
        label: "UTIL",
        list: rosterSlots["UTILITY"] || []
      });
    }

    if (rc.G > 0) {
      order.push({ key: "G", label: "G", list: rosterSlots["G"] || [] });
    }

    const benchRow = { key: "BENCH", label: "BN", list: bench };

    return (
      <div className={styles.rosterBox} key={team.teamId}>
        <div className={styles.rosterHeader}>{team.teamName}</div>
        <table className={styles.teamTable}>
          <tbody>
            {order.map((row) => (
              <tr key={row.key}>
                <th className={styles.posCell}>{row.label}</th>
                <td className={styles.playersCell}>
                  {row.list.length ? (
                    renderPlayers(row.list)
                  ) : (
                    <span className={styles.empty}>—</span>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <th className={styles.posCell}>{benchRow.label}</th>
              <td className={styles.playersCell}>
                {benchRow.list.length ? (
                  renderPlayers(benchRow.list)
                ) : (
                  <span className={styles.empty}>—</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderTeamRecap = (team: TeamDraftStats) => {
    const picks = picksByTeam.get(team.teamId) || [];
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < totalRounds; i++) {
      const dp = picks[i];
      if (!dp) {
        cells.push(
          <div
            key={`${team.teamId}-empty-${i}`}
            className={`${styles.pickCell} ${styles.pickEmpty}`}
          />
        );
        continue;
      }
      const p = playerMap.get(dp.playerId);
      const pos = p?.displayPosition?.split(",")[0]?.trim()?.toUpperCase();
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
                  : styles.posUTIL;
      cells.push(
        <div
          key={`${team.teamId}-${dp.pickNumber}`}
          className={`${styles.pickCell} ${posClass}`}
          title={`${p?.fullName || dp.playerId} • ${pos || "-"} • R${dp.round} P${dp.pickInRound}`}
        >
          <div className={styles.pickTop}>
            <span className={styles.pickRound}>R{dp.round}</span>
            <span className={styles.pickNum}>#{dp.pickNumber}</span>
          </div>
          <div className={styles.pickName}>{p?.fullName || dp.playerId}</div>
        </div>
      );
    }

    return (
      <div className={styles.recapBox} key={`${team.teamId}-recap`}>
        <div className={styles.recapHeader}>{team.teamName}</div>
        <div className={styles.recapCol}>{cells}</div>
      </div>
    );
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.branding}>
            <span className={styles.brandMark}>FHFH</span>
            <span className={styles.brandSub}>
              fhfhockey.com/draft-dashboard
            </span>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.toggleBtn} ${viewMode === "recap" ? styles.toggleActive : ""}`}
                onClick={() => setViewMode("recap")}
                title="Draft Recap Board"
              >
                Recap
              </button>
              <button
                className={`${styles.toggleBtn} ${viewMode === "roster" ? styles.toggleActive : ""}`}
                onClick={() => setViewMode("roster")}
                title="Roster View"
              >
                Roster
              </button>
            </div>
            <button className={styles.actionBtn} onClick={downloadImage}>
              Download PNG
            </button>
            <button className={styles.actionBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className={styles.content} ref={containerRef}>
          <div className={styles.summaryTop}>
            <h2 className={styles.title}>Draft Summary</h2>
            <div className={styles.meta}>
              {draftSettings.teamCount} Teams •{" "}
              {Object.values(draftSettings.rosterConfig).reduce(
                (a, b) => a + b,
                0
              )}{" "}
              Rounds • {leagueLabel}
            </div>
          </div>

          {draftWinner && (
            <div
              className={styles.winnerCard}
              role="region"
              aria-label="Winner of the Draft"
            >
              <div className={styles.winnerLeft}>
                <Image
                  src="/teamLogos/fhfhGoldMedal.png"
                  alt="Gold Medal"
                  width={82}
                  height={82}
                  className={styles.trophy}
                />
              </div>
              <div className={styles.winnerRight}>
                <div className={styles.winnerTitle}>Winner of the Draft</div>
                <div className={styles.winnerTeam}>
                  {draftWinner.team.teamName}
                </div>
                <div className={styles.winnerMeta}>
                  Proj Pts: {draftWinner.team.projectedPoints.toFixed(1)} • Team
                  VORP: {(draftWinner.team.teamVorp || 0).toFixed(1)}
                </div>
              </div>
            </div>
          )}

          {viewMode === "roster" ? (
            <div className={styles.rostersSection}>
              {chunkedRosters.map((row, idx) => (
                <div
                  key={idx}
                  className={styles.rostersRow}
                  style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}
                >
                  {row.map((t) => renderTeamRoster(t))}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.recapSection}>
              {chunkedRosters.map((row, idx) => (
                <div
                  key={`recap-${idx}`}
                  className={styles.recapRow}
                  style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}
                >
                  {row.map((t) => renderTeamRecap(t))}
                </div>
              ))}
            </div>
          )}

          <div className={styles.bottomGrid}>
            <div className={styles.highlightsSection}>
              <h3 className={styles.sectionTitle}>Draft Highlights</h3>
              <div className={styles.highlightsGrid}>
                <div className={styles.highlightCard}>
                  <div className={styles.highlightTitle}>
                    Biggest Steal (ADP)
                  </div>
                  {highlights.biggestSteal.player ? (
                    <div className={styles.highlightBody}>
                      <div className={styles.highlightMain}>
                        {highlights.biggestSteal.player?.fullName}
                      </div>
                      <div className={styles.highlightMeta}>
                        Team: {highlights.biggestSteal.teamId} • ADP:{" "}
                        {highlights.biggestSteal.adp?.toFixed(1)} • Pick: R
                        {highlights.biggestSteal.round} P
                        {highlights.biggestSteal.pickInRound} (#
                        {highlights.biggestSteal.overall})
                      </div>
                    </div>
                  ) : (
                    <div className={styles.highlightBody}>—</div>
                  )}
                </div>
                <div className={styles.highlightCard}>
                  <div className={styles.highlightTitle}>
                    Biggest Reach (ADP)
                  </div>
                  {highlights.biggestReach.player ? (
                    <div className={styles.highlightBody}>
                      <div className={styles.highlightMain}>
                        {highlights.biggestReach.player?.fullName}
                      </div>
                      <div className={styles.highlightMeta}>
                        Team: {highlights.biggestReach.teamId} • ADP:{" "}
                        {highlights.biggestReach.adp?.toFixed(1)} • Pick: R
                        {highlights.biggestReach.round} P
                        {highlights.biggestReach.pickInRound} (#
                        {highlights.biggestReach.overall})
                      </div>
                    </div>
                  ) : (
                    <div className={styles.highlightBody}>—</div>
                  )}
                </div>
                <div className={styles.highlightCard}>
                  <div className={styles.highlightTitle}>Top VORP Pick</div>
                  {highlights.topVorp.player ? (
                    <div className={styles.highlightBody}>
                      <div className={styles.highlightMain}>
                        {highlights.topVorp.player?.fullName}
                      </div>
                      <div className={styles.highlightMeta}>
                        Team: {highlights.topVorp.teamId} • VORP:{" "}
                        {highlights.topVorp.vorp?.toFixed(2)} • Pick: R
                        {highlights.topVorp.round} P
                        {highlights.topVorp.pickInRound} (#
                        {highlights.topVorp.overall})
                      </div>
                    </div>
                  ) : (
                    <div className={styles.highlightBody}>—</div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.leaderboardSection}>
              <h3 className={styles.sectionTitle}>Leaderboard</h3>
              <table className={styles.leaderboardTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>G</th>
                    <th>A</th>
                    <th>PPP</th>
                    <th>SOG</th>
                    <th>HIT</th>
                    <th>BLK</th>
                    <th>Team VORP</th>
                    <th>Proj Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((t) => (
                    <tr
                      key={t.teamId}
                      className={
                        t.rank === 1
                          ? styles.goldRow
                          : t.rank === 2
                            ? styles.silverRow
                            : t.rank === 3
                              ? styles.bronzeRow
                              : undefined
                      }
                    >
                      <td>{t.rank}</td>
                      <td>{t.teamName}</td>
                      <td>{(t.categoryTotals.GOALS || 0).toFixed(0)}</td>
                      <td>{(t.categoryTotals.ASSISTS || 0).toFixed(0)}</td>
                      <td>{(t.categoryTotals.PP_POINTS || 0).toFixed(0)}</td>
                      <td>
                        {(t.categoryTotals.SHOTS_ON_GOAL || 0).toFixed(0)}
                      </td>
                      <td>{(t.categoryTotals.HITS || 0).toFixed(0)}</td>
                      <td>
                        {(t.categoryTotals.BLOCKED_SHOTS || 0).toFixed(0)}
                      </td>
                      <td>{(t.teamVorp || 0).toFixed(1)}</td>
                      <td>{t.projectedPoints.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
