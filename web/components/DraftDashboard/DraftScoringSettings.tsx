import { useState } from "react";
import type { DraftSettings } from "./DraftDashboard";
import { SKATER_LABELS } from "lib/projectionsConfig/skaterScoringLabels";
import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import styles from "./DraftSettingsDomains.module.scss";

const GOALIE_LABELS: Record<string, string> = {
  WINS_GOALIE: "W",
  SAVES_GOALIE: "SV",
  SHUTOUTS_GOALIE: "SHO",
  GOALS_AGAINST_GOALIE: "GA",
  SAVE_PERCENTAGE: "SV%",
  GOALS_AGAINST_AVERAGE: "GAA",
  LOSSES_GOALIE: "L",
  OTL_GOALIE: "OTL",
  SHOTS_AGAINST_GOALIE: "SA",
};
const labelFor = (key: string) =>
  SKATER_LABELS[key] || GOALIE_LABELS[key] || key;
const isGoalie = (key: string) =>
  key in GOALIE_LABELS || key.endsWith("_GOALIE");

function ScoringGroup({
  title,
  values,
  available,
  onChange,
  categories,
  hasPicks,
}: {
  title: "Skaters" | "Goalies";
  values: Record<string, number>;
  available: string[];
  onChange: (values: Record<string, number>) => void;
  categories: boolean;
  hasPicks: boolean;
}) {
  const [manage, setManage] = useState(false);
  const [key, setKey] = useState("");
  const [weight, setWeight] = useState("1");
  const goalie = title === "Goalies";
  const addable = Array.from(new Set(available)).filter(
    (stat) => !(stat in values),
  );
  return (
    <section className={styles.scoringGroup} aria-label={`${title} scoring`}>
      <h4>
        {title} <span>{Object.keys(values).length} categories</span>
      </h4>
      <div className={styles.categoryHeading}>
        <span>Category</span>
        <span>Weight</span>
      </div>
      <div className={styles.categoryList}>
        {Object.entries(values).map(([stat, points]) => (
          <div className={styles.categoryRow} key={stat}>
            <label
              htmlFor={`scoring-${title}-${stat}`}
              title={stat.replaceAll("_", " ")}
            >
              {labelFor(stat)}
            </label>
            <input
              id={`scoring-${title}-${stat}`}
                aria-describedby="draft-issues-scoring"
              aria-label={`${stat} ${goalie ? "goalie" : "skater"} weight`}
              type="number"
              step={0.1}
              min={categories ? 0 : undefined}
              value={Number.isFinite(points) ? points : ""}
              data-negative={points < 0}
              onChange={(event) =>
                onChange({
                  ...values,
                  [stat]:
                    event.target.value === ""
                      ? NaN
                      : Number(event.target.value),
                })
              }
            />
            {manage && (
              <button
                type="button"
                aria-label={`Remove ${stat}`}
                onClick={() => {
                  if (
                    hasPicks &&
                    !window.confirm(
                      `Remove ${labelFor(stat)} from scoring? Values and standings will recalculate; completed picks remain.`,
                    )
                  )
                    return;
                  const { [stat]: removed, ...next } = values;
                  onChange(next);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.wideButton}
        aria-expanded={manage}
        title={
          categories && !goalie
            ? "Manage / Add categories"
            : goalie
              ? "Manage / Add goalie stats"
              : "Manage / Add scoring stats"
        }
        onClick={() => setManage(!manage)}
      >
        {manage
          ? "Finish Editing Categories"
          : `+ Add ${goalie ? "Goalie" : "Skater"} Category`}
      </button>
      {manage && (
        <div className={styles.addCategory}>
          <select
            aria-label={
              categories && !goalie
                ? "Select category to add"
                : goalie
                  ? "Select goalie stat to add"
                  : "Select stat to add"
            }
            value={key}
            onChange={(event) => setKey(event.target.value)}
          >
            <option value="">Select category…</option>
            {addable.map((stat) => (
              <option key={stat} value={stat}>
                {labelFor(stat)}
              </option>
            ))}
          </select>
          <input
            type="number"
            step={0.1}
            min={categories ? 0 : undefined}
            aria-label={
              goalie ? "New goalie stat point value" : "New stat point value"
            }
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
          <button
            type="button"
            disabled={
              !key ||
              weight === "" ||
              !Number.isFinite(Number(weight)) ||
              (categories && Number(weight) < 0)
            }
            onClick={() => {
              onChange({ ...values, [key]: Number(weight) });
              setKey("");
              setWeight("1");
            }}
          >
            Add Stat
          </button>
        </div>
      )}
    </section>
  );
}

export default function DraftScoringSettings({
  settings,
  onSettingsChange,
  goalieScoring = {},
  onGoalieScoringChange,
  availableSkaterStats,
  availableGoalieStats,
  hasPicks,
}: {
  settings: DraftSettings;
  onSettingsChange: (settings: Partial<DraftSettings>) => void;
  goalieScoring?: Record<string, number>;
  onGoalieScoringChange?: (values: Record<string, number>) => void;
  availableSkaterStats: string[];
  availableGoalieStats: string[];
  hasPicks: boolean;
}) {
  const categories = settings.leagueType === "categories";
  const entries = Object.entries(settings.categoryWeights || {});
  const goalieKey = (key: string) =>
    isGoalie(key) ||
    (availableGoalieStats.includes(key) && !availableSkaterStats.includes(key));
  const skaters = categories
    ? Object.fromEntries(entries.filter(([key]) => !goalieKey(key)))
    : settings.scoringCategories;
  const goalies = categories
    ? Object.fromEntries(entries.filter(([key]) => goalieKey(key)))
    : goalieScoring;
  const reset = (goalie: boolean) => {
    if (
      hasPicks &&
      !window.confirm(
        "Reset scoring to defaults? Values and standings will recalculate; all draft picks remain.",
      )
    )
      return;
    if (goalie)
      onGoalieScoringChange?.(getDefaultFantasyPointsConfig("goalie"));
    else
      onSettingsChange({
        scoringCategories: getDefaultFantasyPointsConfig("skater"),
      });
  };
  return (
    <div className={styles.scoring}>
      <ScoringGroup
        title="Skaters"
        values={skaters}
        available={availableSkaterStats}
        onChange={(values) =>
          onSettingsChange(
            categories
              ? { categoryWeights: { ...values, ...goalies } }
              : { scoringCategories: values },
          )
        }
        categories={categories}
        hasPicks={hasPicks}
      />
      {(categories || onGoalieScoringChange) && (
        <ScoringGroup
          title="Goalies"
          values={goalies}
          available={availableGoalieStats}
          onChange={(values) =>
            categories
              ? onSettingsChange({ categoryWeights: { ...skaters, ...values } })
              : onGoalieScoringChange?.(values)
          }
          categories={categories}
          hasPicks={hasPicks}
        />
      )}
      <div className={styles.profile}>
        <strong>{categories ? "Category scoring" : "Points scoring"}</strong>
        <span>
          {Object.keys(skaters).length} skater · {Object.keys(goalies).length}{" "}
          goalie categories
        </span>
      </div>
      {!categories && (
        <div className={styles.actions}>
          <button type="button" onClick={() => reset(false)}>
            Reset Skater Scoring
          </button>
          {onGoalieScoringChange && (
            <button type="button" onClick={() => reset(true)}>
              Reset Goalie Scoring
            </button>
          )}
        </div>
      )}
      <p className={styles.note}>
        {categories
          ? "Category weights control relative importance."
          : "Negative weights reduce fantasy points."}{" "}
        Changes update values and standings without resetting picks.
      </p>
    </div>
  );
}
