// =============================
// /web/pages/trends/skaters/[playerId].tsx
// =============================

import { useRouter } from "next/router";
import useSWR from "swr";
import type { PlayerSkoSnapshot } from "lib/trends/types";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PlayerSkoPage() {
  const router = useRouter();
  const playerId = Number(router.query.playerId);
  const { data } = useSWR<PlayerSkoSnapshot>(
    Number.isFinite(playerId)
      ? `/api/trends/players?action=player&playerId=${playerId}`
      : null,
    fetcher
  );

  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;

  const radarData = [
    { key: "Skill (Off)", value: data.components.skillOffense },
    { key: "Skill (Def)", value: data.components.skillDefense },
    { key: "On-Ice Impact", value: data.components.onIceImpact },
    {
      key: "Luck Inflation (↓ better)",
      value: 100 - data.components.luckInflation
    }
  ];

  const trendMock = Array.from({ length: 12 }).map((_, i) => ({
    x: `M${i + 1}`,
    P: 40 + Math.random() * 30,
    xP: 38 + Math.random() * 25
  }));

  return (
    <div style={{ padding: 24, display: "grid", gap: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{data.player_name}</h1>
          <div style={{ opacity: 0.7 }}>{data.role}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>sKO</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>
            {data.components.sustainability}
          </div>
        </div>
      </header>

      <section
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
      >
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart outerRadius={110} data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="key" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar
                name="Profile"
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendMock}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="P"
                name="Points"
                stroke="#8884d8"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="xP"
                name="Expected Points"
                stroke="#82ca9d"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h3>Deltas</h3>
        <ul>
          {Object.entries(data.deltas).map(([k, v]) => (
            <li key={k}>
              <strong>{k}</strong>: {typeof v === "number" ? v.toFixed(3) : "—"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
