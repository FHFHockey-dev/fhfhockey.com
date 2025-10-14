import { useEffect, useMemo, useState } from "react";

type TrendRow = {
  player_id: number;
  player_name: string | null;
  position_group: string;
  position_code: string | null;
  window_code: string;
  s_100: number;
  luck_pressure: number;
  z_shp: number;
  z_oishp: number;
  z_ipp: number;
  z_ppshp: number;
};

type WindowCode = "l3" | "l5" | "l10" | "l20";
type Pos = "all" | "F" | "D";
type Direction = "hot" | "cold";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrendsIndexPage() {
  const [snapshotDate, setSnapshotDate] = useState<string>(todayISO());
  const [windowCode, setWindowCode] = useState<WindowCode>("l10");
  const [pos, setPos] = useState<Pos>("all");
  const [direction, setDirection] = useState<Direction>("hot");
  const [limit, setLimit] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({
      snapshot_date: snapshotDate,
      window_code: windowCode,
      pos,
      direction,
      limit: String(limit)
    });
    return `/api/v1/sustainability/trends?${params.toString()}`;
  }, [snapshotDate, windowCode, pos, direction, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(queryUrl)
      .then((resp) => resp.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          setError(json.message || "Error loading trends.");
          setRows([]);
          return;
        }
        setRows(json.rows || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err));
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryUrl]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sustainability Trends</h1>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="flex flex-col">
          <label className="mb-1 text-sm text-gray-600">Snapshot Date</label>
          <input
            type="date"
            value={snapshotDate}
            max={todayISO()}
            onChange={(event) => setSnapshotDate(event.target.value)}
            className="rounded-lg border px-3 py-2"
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-sm text-gray-600">Window</label>
          <select
            value={windowCode}
            onChange={(event) => setWindowCode(event.target.value as WindowCode)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="l3">Last 3</option>
            <option value="l5">Last 5</option>
            <option value="l10">Last 10</option>
            <option value="l20">Last 20</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-sm text-gray-600">Position Group</label>
          <select
            value={pos}
            onChange={(event) => setPos(event.target.value as Pos)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="all">All</option>
            <option value="F">Forwards</option>
            <option value="D">Defense</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-sm text-gray-600">Direction</label>
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as Direction)}
            className="rounded-lg border px-3 py-2"
          >
            <option value="hot">Over-performing (Hot)</option>
            <option value="cold">Under-performing (Cold)</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-sm text-gray-600">Limit</label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              setLimit(Number.isNaN(next) ? 1 : next);
            }}
            className="rounded-lg border px-3 py-2"
          />
        </div>
      </div>

      {loading && <div className="mb-3 text-sm text-gray-500">Loading...</div>}
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="text-sm text-gray-500">No rows.</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Player</th>
                <th className="p-3 text-left">Pos</th>
                <th className="p-3 text-left">Window</th>
                <th className="p-3 text-right">Score (s100)</th>
                <th className="p-3 text-right">Luck pressure</th>
                <th className="p-3 text-right">z_SH%</th>
                <th className="p-3 text-right">z_oiSH%</th>
                <th className="p-3 text-right">z_IPP</th>
                <th className="p-3 text-right">z_PP SH%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.player_id}-${row.window_code}`} className="border-t">
                  <td className="p-3 font-medium">
                    {row.player_name || row.player_id}
                  </td>
                  <td className="p-3">{row.position_code || row.position_group}</td>
                  <td className="p-3">{row.window_code.toUpperCase()}</td>
                  <td className="p-3 text-right">{row.s_100.toFixed(1)}</td>
                  <td
                    className={`p-3 text-right ${
                      row.luck_pressure >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {row.luck_pressure.toFixed(3)}
                  </td>
                  <td className="p-3 text-right">{row.z_shp.toFixed(2)}</td>
                  <td className="p-3 text-right">{row.z_oishp.toFixed(2)}</td>
                  <td className="p-3 text-right">{row.z_ipp.toFixed(2)}</td>
                  <td className="p-3 text-right">{row.z_ppshp.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        Luck pressure &gt; 0 = running hot (likely regression down). &lt; 0 =
        running cold (likely bounce back).
      </div>
    </div>
  );
}
