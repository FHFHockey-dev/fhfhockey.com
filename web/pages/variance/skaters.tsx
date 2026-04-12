import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase";
import { parseMinimumGamesPlayedInput } from "components/Variance/varianceFilters";
import {
  buildSkaterVarianceRows,
  type SkaterVarianceGameRow,
  type SkaterVarianceRow
} from "components/Variance/skaterVariance";

import styles from "./variance.module.scss";

type SortDirection = "ascending" | "descending";
type SortKey = keyof SkaterVarianceRow;

const SKATER_SELECT_FIELDS = [
  "player_id",
  "player_name",
  "team_abbrev",
  "current_team_abbreviation",
  "position_code",
  "date",
  "season_id",
  "games_played",
  "points",
  "goals",
  "assists",
  "shots",
  "toi_per_game"
].join(",");

const PAGE_SIZE = 1000;

const columns: Array<{
  key: SortKey;
  label: string;
  title?: string;
  format?: (value: SkaterVarianceRow[SortKey]) => string;
}> = [
  { key: "playerName", label: "Player" },
  { key: "team", label: "Team" },
  { key: "position", label: "Pos" },
  { key: "gamesPlayed", label: "GP" },
  {
    key: "productionProxy",
    label: "Prod",
    title: "Neutral v1 production proxy: points plus 0.1 shots.",
    format: (value) => formatNumber(value)
  },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "shots", label: "SOG" },
  {
    key: "toiPerGame",
    label: "TOI/GP",
    title: "Average time on ice per game from wgo_skater_stats.",
    format: formatToi
  },
  {
    key: "gameVolatility",
    label: "Game Vol",
    title: "Standard deviation of the neutral production proxy by game.",
    format: (value) => formatNumber(value)
  }
];

const formatNumber = (value: unknown, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "N/A";

function formatToi(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function fetchLatestSeasonId() {
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("season_id")
    .not("season_id", "is", null)
    .order("season_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.season_id === "number" ? data.season_id : null;
}

async function fetchSeasonSkaterRows(seasonId: number) {
  const rows: SkaterVarianceGameRow[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("wgo_skater_stats")
      .select(SKATER_SELECT_FIELDS)
      .eq("season_id", seasonId)
      .gt("games_played", 0)
      .order("date", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    rows.push(...(((data ?? []) as unknown) as SkaterVarianceGameRow[]));

    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }

    page += 1;
  }
}

const compareValues = (
  aValue: SkaterVarianceRow[SortKey],
  bValue: SkaterVarianceRow[SortKey],
  direction: SortDirection
) => {
  const aMissing =
    aValue == null || (typeof aValue === "number" && !Number.isFinite(aValue));
  const bMissing =
    bValue == null || (typeof bValue === "number" && !Number.isFinite(bValue));

  if (aMissing && bMissing) {
    return 0;
  }

  if (aMissing) {
    return 1;
  }

  if (bMissing) {
    return -1;
  }

  if (typeof aValue === "string" && typeof bValue === "string") {
    const result = aValue.localeCompare(bValue);
    return direction === "ascending" ? result : -result;
  }

  const result = Number(aValue) - Number(bValue);
  return direction === "ascending" ? result : -result;
};

export default function VarianceSkatersPage() {
  const [rows, setRows] = useState<SkaterVarianceRow[]>([]);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minimumGamesPlayed, setMinimumGamesPlayed] = useState(0);
  const [minimumGamesPlayedInput, setMinimumGamesPlayedInput] = useState("0");
  const [minimumGamesPlayedError, setMinimumGamesPlayedError] =
    useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("productionProxy");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");

  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      setLoading(true);
      setError(null);

      try {
        const latestSeasonId = await fetchLatestSeasonId();

        if (!latestSeasonId) {
          throw new Error("No skater season is available.");
        }

        const gameRows = await fetchSeasonSkaterRows(latestSeasonId);
        const nextRows = buildSkaterVarianceRows(gameRows);

        if (!cancelled) {
          setSeasonId(latestSeasonId);
          setRows(nextRows);
        }
      } catch (loadError) {
        console.error("Error loading skater variance rows:", loadError);
        if (!cancelled) {
          setError("Skater variance data is unavailable.");
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRows();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => row.gamesPlayed >= minimumGamesPlayed),
    [minimumGamesPlayed, rows]
  );

  const sortedRows = useMemo(
    () =>
      [...filteredRows]
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const result = compareValues(
            a.row[sortKey],
            b.row[sortKey],
            sortDirection
          );

          return result === 0 ? a.index - b.index : result;
        })
        .map(({ row }) => row),
    [filteredRows, sortDirection, sortKey]
  );

  const handleMinimumGamesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value;
    setMinimumGamesPlayedInput(nextValue);
    const parsed = parseMinimumGamesPlayedInput(
      nextValue,
      minimumGamesPlayed
    );
    setMinimumGamesPlayed(parsed.minimumGamesPlayed);
    setMinimumGamesPlayedError(parsed.error);
  };

  const requestSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }

    setSortKey(key);
    setSortDirection(
      key === "playerName" || key === "team" || key === "position"
        ? "ascending"
        : "descending"
    );
  };

  const getSortIndicator = (key: SortKey) => {
    if (key !== sortKey) {
      return "";
    }

    return sortDirection === "ascending" ? " ▲" : " ▼";
  };

  return (
    <>
      <Head>
        <title>Variance Skaters | FHFHockey</title>
        <meta
          name="description"
          content="First live MVP table for the Variance skaters surface."
        />
      </Head>

      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Variance</p>
          <h1 className={styles.title}>Skaters</h1>
          <p className={styles.description}>
            First MVP table built from existing skater game rows. Production is
            a neutral points-plus-shot-volume proxy, not the goalie fantasy
            model.
          </p>
          <Link className={styles.backLink} href="/variance">
            Back to Variance
          </Link>
        </header>

        <section className={styles.tableSection}>
          <div className={styles.tableToolbar}>
            <div>
              <h2 className={styles.tableTitle}>Skater Variance MVP</h2>
              <p className={styles.tableMeta}>
                {seasonId ? `Season ${seasonId}` : "Latest available season"}
              </p>
            </div>

            <label className={styles.inputGroup} htmlFor="skaters-min-games">
              <span>Minimum GP</span>
              <input
                id="skaters-min-games"
                className={styles.textInput}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minimumGamesPlayedInput}
                onChange={handleMinimumGamesChange}
                placeholder="0"
                aria-invalid={Boolean(minimumGamesPlayedError)}
              />
              <small>
                {minimumGamesPlayedError ?? "Empty input shows all skaters."}
              </small>
            </label>
          </div>

          {loading ? (
            <p className={styles.statusText}>Loading skater rows...</p>
          ) : error ? (
            <p className={styles.statusText}>{error}</p>
          ) : sortedRows.length === 0 ? (
            <p className={styles.statusText}>
              No skaters match the current Minimum GP filter.
            </p>
          ) : (
            <div className={styles.tableScroller}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        onClick={() => requestSort(column.key)}
                        title={column.title}
                      >
                        {column.label}
                        {getSortIndicator(column.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.playerId}>
                      {columns.map((column) => {
                        const value = row[column.key];
                        const formatted = column.format
                          ? column.format(value)
                          : String(value ?? "N/A");

                        return <td key={column.key}>{formatted}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
