import { useState } from "react";
import type { DraftSettings } from "./DraftDashboard";
import { SKATER_LABELS } from "lib/projectionsConfig/skaterScoringLabels";
import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import { normalizePositionWeights, POSITION_WEIGHT_KEYS } from "lib/draftDashboard/positionWeights";
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
  boosts,
  onBoostChange,
  draftProEligible,
  rawSettingsLocked,
}: {
  title: "Skaters" | "Goalies";
  values: Record<string, number>;
  available: string[];
  onChange: (values: Record<string, number>) => void;
  categories: boolean;
  hasPicks: boolean;
  boosts: Record<string, number>;
  onBoostChange: (stat: string, boost: number) => void;
  draftProEligible: boolean;
  rawSettingsLocked: boolean;
}) {
  const [manage, setManage] = useState(false);
  const [key, setKey] = useState("");
  const [weight, setWeight] = useState("1");
  const goalie = title === "Goalies";
  const addable = Array.from(new Set(available)).filter(
    (stat) => !(stat in values),
  );
  return (
    <section className={styles.scoringGroup} aria-label={`${title} scoring`} data-managing={manage}>
      <h4>
        {title} <span>{Object.keys(values).length} categories</span>
      </h4>
      <div className={styles.categoryHeading}>
        <span>Category</span>
        <span>{categories ? "Weight" : "Points"} · Boost (Pro)</span>
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
              disabled={rawSettingsLocked}
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
            <input
              aria-label={`${stat} ${goalie ? "goalie" : "skater"} Draft Pro boost percent`}
              title="Draft Pro valuation boost; league scoring stays unchanged"
              type="number"
              min={0}
              max={100}
              step={1}
              value={draftProEligible ? boosts[stat] ?? 0 : 0}
              disabled={!draftProEligible}
              onChange={(event) => onBoostChange(stat, Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
            />
            {draftProEligible && (boosts[stat] ?? 0) > 0 && (
              <span className={styles.boostValue} aria-label={`${stat} effective value`}>
                {categories ? `×${(1 + Math.min(100, boosts[stat]) / 100).toFixed(2)}` : `= ${Number((points * (1 + Math.min(100, boosts[stat]) / 100)).toFixed(3))}`}
              </span>
            )}
            {manage && (
              <button
                type="button"
                disabled={rawSettingsLocked}
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
        disabled={rawSettingsLocked}
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
            disabled={rawSettingsLocked}
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
            disabled={rawSettingsLocked}
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
              rawSettingsLocked ||
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
  draftProEligible = false,
  rawSettingsLocked = false,
}: {
  settings: DraftSettings;
  onSettingsChange: (settings: Partial<DraftSettings>) => void;
  goalieScoring?: Record<string, number>;
  onGoalieScoringChange?: (values: Record<string, number>) => void;
  availableSkaterStats: string[];
  availableGoalieStats: string[];
  hasPicks: boolean;
  draftProEligible?: boolean;
  rawSettingsLocked?: boolean;
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
  const boosts = settings.categoryBoosts || {};
  const positionWeights = draftProEligible
    ? normalizePositionWeights(settings.positionWeights)
    : {};
  const onPositionWeightChange = (position: typeof POSITION_WEIGHT_KEYS[number], value: string) => {
    const percent = value === "" ? 100 : Number(value);
    const weight = Number.isFinite(percent) ? Math.max(0, Math.min(200, percent)) / 100 : 1;
    const next = { ...positionWeights };
    if (weight === 1) delete next[position];
    else next[position] = weight;
    onSettingsChange({ positionWeights: next });
  };
  const onBoostChange = (stat: string, boost: number) => {
    const next = { ...boosts };
    if (boost === 0) delete next[stat];
    else next[stat] = boost;
    onSettingsChange({ categoryBoosts: next });
  };
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
        boosts={boosts}
        onBoostChange={onBoostChange}
        draftProEligible={draftProEligible}
        rawSettingsLocked={rawSettingsLocked}
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
          boosts={boosts}
          onBoostChange={onBoostChange}
          draftProEligible={draftProEligible}
          rawSettingsLocked={rawSettingsLocked}
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
          <button type="button" disabled={rawSettingsLocked} onClick={() => reset(false)}>
            Reset Skater Scoring
          </button>
          {onGoalieScoringChange && (
            <button type="button" disabled={rawSettingsLocked} onClick={() => reset(true)}>
              Reset Goalie Scoring
            </button>
          )}
        </div>
      )}
      <div id="position-weights" className={styles.positionWeights} role="region" aria-label="Position weights">
        <h4>Position weights (Draft Pro)</h4>
        <p>
          Weights multiply draft value using positions shown by the selected Yahoo or Fantrax source. Multi-eligible players receive the highest eligible weight once. 100% is neutral; a lower weight moves negative values toward zero. League scoring, projections, and category boosts stay unchanged.
        </p>
        <div className={styles.positionWeightList}>
          {POSITION_WEIGHT_KEYS.map((position) => (
            <div className={styles.positionWeightRow} key={position}>
              <label htmlFor={`draft-position-weight-${position}`}>{position}</label>
              <input
                id={`draft-position-weight-${position}`}
                aria-label={`${position} position weight percent`}
                type="number"
                min={0}
                max={200}
                step={1}
                value={Number(((positionWeights[position] ?? 1) * 100).toFixed(2))}
                disabled={!draftProEligible}
                onChange={(event) => onPositionWeightChange(position, event.target.value)}
              />
              <span aria-hidden="true">%</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!draftProEligible}
          onClick={() => onSettingsChange({ positionWeights: {} })}
        >
          Reset Position Weights
        </button>
      </div>
      <p className={styles.note}>
        {categories
          ? "Category weights control relative importance."
          : "Negative weights reduce fantasy points."}{" "}
        Draft Pro boosts change draft valuations and projected fantasy points without changing your league scoring. Editing league scoring recalculates values and standings without resetting picks.
      </p>
    </div>
  );
}
