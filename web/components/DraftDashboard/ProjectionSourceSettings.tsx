import { useState } from "react";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  getEffectiveSourceShares,
  normalizeSourceWeights,
} from "lib/draftDashboard/sourceWeights";
import type { ProjectionSourceControls } from "lib/draftDashboard/sourceControlPreferences";
import type { DraftCustomSourceMetadata } from "lib/draftDashboard/summaryConfiguration";
import styles from "./DraftSettingsDomains.module.scss";

interface Props {
  skaters?: ProjectionSourceControls;
  goalies?: ProjectionSourceControls;
  onSkatersChange?: (controls: ProjectionSourceControls) => void;
  onGoaliesChange?: (controls: ProjectionSourceControls) => void;
  customSources: DraftCustomSourceMetadata[];
  onRemoveCustomSource?: (id: string) => void;
  hasPicks: boolean;
}

export default function ProjectionSourceSettings({
  skaters,
  goalies,
  onSkatersChange,
  onGoaliesChange,
  customSources,
  onRemoveCustomSource,
  hasPicks,
}: Props) {
  const [mode, setMode] = useState<"weights" | "multipliers">("weights");
  const [editing, setEditing] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const disabledCount = [skaters, goalies].reduce(
    (sum, group) =>
      sum + Object.values(group || {}).filter((c) => !c.isSelected).length,
    0,
  );
  const changeWeight = (
    controls: ProjectionSourceControls,
    id: string,
    value: number,
    onChange: (controls: ProjectionSourceControls) => void,
  ) => {
    if (mode === "multipliers") {
      onChange({ ...controls, [id]: { ...controls[id], weight: value } });
      return;
    }
    const next = normalizeSourceWeights(controls);
    const others = Object.keys(next).filter(
      (key) => key !== id && next[key].isSelected,
    );
    const target = Math.max(0, Math.min(1, value / 100));
    const total = others.reduce((sum, key) => sum + next[key].weight, 0);
    next[id] = { ...next[id], weight: target };
    others.forEach((key) => {
      next[key] = {
        ...next[key],
        weight:
          (1 - target) *
          (total > 0 ? next[key].weight / total : 1 / others.length),
      };
    });
    onChange(next);
  };
  return (
    <div className={styles.sources}>
      <div
        className={styles.modeSwitch}
        role="group"
        aria-label="Projection weight display"
      >
        <button
          type="button"
          aria-pressed={mode === "weights"}
          onClick={() => setMode("weights")}
        >
          Weights
        </button>
        <button
          type="button"
          aria-pressed={mode === "multipliers"}
          onClick={() => setMode("multipliers")}
        >
          Multipliers
        </button>
      </div>
      {[
        {
          name: "Skaters",
          id: "skater",
          controls: skaters,
          onChange: onSkatersChange,
        },
        {
          name: "Goalies",
          id: "goalie",
          controls: goalies,
          onChange: onGoaliesChange,
        },
      ].map(({ name, id: group, controls, onChange }) => {
        if (!controls || !onChange) return null;
        const shares = getEffectiveSourceShares(controls);
        const total = Math.round(
          Object.values(shares).reduce((sum, value) => sum + value, 0) * 100,
        );
        return (
          <section
            key={group}
            id={`sources-${group}`}
            tabIndex={-1}
            className={styles.sourceGroup}
            aria-label={`${name} projection sources`}
          >
            <h4>
              {name}
              <span>
                Total weight <strong>{total}%</strong>
              </span>
            </h4>
            {Object.entries(controls)
              .filter(([, control]) => control.isSelected || showDisabled)
              .sort((a, b) => Number(b[1].isSelected) - Number(a[1].isSelected))
              .map(([id, control]) => {
                const label =
                  PROJECTION_SOURCES_CONFIG.find((source) => source.id === id)
                    ?.displayName ||
                  customSources.find((source) => source.id === id)?.label ||
                  id;
                const share = Math.round((shares[id] || 0) * 100);
                return (
                  <div
                    className={styles.sourceRow}
                    key={id}
                    data-disabled={!control.isSelected}
                  >
                    <label title={label}>
                      <input
                        type="checkbox"
                        checked={control.isSelected}
                        aria-label={`Toggle source ${label}`}
                          aria-describedby="draft-issues-projections"
                        onChange={(event) => {
                          const isSelected = event.target.checked;
                          if (
                            isSelected &&
                            ["blake_ag_skaters", "nate_ag_skaters"].includes(
                              id,
                            ) &&
                            !window.confirm(
                              'Enabling "AG Blake" or "AG Nate" alongside "Apples & Ginos" double-weights those projections. Proceed?',
                            )
                          )
                            return;
                          if (
                            !isSelected &&
                            hasPicks &&
                            !window.confirm(
                              `Disable ${label}? Player values and recommendations will recalculate. Completed picks will remain.`,
                            )
                          )
                            return;
                          onChange({
                            ...controls,
                            [id]: { ...control, isSelected },
                          });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                    <meter
                      min={0}
                      max={100}
                      value={share}
                      aria-label={`${label} share`}
                    />
                    {editing ? (
                      <label className={styles.weightInput}>
                        <input
                          type="number"
                            aria-describedby="draft-issues-projections"
                          min={0}
                          max={mode === "weights" ? 100 : 2}
                          step={mode === "weights" ? 1 : 0.01}
                          value={
                            Number.isFinite(control.weight)
                              ? mode === "weights"
                                ? share
                                : Number(control.weight.toFixed(3))
                              : ""
                          }
                          disabled={!control.isSelected}
                          aria-label={`${label} ${mode === "weights" ? "weight percent" : "numeric weight multiplier"}`}
                          onChange={(event) =>
                            changeWeight(
                              controls,
                              id,
                              event.target.value === ""
                                ? NaN
                                : Number(event.target.value),
                              onChange,
                            )
                          }
                        />
                        {mode === "weights" ? "%" : "×"}
                      </label>
                    ) : (
                      <strong>
                        {mode === "weights"
                          ? `${share}%`
                          : `${control.weight.toFixed(2)}×`}
                      </strong>
                    )}
                    {editing &&
                      id.startsWith("custom_csv") &&
                      onRemoveCustomSource && (
                        <button
                          type="button"
                          aria-label={`Remove ${label}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${label}? This removes its imported projections, preserving all picks.`,
                              )
                            )
                              onRemoveCustomSource(id);
                          }}
                        >
                          ×
                        </button>
                      )}
                  </div>
                );
              })}
          </section>
        );
      })}
      {disabledCount > 0 && (
        <button
          type="button"
          className={styles.wideButton}
          data-testid="toggle-disabled-sources"
          aria-expanded={showDisabled}
          onClick={() => setShowDisabled(!showDisabled)}
        >
          {showDisabled ? "Hide" : "Show"} disabled sources ({disabledCount})
        </button>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => {
            if (skaters) onSkatersChange?.(normalizeSourceWeights(skaters));
            if (goalies) onGoaliesChange?.(normalizeSourceWeights(goalies));
          }}
        >
          Normalize Weights
        </button>
        <button
          type="button"
          data-testid="open-weights-popover"
          aria-pressed={editing}
          onClick={() => {
            setEditing(!editing);
            setShowDisabled(true);
          }}
        >
          {editing ? "Finish Editing" : "Edit Weights"}
        </button>
      </div>
      <p className={styles.note}>
        Weights are blended independently for skaters and goalies. Multipliers
        preserve relative influence.
      </p>
    </div>
  );
}
