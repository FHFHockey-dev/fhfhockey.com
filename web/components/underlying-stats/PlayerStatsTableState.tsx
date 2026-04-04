import clsx from "clsx";

import PanelStatus from "components/common/PanelStatus";

import styles from "./PlayerStatsTableState.module.scss";

export type PlayerStatsTableViewState =
  | {
      kind: "loading" | "empty" | "error";
      message: string;
    }
  | {
      kind: "warning";
      message: string;
      title?: string;
    };

type PlayerStatsTableStateProps = {
  state: PlayerStatsTableViewState;
  className?: string;
};

export default function PlayerStatsTableState({
  state,
  className,
}: PlayerStatsTableStateProps) {
  if (state.kind === "warning") {
    return (
      <div
        className={clsx(styles.warningState, className)}
        role="status"
        aria-live="polite"
      >
        <p className={styles.warningEyebrow}>
          {state.title ?? "Filter combination warning"}
        </p>
        <p className={styles.warningMessage}>{state.message}</p>
      </div>
    );
  }

  return (
    <PanelStatus
      state={state.kind}
      message={state.message}
      className={clsx(styles.panelState, className)}
    />
  );
}
