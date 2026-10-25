import React from "react";
import clsx from "clsx";
import styles from "./OpponentRoleToggle.module.scss";
import { OPPONENT_VIEWS, OpponentRole } from "./utils/opponentCategoryEffects";

/** Skater/goalie perspective for opponent-metric favorability colors. */
export default function OpponentRoleToggle({ role, onChange }: { role: OpponentRole; onChange: (role: OpponentRole) => void }) {
  return (
    <div className={styles.roleToggle} role="group" aria-label="Opponent stats perspective">
      {(Object.keys(OPPONENT_VIEWS) as OpponentRole[]).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={role === value}
          title={OPPONENT_VIEWS[value].label}
          className={clsx(styles.roleButton, role === value && styles.roleButtonActive)}
          onClick={() => onChange(value)}
        >
          {value === "skater" ? "Skaters" : "Goalies"}
        </button>
      ))}
    </div>
  );
}
