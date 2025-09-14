import React, { useEffect, useMemo, useRef } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";
import styles from "./ComparePlayersModal.module.scss";
import { teamsInfo } from "lib/teamsInfo";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type Props = {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  allPlayers: ProcessedPlayer[];
  leagueType?: "points" | "categories";
};

export default function ComparePlayersModal({
  open,
  onClose,
  selectedIds,
  allPlayers,
  leagueType = "points"
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const el = dialogRef.current;
        if (!el) return;
        const focusables = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => !n.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const players = useMemo(() => {
    const idSet = new Set(selectedIds);
    return allPlayers.filter((p) => idSet.has(String(p.playerId))).slice(0, 2);
  }, [allPlayers, selectedIds]);

  const metricKeys = useMemo(() => {
    // Choose default metrics per likely type; mix of scoring & volume
    const defaultsSkater = [
      "GOALS",
      "ASSISTS",
      "PP_POINTS",
      "SHOTS_ON_GOAL",
      "HITS",
      "BLOCKED_SHOTS"
    ];
    const defaultsGoalie = [
      "WINS_GOALIE",
      "SAVE_PERCENTAGE",
      "GOALS_AGAINST_AVERAGE",
      "SHUTOUTS_GOALIE"
    ];
    // If any selected is goalie, use goalie metrics; else skater
    const anyGoalie = players.some((p) =>
      String(p.displayPosition || "")
        .toUpperCase()
        .split(",")
        .map((s) => s.trim())
        .includes("G")
    );
    return anyGoalie ? defaultsGoalie : defaultsSkater;
  }, [players]);

  const { labels, rows, leftAvg, rightAvg } = useMemo(() => {
    const defs = STATS_MASTER_LIST.filter((d) => metricKeys.includes(d.key));
    const labels = defs.map((d) => d.displayName);
    // Build percentiles across allPlayers for fairness
    const getVal = (p: ProcessedPlayer, key: string) =>
      (p.combinedStats as any)?.[key]?.projected as number | null | undefined;
    const byKeySorted = new Map<string, number[]>();
    defs.forEach((d) => {
      const vals = allPlayers
        .map((p) => getVal(p, d.key))
        .filter((v): v is number => typeof v === "number" && isFinite(v))
        .sort((a, b) => a - b);
      byKeySorted.set(d.key, vals);
    });
    const percentile = (arr: number[], x: number, higherIsBetter: boolean) => {
      if (!arr.length) return 50;
      const idx = arr.findIndex((v) => v >= x);
      const rank = idx < 0 ? arr.length : idx + 1;
      let pct = (rank / arr.length) * 100;
      if (!higherIsBetter) pct = 100 - pct;
      return Math.max(0, Math.min(100, pct));
    };
    const left = players[0];
    const right = players[1];
    const leftData = left
      ? defs.map((d) => {
          const v = getVal(left, d.key);
          if (typeof v !== "number" || !isFinite(v)) return 50;
          return percentile(byKeySorted.get(d.key) || [], v, d.higherIsBetter);
        })
      : [];
    const rightData = right
      ? defs.map((d) => {
          const v = getVal(right, d.key);
          if (typeof v !== "number" || !isFinite(v)) return 50;
          return percentile(byKeySorted.get(d.key) || [], v, d.higherIsBetter);
        })
      : [];

    const rows = defs.map((d, i) => ({
      key: d.key,
      label: d.displayName,
      p1: leftData[i] ?? 0,
      p2: rightData[i] ?? 0
    }));
    const leftAvg = leftData.length
      ? leftData.reduce((a, b) => a + b, 0) / leftData.length
      : 0;
    const rightAvg = rightData.length
      ? rightData.reduce((a, b) => a + b, 0) / rightData.length
      : 0;
    return { labels, rows, leftAvg, rightAvg };
  }, [players, allPlayers, metricKeys]);

  const left = players[0];
  const right = players[1];
  // Use assets.nhle.com mugshots first, then fall back to CMS bamgrid headshots
  // Example: https://assets.nhle.com/mugs/nhl/20242025/TBL/8476453.png
  const DEFAULT_SEASON_ID = "20242025";
  const buildHeadshotList = (p?: ProcessedPlayer) => {
    if (!p) return [] as string[];
    const teamAbbr = (p.displayTeam || "").toUpperCase();
    const seasonId = DEFAULT_SEASON_ID;
    const id = String(p.playerId);
    const srcs: string[] = [];
    if (teamAbbr && seasonId) {
      srcs.push(
        `https://assets.nhle.com/mugs/nhl/${seasonId}/${teamAbbr}/${id}.png`
      );
    }
    srcs.push(
      `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${id}.jpg`
    );
    return srcs;
  };
  const leftImgs = buildHeadshotList(left);
  const rightImgs = buildHeadshotList(right);
  const leftImgRef = useRef(0);
  const rightImgRef = useRef(0);
  const radarOpts = {
    responsive: true,
    scales: {
      r: { suggestedMin: 0, suggestedMax: 100, ticks: { display: true } }
    },
    plugins: { legend: { display: false } }
  } as const;
  const leftData = {
    labels,
    datasets: [
      {
        label: left?.fullName || "Player 1",
        data: rows.map((r) => r.p1),
        backgroundColor: "rgba(78,121,255,0.4)",
        borderColor: "rgba(78,121,255,1)",
        borderWidth: 1
      }
    ]
  } as const;
  const rightData = {
    labels,
    datasets: [
      {
        label: right?.fullName || "Player 2",
        data: rows.map((r) => r.p2),
        backgroundColor: "rgba(255,99,132,0.4)",
        borderColor: "rgba(255,99,132,1)",
        borderWidth: 1
      }
    ]
  } as const;

  const overallWinner =
    leftAvg === rightAvg ? null : leftAvg > rightAvg ? "left" : "right";

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare Players"
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Compare Players</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className={styles.closeBtn}
          >
            ×
          </button>
        </div>
        <div className={styles.grid3}>
          <div
            className={styles.playerCard}
            style={{
              // Use team primary color as accent where available
              // fall back to primary-color if team not known
              // CSS var consumed by SCSS (e.g., borders/glows)
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              "--accent":
                (left?.displayTeam &&
                  teamsInfo[left.displayTeam]?.primaryColor) ||
                undefined
            }}
          >
            {left && (
              <>
                <div className={styles.playerHeader}>
                  <img
                    className={styles.headshot}
                    // Try assets.nhle.com first, then CMS bamgrid
                    src={leftImgs[leftImgRef.current]}
                    alt={left.fullName}
                    onError={(e) => {
                      const next = leftImgRef.current + 1;
                      if (next < leftImgs.length) {
                        leftImgRef.current = next;
                        (e.currentTarget as HTMLImageElement).src =
                          leftImgs[next];
                      }
                    }}
                  />
                  <div className={styles.nameAndLogo}>
                    <div className={styles.playerName}>{left.fullName}</div>
                    {left.displayTeam && (
                      <img
                        className={styles.teamLogo}
                        src={`/teamLogos/${left.displayTeam}.png`}
                        alt={left.displayTeam}
                      />
                    )}
                  </div>
                </div>
                <div className={styles.radarWrap}>
                  <Radar
                    data={leftData as any}
                    options={{
                      ...radarOpts,
                      scales: {
                        r: {
                          suggestedMin: 0,
                          suggestedMax: 100,
                          grid: { color: "rgba(255,255,255,0.25)" },
                          angleLines: { color: "rgba(255,255,255,0.25)" },
                          pointLabels: { color: "rgba(255,255,255,0.8)" },
                          ticks: {
                            display: true,
                            color: "rgba(255,255,255,0.8)"
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className={styles.statList}>
                  {rows.map((r) => (
                    <div key={`l-${r.key}`} className={styles.statRow}>
                      <span className={styles.statLabel}>{r.label}</span>
                      <span className={styles.statVal}>{Math.round(r.p1)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className={styles.compareTableWrap}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th className={styles.thLeft}>
                    {left?.fullName || "Player 1"}
                  </th>
                  <th className={styles.thAdv}>Advantage</th>
                  <th className={styles.thRight}>
                    {right?.fullName || "Player 2"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const leftWins = r.p1 > r.p2;
                  const rightWins = r.p2 > r.p1;
                  const arrow = leftWins ? "←" : rightWins ? "→" : "=";
                  const gradientClass = leftWins
                    ? styles.advLeft
                    : rightWins
                      ? styles.advRight
                      : styles.advNeutral;
                  return (
                    <tr key={`row-${r.key}`}>
                      <td
                        className={`${styles.tdLeft} ${leftWins ? styles.winCell : ""}`}
                      >
                        {Math.round(r.p1)}
                      </td>
                      <td className={`${styles.tdAdv} ${gradientClass}`}>
                        <span className={styles.advArrow}>{arrow}</span>
                        <span className={styles.advLabel}>{r.label}</span>
                      </td>
                      <td
                        className={`${styles.tdRight} ${rightWins ? styles.winCell : ""}`}
                      >
                        {Math.round(r.p2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {players.length === 2 && (
              <div
                className={`${styles.winnerCard} ${overallWinner === "left" ? styles.winnerLeft : overallWinner === "right" ? styles.winnerRight : ""}`}
              >
                {overallWinner === null
                  ? "It’s a tie on average percentile."
                  : `${overallWinner === "left" ? left?.fullName : right?.fullName} wins overall`}
              </div>
            )}
          </div>
          <div
            className={styles.playerCard}
            style={{
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              "--accent":
                (right?.displayTeam &&
                  teamsInfo[right.displayTeam]?.primaryColor) ||
                undefined
            }}
          >
            {right && (
              <>
                <div className={styles.playerHeader}>
                  <img
                    className={styles.headshot}
                    src={rightImgs[rightImgRef.current]}
                    alt={right?.fullName || ""}
                    onError={(e) => {
                      const next = rightImgRef.current + 1;
                      if (next < rightImgs.length) {
                        rightImgRef.current = next;
                        (e.currentTarget as HTMLImageElement).src =
                          rightImgs[next];
                      }
                    }}
                  />
                  <div className={styles.nameAndLogo}>
                    <div className={styles.playerName}>{right.fullName}</div>

                    {right.displayTeam && (
                      <img
                        className={styles.teamLogo}
                        src={`/teamLogos/${right.displayTeam}.png`}
                        alt={right.displayTeam}
                      />
                    )}
                  </div>
                </div>
                <div className={styles.radarWrap}>
                  <Radar
                    data={rightData as any}
                    options={{
                      ...radarOpts,
                      scales: {
                        r: {
                          suggestedMin: 0,
                          suggestedMax: 100,
                          grid: { color: "rgba(255,255,255,0.25)" },
                          angleLines: { color: "rgba(255,255,255,0.25)" },
                          pointLabels: { color: "rgba(255,255,255,0.8)" },
                          ticks: {
                            display: true,
                            color: "rgba(255,255,255,0.8)"
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className={styles.statList}>
                  {rows.map((r) => (
                    <div key={`r-${r.key}`} className={styles.statRow}>
                      <span className={styles.statLabel}>{r.label}</span>
                      <span className={styles.statVal}>{Math.round(r.p2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
