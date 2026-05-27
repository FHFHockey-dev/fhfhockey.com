import Link from "next/link";
import type { ReactNode } from "react";

import type {
  CommandCenterMixedState,
  CommandCenterModuleState,
  CommandCenterModuleStatus
} from "lib/dashboard/commandCenterTypes";
import styles from "styles/ForgeCommandCenter.module.scss";

type CommandCenterShellProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  children: ReactNode;
};

type CommandCenterPanelProps = {
  title: string;
  eyebrow?: string;
  meta?: string;
  className?: string;
  children: ReactNode;
};

type StatusTone = "neutral" | "live" | "good" | "warn" | "danger" | "muted";

type StatusChipProps = {
  children: ReactNode;
  tone?: StatusTone;
};

type MetricPillProps = {
  label: string;
  value: ReactNode;
  tone?: StatusTone;
};

type TrendSparklineProps = {
  values: number[];
  tone?: "up" | "down" | "neutral";
  label: string;
};

type DenseListProps = {
  children: ReactNode;
  columns?: string;
  "aria-label"?: string;
};

const STATUS_LABELS: Record<CommandCenterModuleStatus, string> = {
  loading: "Loading",
  ready: "Ready",
  empty: "Empty",
  partial: "Partial",
  stale: "Fallback",
  error: "Error"
};

export function CommandCenterShell({
  eyebrow = "FORGE Command Center",
  title,
  subtitle,
  dateLabel,
  children
}: CommandCenterShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar} aria-label="FORGE command center">
          <Link href="/FORGE" className={styles.brandLink}>
            <span className={styles.brandMark}>FHF</span>
            <span className={styles.brandText}>FORGE</span>
          </Link>

          <nav className={styles.primaryNav} aria-label="Command center navigation">
            <Link href="/forge/command-center" className={styles.primaryNavActive}>
              Dashboard
            </Link>
            <Link href="/forge/dashboard">Legacy Dashboard</Link>
            <Link href="/start-chart">Matchups</Link>
            <Link href="/trends">Trends</Link>
            <Link href="/FORGE">Quick Read</Link>
          </nav>

          <div className={styles.topbarMeta}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span>{dateLabel}</span>
          </div>
        </header>

        <section className={styles.heroBand}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className={styles.statusStack} aria-label="Route status">
            <span className={styles.statusChip}>Scratch Route</span>
            <span className={styles.statusChipMuted}>Rollback: /forge/dashboard</span>
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}

export function CommandCenterPanel({
  title,
  eyebrow,
  meta,
  className,
  children
}: CommandCenterPanelProps) {
  return (
    <section className={`${styles.panel} ${className ?? ""}`}>
      <header className={styles.panelHeader}>
        <div>
          {eyebrow ? <p className={styles.panelEyebrow}>{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {meta ? <span className={styles.panelMeta}>{meta}</span> : null}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

export function ModuleState<T>({
  module,
  children
}: {
  module: CommandCenterModuleState<T>;
  children?: ReactNode;
}) {
  if (module.status === "ready" || module.status === "stale" || module.status === "partial") {
    return (
      <>
        {module.status !== "ready" ? (
          <p className={styles.moduleStateWarning}>
            {module.message ?? module.error ?? `${module.contract.label} is ${module.status}.`}
          </p>
        ) : null}
        {children}
      </>
    );
  }

  return (
    <div className={styles.moduleState} data-state={module.status}>
      <StatusChip tone={module.status === "error" ? "danger" : "muted"}>
        {STATUS_LABELS[module.status]}
      </StatusChip>
      <p>
        {module.error ??
          module.message ??
          (module.status === "loading"
            ? `Loading ${module.contract.label.toLowerCase()}...`
            : module.contract.emptyStateRule)}
      </p>
    </div>
  );
}

export function MixedStateBanner({
  mixedState
}: {
  mixedState: CommandCenterMixedState;
}) {
  if (!mixedState.hasMixedDates || !mixedState.message) return null;

  return (
    <section className={styles.mixedStateBanner} aria-label="Command center data freshness">
      <div>
        <p className={styles.panelEyebrow}>Mixed Data State</p>
        <strong>{mixedState.message}</strong>
      </div>
      <StatusChip tone="warn">
        {mixedState.fallbackModuleIds.length} fallback module
        {mixedState.fallbackModuleIds.length === 1 ? "" : "s"}
      </StatusChip>
    </section>
  );
}

export function StatusChip({ children, tone = "neutral" }: StatusChipProps) {
  return (
    <span className={`${styles.statusToken} ${styles[`statusToken_${tone}`]}`}>
      {children}
    </span>
  );
}

export function MetricPill({ label, value, tone = "neutral" }: MetricPillProps) {
  return (
    <span className={`${styles.metricPill} ${styles[`metricPill_${tone}`]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

export function TrendSparkline({
  values,
  tone = "neutral",
  label
}: TrendSparklineProps) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const width = 96;
  const height = 28;
  const min = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  const range = max - min || 1;
  const points =
    finiteValues.length > 1
      ? finiteValues
          .map((value, index) => {
            const x = (index / (finiteValues.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")
      : "";

  return (
    <svg
      className={`${styles.sparkline} ${styles[`sparkline_${tone}`]}`}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {points ? <polyline points={points} /> : <line x1="0" x2={width} y1="14" y2="14" />}
    </svg>
  );
}

export function DenseList({
  children,
  columns = "minmax(120px, 0.8fr) minmax(0, 1fr)",
  "aria-label": ariaLabel
}: DenseListProps) {
  return (
    <div
      className={styles.denseList}
      style={{ "--command-center-columns": columns } as React.CSSProperties}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function DenseListRow({ children }: { children: ReactNode }) {
  return <div className={styles.denseListRow}>{children}</div>;
}
