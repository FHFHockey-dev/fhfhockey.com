import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "./start-chart.module.scss";

type StartChartPlayer = {
  player_id: number;
  name: string;
  positions: string[];
  ownership: number | null;
  percent_ownership: number | null;
  opponent_abbrev: string | null;
  team_abbrev: string | null;
  proj_fantasy_points: number | null;
  proj_goals: number | null;
  proj_assists: number | null;
  proj_shots: number | null;
  matchup_grade: number | null;
};

type ApiResponse = {
  dateUsed: string;
  projections: number;
  players: StartChartPlayer[];
  ctpi: { date: string; value: number | null }[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const POSITION_ORDER = ["C", "LW", "RW", "D", "G"] as const;

export default function StartChartPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [ownershipMin, setOwnershipMin] = useState(50);
  const [posFilter, setPosFilter] = useState<Record<string, boolean>>({
    C: true,
    LW: true,
    RW: true,
    D: true,
    G: true
  });

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/v1/start-chart?date=${date}`,
    fetcher
  );

  useEffect(() => {
    mutate();
  }, [date, mutate]);

  const filteredByUi = useMemo(() => {
    if (!data?.players) return [];
    return data.players.filter((p) => {
      const owned = p.ownership ?? p.percent_ownership ?? 0;
      const passesOwnership = owned >= ownershipMin;
      const passesSearch = !search
        ? true
        : p.name.toLowerCase().includes(search.toLowerCase());
      const hasAllowedPos = p.positions.some((pos) => posFilter[pos]);
      return passesOwnership && passesSearch && hasAllowedPos;
    });
  }, [data?.players, ownershipMin, search, posFilter]);

  const playersByPos = useMemo(() => {
    const map = new Map<string, StartChartPlayer[]>();
    POSITION_ORDER.forEach((p) => map.set(p, []));
    filteredByUi.forEach((p) => {
      p.positions.forEach((pos) => {
        if (map.has(pos)) {
          map.get(pos)!.push(p);
        }
      });
    });
    POSITION_ORDER.forEach((pos) => {
      map.set(
        pos,
        (map.get(pos) ?? []).sort(
          (a, b) =>
            (b.proj_fantasy_points ?? 0) - (a.proj_fantasy_points ?? 0)
        )
      );
    });
    return map;
  }, [filteredByUi]);

  const ctpiData = useMemo(() => {
    if (!data?.ctpi) return [];
    return data.ctpi.filter((d) => d.value != null);
  }, [data?.ctpi]);

  const togglePos = (pos: string) =>
    setPosFilter((prev) => ({ ...prev, [pos]: !prev[pos] }));

  return (
    <div className={styles.page}>
      <Head>
        <title>Start Chart</title>
      </Head>

      <section className={styles.chartPanel}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>CTPI Pulse</div>
          <div className={styles.meta}>Date: {data?.dateUsed ?? date}</div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ctpiData}>
            <XAxis dataKey="date" tick={{ fill: "#9ea7b3" }} />
            <YAxis domain={[0, 100]} width={30} tick={{ fill: "#9ea7b3" }} />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.8)",
                border: "1px solid #333",
                color: "#fff"
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary-color, #3bd4ae)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Positions</label>
          <div className={styles.checkboxRow}>
            {POSITION_ORDER.map((pos) => (
              <label key={pos}>
                <input
                  type="checkbox"
                  checked={posFilter[pos]}
                  onChange={() => togglePos(pos)}
                />{" "}
                {pos}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>Ownership ≥ {ownershipMin}%</label>
          <input
            className={styles.rangeInput}
            type="range"
            min={0}
            max={100}
            value={ownershipMin}
            onChange={(e) => setOwnershipMin(Number(e.target.value))}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Search</label>
          <input
            className={styles.search}
            placeholder="Player name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className={styles.columns}>
        {POSITION_ORDER.map((pos) => {
          const list = playersByPos.get(pos) ?? [];
          const className = `${styles.column} ${
            styles[`pos${pos as typeof pos}`]
          }`;
          return (
            <div className={className} key={pos}>
              <div className={styles.columnHeader}>
                <span>{pos}</span>
                <span className={styles.pill}>{list.length}</span>
              </div>
              {isLoading ? (
                <div className={styles.meta}>Loading...</div>
              ) : list.length === 0 ? (
                <div className={styles.emptyState}>No players.</div>
              ) : (
                list.map((p) => (
                  <div className={styles.card} key={`${pos}-${p.player_id}`}>
                    <div>
                      <div className={styles.name}>{p.name}</div>
                      <div className={styles.meta}>
                        {p.team_abbrev ?? "??"} vs {p.opponent_abbrev ?? "??"}
                      </div>
                      <div className={styles.meta}>
                        Own:{" "}
                        {p.percent_ownership != null
                          ? `${p.percent_ownership.toFixed(1)}%`
                          : "n/a"}
                      </div>
                    </div>
                    <div>
                      <div className={styles.statRow}>
                        <span>Pts</span>
                        <strong>
                          {(p.proj_fantasy_points ?? 0).toFixed(2)}
                        </strong>
                      </div>
                      <div className={styles.statRow}>
                        <span>G/A/S</span>
                        <strong>
                          {(p.proj_goals ?? 0).toFixed(2)} /{" "}
                          {(p.proj_assists ?? 0).toFixed(2)} /{" "}
                          {(p.proj_shots ?? 0).toFixed(2)}
                        </strong>
                      </div>
                      <div className={styles.statRow}>
                        <span>Matchup</span>
                        <strong>{p.matchup_grade ?? "--"}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
