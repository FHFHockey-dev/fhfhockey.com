import { useEffect, useMemo, useState } from "react";

import {
  attachSkaterFantasyPoints,
  buildSkaterValueOverviewRowsFromAggregates,
  buildSkaterWeeklyAggregates
} from "./skaterCalculations";
import {
  buildSkaterAdvancedMetricsRows,
  buildSkaterMetricsRows,
  DEFAULT_SELECTED_SKATER_SCORING_KEYS,
  DEFAULT_SKATER_SCORING_SETTINGS,
  SKATER_SCORING_CATEGORIES,
  withSkaterMetricsBucketAverages,
  withSkaterValueOverviewBucketAverages
} from "./skaterMetrics";
import {
  DEFAULT_MINIMUM_PERCENT_DRAFTED,
  parseMinimumGamesPlayedInput,
  parseMinimumPercentDraftedInput
} from "./skaterFilters";
import SkaterAdvancedMetricsTable from "./SkaterAdvancedMetricsTable";
import SkaterTable from "./SkaterTable";
import type {
  SkaterFantasyPointSettings,
  SkaterFantasyStatKey,
  SkaterGameRow,
  SkaterMetricsRow,
  SkaterValuationMode,
  SkaterValueOverviewRow,
  SkaterWeek,
  YahooSkaterRow
} from "./skaterTypes";

import styles from "pages/variance/variance.module.scss";

type TabKey = "value" | "metrics" | "advanced";
type SortDirection = "ascending" | "descending";

interface SkaterLeaderboardProps {
  seasonId: number | null;
  gameRows: SkaterGameRow[];
  yahooRows: YahooSkaterRow[];
  matchupWeeks: SkaterWeek[];
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "value", label: "Value Overview" },
  { key: "metrics", label: "Metrics" },
  { key: "advanced", label: "Advanced Analytics" }
];

export default function SkaterLeaderboard({
  seasonId,
  gameRows,
  yahooRows,
  matchupWeeks
}: SkaterLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("value");
  const [valuationMode, setValuationMode] =
    useState<SkaterValuationMode>("ownership");
  const [selectedScoringKeys, setSelectedScoringKeys] = useState<
    SkaterFantasyStatKey[]
  >([...DEFAULT_SELECTED_SKATER_SCORING_KEYS]);
  const [scoringSettings, setScoringSettings] =
    useState<Partial<SkaterFantasyPointSettings>>({
      ...DEFAULT_SKATER_SCORING_SETTINGS
    });
  const [draftScoringSettings, setDraftScoringSettings] =
    useState<Partial<SkaterFantasyPointSettings>>({
      ...DEFAULT_SKATER_SCORING_SETTINGS
    });
  const [minimumGamesPlayed, setMinimumGamesPlayed] = useState(0);
  const [minimumGamesPlayedInput, setMinimumGamesPlayedInput] = useState("0");
  const [minimumGamesPlayedError, setMinimumGamesPlayedError] =
    useState<string | null>(null);
  const [minimumPercentDrafted, setMinimumPercentDrafted] = useState(
    DEFAULT_MINIMUM_PERCENT_DRAFTED
  );
  const [minimumPercentDraftedInput, setMinimumPercentDraftedInput] =
    useState(String(DEFAULT_MINIMUM_PERCENT_DRAFTED));
  const [minimumPercentDraftedError, setMinimumPercentDraftedError] =
    useState<string | null>(null);
  const [averageComparisonBasis, setAverageComparisonBasis] =
    useState<"weekly" | "game">("weekly");
  const [valueSortKey, setValueSortKey] =
    useState<keyof SkaterValueOverviewRow>("totalFantasyPoints");
  const [valueSortDirection, setValueSortDirection] =
    useState<SortDirection>("descending");
  const [metricsSortKey, setMetricsSortKey] =
    useState<keyof SkaterMetricsRow>("points");
  const [metricsSortDirection, setMetricsSortDirection] =
    useState<SortDirection>("descending");

  const rowsWithFantasyPoints = useMemo(
    () =>
      attachSkaterFantasyPoints(
        gameRows,
        scoringSettings,
        selectedScoringKeys
      ),
    [gameRows, scoringSettings, selectedScoringKeys]
  );

  const weeklyAggregates = useMemo(
    () =>
      buildSkaterWeeklyAggregates(rowsWithFantasyPoints, {
        valuationMode,
        yahooRows,
        matchupWeeks,
        minimumPercentDrafted
      }),
    [
      matchupWeeks,
      minimumPercentDrafted,
      rowsWithFantasyPoints,
      valuationMode,
      yahooRows
    ]
  );

  const valueRows = useMemo(() => {
    const playerRows = buildSkaterValueOverviewRowsFromAggregates(
      rowsWithFantasyPoints,
      weeklyAggregates,
      {
        valuationMode,
        averageComparisonBasis
      }
    ).filter((row) => row.gamesPlayed >= minimumGamesPlayed);

    return withSkaterValueOverviewBucketAverages(playerRows);
  }, [
    averageComparisonBasis,
    minimumGamesPlayed,
    rowsWithFantasyPoints,
    valuationMode,
    weeklyAggregates
  ]);

  const metricsRows = useMemo(() => {
    const playerRows = buildSkaterMetricsRows(
      gameRows,
      weeklyAggregates,
      valuationMode
    ).filter((row) => row.gamesPlayed >= minimumGamesPlayed);

    return withSkaterMetricsBucketAverages(playerRows);
  }, [gameRows, minimumGamesPlayed, valuationMode, weeklyAggregates]);

  const advancedRows = useMemo(
    () =>
      buildSkaterAdvancedMetricsRows(
        gameRows,
        weeklyAggregates,
        valuationMode
      ).filter((row) => row.gamesPlayed >= minimumGamesPlayed),
    [gameRows, minimumGamesPlayed, valuationMode, weeklyAggregates]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setScoringSettings(draftScoringSettings);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [draftScoringSettings]);

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

  const handleMinimumPercentDraftedChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value;
    setMinimumPercentDraftedInput(nextValue);
    const parsed = parseMinimumPercentDraftedInput(
      nextValue,
      minimumPercentDrafted
    );
    setMinimumPercentDrafted(parsed.minimumPercentDrafted);
    setMinimumPercentDraftedError(parsed.error);
  };

  const toggleScoringKey = (key: SkaterFantasyStatKey) => {
    setSelectedScoringKeys((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key]
    );
  };

  const updateScoringValue = (key: SkaterFantasyStatKey, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    setDraftScoringSettings((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : 0
    }));
  };

  const requestValueSort = (key: keyof SkaterValueOverviewRow) => {
    if (key === valueSortKey) {
      setValueSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }

    setValueSortKey(key);
    setValueSortDirection(
      key === "playerName" || key === "team"
        ? "ascending"
        : key === "tier" || key === "valuation"
          ? valuationMode === "ownership"
            ? "descending"
            : "ascending"
          : "descending"
    );
  };

  const requestMetricsSort = (key: keyof SkaterMetricsRow) => {
    if (key === metricsSortKey) {
      setMetricsSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }

    setMetricsSortKey(key);
    setMetricsSortDirection(
      key === "playerName" || key === "team"
        ? "ascending"
        : key === "valuation"
          ? valuationMode === "ownership"
            ? "descending"
            : "ascending"
          : "descending"
    );
  };

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableToolbar}>
        <div>
          <h2 className={styles.tableTitle}>Skater Variance</h2>
          <p className={styles.tableMeta}>
            {seasonId
              ? `Season ${seasonId} | WGO rows ${gameRows.length} | Yahoo rows ${yahooRows.length} | Weeks ${matchupWeeks.length}`
              : "Latest available season"}
          </p>
        </div>
      </div>

      <div className={styles.controlPanel}>
        <div className={styles.segmentGroup} aria-label="Valuation mode">
          <button
            className={`${styles.segmentButton} ${
              valuationMode === "ownership" ? styles.segmentButtonActive : ""
            }`}
            type="button"
            onClick={() => setValuationMode("ownership")}
          >
            Relative to Ownership
          </button>
          <button
            className={`${styles.segmentButton} ${
              valuationMode === "adp" ? styles.segmentButtonActive : ""
            }`}
            type="button"
            onClick={() => setValuationMode("adp")}
          >
            Relative to ADP
          </button>
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
          <small>{minimumGamesPlayedError ?? "Empty input shows all skaters."}</small>
        </label>

        {valuationMode === "adp" ? (
          <label
            className={styles.inputGroup}
            htmlFor="skaters-min-percent-drafted"
          >
            <span>Minimum % Drafted</span>
            <input
              id="skaters-min-percent-drafted"
              className={styles.textInput}
              type="text"
              inputMode="decimal"
              value={minimumPercentDraftedInput}
              onChange={handleMinimumPercentDraftedChange}
              placeholder="0.5"
              aria-invalid={Boolean(minimumPercentDraftedError)}
            />
            <small>
              {minimumPercentDraftedError ??
                "Below this value is labeled LOW %D."}
            </small>
          </label>
        ) : null}

        <label className={styles.inputGroup} htmlFor="skaters-average-basis">
          <span>+/- Avg Basis</span>
          <select
            id="skaters-average-basis"
            className={styles.textInput}
            value={averageComparisonBasis}
            onChange={(event) =>
              setAverageComparisonBasis(event.target.value as "weekly" | "game")
            }
          >
            <option value="weekly">Weekly</option>
            <option value="game">Per game</option>
          </select>
          <small>Controls the peer average comparison column.</small>
        </label>
      </div>

      <div className={styles.scoringGrid}>
        {SKATER_SCORING_CATEGORIES.map((category) => (
          <label className={styles.scoringItem} key={category.key}>
            <span>
              <input
                type="checkbox"
                checked={selectedScoringKeys.includes(category.key)}
                onChange={() => toggleScoringKey(category.key)}
              />
              {category.label}
            </span>
            <input
              className={styles.scoringInput}
              type="number"
              step="0.05"
              value={draftScoringSettings[category.key] ?? 0}
              onChange={(event) =>
                updateScoringValue(category.key, event.target.value)
              }
              aria-label={`${category.label} fantasy point value`}
            />
          </label>
        ))}
      </div>

      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabButton} ${
              activeTab === tab.key ? styles.tabButtonActive : ""
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "value" ? (
        valueRows.length === 0 ? (
          <p className={styles.statusText}>No skaters match the filters.</p>
        ) : (
          <SkaterTable
            rows={valueRows}
            variant="value"
            sortKey={valueSortKey}
            sortDirection={valueSortDirection}
            onSort={(key) => requestValueSort(key as keyof SkaterValueOverviewRow)}
          />
        )
      ) : null}

      {activeTab === "metrics" ? (
        metricsRows.length === 0 ? (
          <p className={styles.statusText}>No skaters match the filters.</p>
        ) : (
          <SkaterTable
            rows={metricsRows}
            variant="metrics"
            sortKey={metricsSortKey}
            sortDirection={metricsSortDirection}
            onSort={(key) => requestMetricsSort(key as keyof SkaterMetricsRow)}
          />
        )
      ) : null}

      {activeTab === "advanced" ? (
        advancedRows.length === 0 ? (
          <p className={styles.statusText}>No skaters match the filters.</p>
        ) : (
          <SkaterAdvancedMetricsTable rows={advancedRows} />
        )
      ) : null}
    </section>
  );
}
