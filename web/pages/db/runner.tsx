/**
 * /db/runner: build or paste an allowlisted route run, queue it and watch it.
 * The server runs it step by step (pg_cron -> /api/v1/db/route-runner-tick),
 * so the browser can close. This page only reads jobs/events and sends
 * queue/cancel/run-now requests to the admin-only route-runner API.
 *
 * The URL field is the single source of truth: each builder control reads its
 * value from the URL and writes one param back, so a pasted URL and the
 * controls always agree.
 */
import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import AdminPageGate from "components/Admin/AdminPageGate";
import Container from "components/Layout/Container";
import {
  buildTimeline,
  estimateEtaMs,
  formatDuration,
  formatEventLine,
  isActiveStatus,
  parseRunnerInput,
  readJobProgress
} from "lib/routeRunner/core";
import {
  getRunnerOptions,
  splitRunnerUrl,
  switchRunnerRoute,
  withRunnerParam,
  type RunnerOption
} from "lib/routeRunner/options";
import {
  ROUTE_RUNNER_PATHS,
  ROUTE_RUNNER_ROUTES,
  getRouteRunnerSpec,
  type RouteRunnerContract
} from "lib/routeRunner/registry";
import type { RouteRunnerEventRow, RouteRunnerJobRow } from "lib/routeRunner/store";
import supabase from "lib/supabase";
import styles from "styles/RouteRunner.module.scss";

const JOBS_API = "/api/v1/db/route-runner/jobs";
const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 30_000;
const JOB_LIST_POLL_MS = 15_000;
const MAX_EVENT_PAGES = 20;
const MAX_EVENTS_KEPT = 5_000;

// Chart colors mirror styles/vars.scss: $primary-color, $text-secondary,
// $border-secondary and $background-dark (SVG attributes cannot read SCSS).
const SERIES = "#14a2d2";
const AXIS_TEXT = "#aaaaaa";
const GRID = "rgba(80, 80, 80, 0.45)";
const TOOLTIP_BG = "#1a1d21";

const CONTRACT_LABELS: Record<RouteRunnerContract, string> = {
  nst_resume: "resumes",
  rolling_resume_from: "resumes by player",
  next_start_date: "resumes by date",
  once: "runs once"
};

const LEVEL_TAGS: Record<string, string> = {
  info: "INFO",
  success: "OK  ",
  warn: "WARN",
  error: "ERR "
};

const OPTION_GROUPS = [
  { key: "mode", label: "Mode" },
  { key: "scope", label: "Scope" }
] as const;

async function authFetch(path: string, init?: { method?: string; body?: unknown }) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No signed-in session. Sign in again and retry.");
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    redirect: "manual"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(body?.error ?? body?.message ?? `HTTP ${response.status}`);
  }
  return body;
}

function ownOrigin() {
  return typeof window === "undefined" ? null : window.location.origin;
}

/** The pasted text with this site's own origin removed (the API accepts paths). */
function toSubmittedPath(input: string) {
  const trimmed = input.trim();
  const origin = ownOrigin();
  return origin && trimmed.startsWith(`${origin}/`) ? trimmed.slice(origin.length) : trimmed;
}

function routeLabel(path: string) {
  return getRouteRunnerSpec(path)?.label ?? path;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={styles.statusPill} data-status={status}>
      {status}
    </span>
  );
}

function Countdown({ targetMs, offsetMs }: { targetMs: number; offsetMs: number }) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offsetMs), 1_000);
    return () => clearInterval(timer);
  }, [offsetMs]);
  return <>{targetMs <= now ? "due now" : `in ${formatDuration(targetMs - now)}`}</>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function queryText(query: unknown) {
  const rendered = new URLSearchParams((query ?? {}) as Record<string, string>).toString();
  return rendered ? `?${rendered.replace(/%2C/gi, ",")}` : "";
}

function nextStepText(job: RouteRunnerJobRow, offsetMs: number) {
  if (job.status === "running") return "A step is running now.";
  if (job.status === "waiting" && job.not_before) {
    return (
      <>
        Next step <Countdown targetMs={Date.parse(job.not_before)} offsetMs={offsetMs} /> (
        {new Date(job.not_before).toLocaleTimeString()}).
      </>
    );
  }
  if (job.status === "queued") return "Next step on the next tick (within about a minute).";
  return `Finished ${job.finished_at ? new Date(job.finished_at).toLocaleString() : ""}.`;
}

function OptionControl(props: {
  option: RunnerOption;
  value: string;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const { option, value, disabled, onChange } = props;
  const id = `runner-option-${option.key}`;
  const label = (
    <span className={styles.optionLabel}>
      {option.label}
      <code>{option.key}</code>
    </span>
  );
  const help = option.help ? <p className={styles.optionHelp}>{option.help}</p> : null;

  if (option.kind === "flag") {
    return (
      <div className={styles.option}>
        <label className={styles.flag}>
          <input
            type="checkbox"
            checked={value !== ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked ? option.flagValue ?? "true" : null)}
          />
          {option.label}
        </label>
        {help}
      </div>
    );
  }

  if (option.kind === "choice" || option.kind === "multi") {
    const selected = option.kind === "multi" ? value.split(",").filter(Boolean) : [value];
    const toggle = (choice: string) => {
      if (option.kind === "choice") return onChange(value === choice ? null : choice);
      const next = selected.includes(choice)
        ? selected.filter((item) => item !== choice)
        : [...selected, choice];
      onChange(next.length ? next.join(",") : null);
    };
    // Size the slot to the rail so its segments stay on one line.
    const railChars = 7 + (option.values ?? []).reduce((sum, choice) => sum + choice.length + 2, 0);
    const width = railChars > 40 ? styles.optionWide : railChars > 22 ? styles.optionSpan2 : "";
    return (
      <div className={`${styles.option} ${width}`}>
        {label}
        <div className={styles.segmentRail} role="group" aria-label={option.label}>
          <button
            type="button"
            className={`${styles.segment} ${styles.segmentDefault}`}
            aria-pressed={value === ""}
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            default
          </button>
          {option.values?.map((choice) => (
            <button
              key={choice}
              type="button"
              className={styles.segment}
              aria-pressed={selected.includes(choice)}
              disabled={disabled}
              onClick={() => toggle(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
        {help}
      </div>
    );
  }

  if (option.kind === "select") {
    return (
      <div className={styles.option}>
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          className={styles.field}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Route default</option>
          {option.values?.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
          {value && !option.values?.includes(value) && <option value={value}>{value}</option>}
        </select>
        {help}
      </div>
    );
  }

  return (
    <div className={styles.option}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.field}
        type={option.kind === "date" ? "date" : option.kind === "number" ? "number" : "text"}
        inputMode={option.kind === "number" ? "numeric" : undefined}
        min={option.min}
        max={option.max}
        placeholder={option.placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      />
      {help}
    </div>
  );
}

function RunBuilder(props: {
  input: string;
  setInput: (value: string) => void;
  queueing: boolean;
  error: string | null;
  onQueue: () => void;
}) {
  const { input, setInput, queueing } = props;
  const [copied, setCopied] = useState(false);
  const parts = useMemo(() => splitRunnerUrl(input), [input]);
  const spec = parts ? getRouteRunnerSpec(parts.path) : null;
  const options = spec && parts ? getRunnerOptions(parts.path) : [];
  const advanced = options.filter((option) => option.group === "advanced");
  const preview = useMemo(() => {
    if (!input.trim()) return null;
    const origin = ownOrigin();
    return parseRunnerInput(input, origin ? [origin] : []);
  }, [input]);
  const offeredKeys = new Set(options.map((option) => option.key));
  const otherKeys = parts
    ? Array.from(parts.params.keys()).filter(
        (key) => !offeredKeys.has(key) && !(spec?.runnerParams ?? []).includes(key)
      )
    : [];

  const setParam = (key: string, value: string | null) => setInput(withRunnerParam(input, key, value));
  const renderOption = (option: RunnerOption) => (
    <OptionControl
      key={option.key}
      option={option}
      value={parts?.params.get(option.key) ?? ""}
      disabled={queueing}
      onChange={(value) => setParam(option.key, value)}
    />
  );

  async function copyUrl() {
    const origin = ownOrigin() ?? "";
    const text = input.trim().startsWith("/") ? `${origin}${input.trim()}` : input.trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`${styles.panel} ${styles.panelAccent}`} aria-labelledby="runner-builder-title">
      <div className={styles.panelHead}>
        <h2 id="runner-builder-title">Build a run</h2>
        <span>Pick a route, set its options, or paste a URL. Unset options use the route default.</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.routeGrid} role="group" aria-label="Route">
          {ROUTE_RUNNER_PATHS.map((path) => {
            const route = ROUTE_RUNNER_ROUTES[path];
            return (
              <button
                key={path}
                type="button"
                className={styles.routeCard}
                aria-pressed={parts?.path === path}
                disabled={queueing}
                onClick={() => setInput(switchRunnerRoute(input, path))}
              >
                <strong>{route.label}</strong>
                <span>{CONTRACT_LABELS[route.contract]}</span>
              </button>
            );
          })}
        </div>

        {spec ? (
          <>
            <p className={styles.routeNotes}>{spec.notes}</p>
            {options.length === 0 && <p className={styles.routeNotes}>This route takes no options.</p>}
            {OPTION_GROUPS.map((group) => {
              const groupOptions = options.filter((option) => option.group === group.key);
              if (groupOptions.length === 0) return null;
              return (
                <fieldset key={group.key} className={styles.optionGroup}>
                  <legend>{group.label}</legend>
                  <div className={styles.optionGrid}>{groupOptions.map(renderOption)}</div>
                </fieldset>
              );
            })}
            {advanced.length > 0 && (
              <details className={styles.advanced}>
                <summary>Advanced ({advanced.length})</summary>
                <div className={styles.optionGrid}>{advanced.map(renderOption)}</div>
              </details>
            )}
          </>
        ) : (
          <p className={styles.routeNotes}>
            {parts ? `${parts.path} is not on the runner allowlist.` : "Pick a route above, or paste a URL below."}
          </p>
        )}

        <div className={styles.urlBar}>
          <div className={styles.option}>
            <label htmlFor="runner-url" className={styles.optionLabel}>
              Route URL or path
            </label>
            <input
              id="runner-url"
              className={`${styles.field} ${styles.urlField}`}
              value={input}
              spellCheck={false}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !queueing) props.onQueue();
              }}
              placeholder={ROUTE_RUNNER_ROUTES["/api/v1/db/update-nst-gamelog"].example}
              disabled={queueing}
            />
          </div>
          <button type="button" className={styles.buttonSecondary} onClick={() => void copyUrl()} disabled={!input.trim()}>
            {copied ? "Copied" : "Copy URL"}
          </button>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={props.onQueue}
            disabled={queueing || !input.trim() || preview?.ok === false}
          >
            {queueing ? "Queueing…" : "Queue run"}
          </button>
        </div>

        {preview?.ok && (
          <p className={styles.urlMeta}>
            <strong>{ROUTE_RUNNER_ROUTES[preview.routePath].label}</strong> · {CONTRACT_LABELS[preview.contract]}
            {preview.ignoredParams.length ? ` · the runner sets ${preview.ignoredParams.join(", ")}` : ""}
            {otherKeys.length ? ` · kept as typed: ${otherKeys.join(", ")}` : ""}
          </p>
        )}
        {preview && !preview.ok && (
          <p role="alert" className={styles.error}>
            {preview.error}
          </p>
        )}
        {props.error && (
          <p role="alert" className={styles.error}>
            {props.error}
          </p>
        )}
      </div>
    </section>
  );
}

function Terminal({ events }: { events: RouteRunnerEventRow[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  useEffect(() => {
    const element = ref.current;
    if (element && pinnedRef.current) element.scrollTop = element.scrollHeight;
  }, [events]);
  return (
    <div
      ref={ref}
      role="log"
      aria-label="Route runner terminal"
      className={styles.terminal}
      onScroll={(event) => {
        const element = event.currentTarget;
        pinnedRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
      }}
    >
      {events.length === 0 ? (
        <span className={styles.line}>No events yet.</span>
      ) : (
        events.map((event) => (
          <div key={event.id} className={styles.line} data-level={event.level}>
            {`${LEVEL_TAGS[event.level] ?? LEVEL_TAGS.info} ${formatEventLine(event)}`}
          </div>
        ))
      )}
    </div>
  );
}

function JobDetail(props: {
  job: RouteRunnerJobRow;
  events: RouteRunnerEventRow[];
  offsetMs: number;
  onAction: (action: "cancel" | "run_now") => void;
  busy: boolean;
}) {
  const { job, events, offsetMs } = props;
  const timeline = useMemo(() => buildTimeline(events), [events]);
  const progress = readJobProgress(job.progress);
  const percent =
    progress?.done != null && progress.total ? Math.min(100, (progress.done / progress.total) * 100) : null;
  const etaMs = isActiveStatus(job.status) ? estimateEtaMs(timeline) : null;
  const durations = timeline.filter((point) => point.durationMs != null);
  const averageStepMs = durations.length
    ? durations.reduce((sum, point) => sum + (point.durationMs ?? 0), 0) / durations.length
    : null;
  const elapsedMs =
    (job.finished_at ? Date.parse(job.finished_at) : Date.now() + offsetMs) - Date.parse(job.created_at);
  const rowsUnit = progress?.rowsUnit ?? "rows";
  const lastMessage = [...events].reverse().find((event) => event.step != null)?.message;
  const reason = job.last_error ?? lastMessage ?? null;
  const rowsSeries = timeline.map((point) => ({
    time: new Date(point.atMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    rows: point.rowsTotal
  }));
  const durationSeries = durations.map((point) => ({
    step: point.step,
    seconds: Math.round((point.durationMs ?? 0) / 100) / 10
  }));
  const axis = { tick: { fill: AXIS_TEXT, fontSize: 11 }, stroke: GRID };
  const tooltipStyle = {
    contentStyle: { background: TOOLTIP_BG, border: `1px solid ${GRID}`, color: "#cccccc" },
    labelStyle: { color: AXIS_TEXT }
  };

  return (
    <section className={styles.panel} aria-labelledby="runner-job-title">
      <div className={styles.panelHead}>
        <div className={styles.detailTitle}>
          <StatusPill status={job.status} />
          <h2 id="runner-job-title">{routeLabel(job.route_path)}</h2>
          <span className={styles.contractPill}>{job.contract ?? "once"}</span>
        </div>
        <span>{new Date(job.created_at).toLocaleString()}</span>
      </div>
      <div className={styles.panelBody}>
        <p className={styles.query}>
          {job.route_path}
          {queryText(job.next_query)}
        </p>
        {reason && (
          <p className={`${styles.reason} ${job.status === "failed" ? styles.reasonFailed : ""}`}>{reason}</p>
        )}
        <p className={styles.nextStep}>{nextStepText(job, offsetMs)}</p>

        {percent != null ? (
          <div className={styles.progress}>
            <div className={styles.progressHead}>
              <span>
                {progress?.unit ?? "progress"}
                {progress?.cursor ? ` · ${progress.cursor}` : ""}
              </span>
              <strong>
                {progress?.done} / {progress?.total} ({percent.toFixed(1)}%)
              </strong>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label="Job progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
            >
              <div className={styles.trackFill} style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : job.status === "running" ? (
          <div className={styles.track} role="progressbar" aria-label="Step running">
            <div className={`${styles.trackFill} ${styles.trackIndeterminate}`} />
          </div>
        ) : progress?.cursor ? (
          <p className={styles.nextStep}>{progress.cursor}</p>
        ) : null}

        <div className={styles.metrics}>
          <Metric label="Steps" value={String(job.steps)} />
          <Metric label={`Total ${rowsUnit}`} value={Number(job.rows_total).toLocaleString()} />
          <Metric label="Kills" value={String(job.kills)} />
          <Metric label="ETA" value={etaMs != null ? formatDuration(etaMs) : "—"} />
          <Metric label="Elapsed" value={formatDuration(Math.max(0, elapsedMs))} />
          <Metric label="Avg step" value={averageStepMs != null ? formatDuration(averageStepMs) : "—"} />
        </div>

        <div className={styles.charts}>
          <div className={styles.chartFrame}>
            <h3>Cumulative {rowsUnit}</h3>
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rowsSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" {...axis} minTickGap={24} />
                  <YAxis {...axis} width={56} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} formatter={(value: number) => [value.toLocaleString(), rowsUnit]} />
                  <Area
                    type="monotone"
                    dataKey="rows"
                    stroke={SERIES}
                    strokeWidth={2}
                    fill={SERIES}
                    fillOpacity={0.15}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={styles.chartFrame}>
            <h3>Step duration (s)</h3>
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="step" {...axis} />
                  <YAxis {...axis} width={40} />
                  <Tooltip
                    {...tooltipStyle}
                    cursor={{ fill: "rgba(255, 255, 255, 0.06)" }}
                    formatter={(value: number) => [`${value} s`, "duration"]}
                    labelFormatter={(step) => `step ${step}`}
                  />
                  <Bar dataKey="seconds" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={styles.terminalHead}>
          <h3>Live terminal</h3>
          <span className={styles.nextStep}>{events.length.toLocaleString()} lines</span>
        </div>
        <Terminal events={events} />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.buttonDanger}
            disabled={props.busy || !isActiveStatus(job.status)}
            onClick={() => props.onAction("cancel")}
          >
            Cancel job
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={props.busy || job.status !== "waiting"}
            onClick={() => props.onAction("run_now")}
          >
            Run now
          </button>
        </div>
      </div>
    </section>
  );
}

function RouteRunner() {
  const [input, setInput] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<RouteRunnerJobRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job, setJob] = useState<RouteRunnerJobRow | null>(null);
  const [events, setEvents] = useState<RouteRunnerEventRow[]>([]);
  const [offsetMs, setOffsetMs] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const lastEventIdRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const jobRef = useRef<RouteRunnerJobRow | null>(null);

  const loadJobs = useCallback(async () => {
    const body = await authFetch(JOBS_API);
    setJobs(body.jobs ?? []);
    if (body.serverTime) setOffsetMs(Date.parse(body.serverTime) - Date.now());
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    let after = lastEventIdRef.current;
    const fresh: RouteRunnerEventRow[] = [];
    let latest: RouteRunnerJobRow | null = null;
    for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
      const body = await authFetch(`${JOBS_API}/${id}?after=${after}`);
      latest = body.job;
      fresh.push(...(body.events ?? []));
      if (fresh.length) after = fresh[fresh.length - 1].id;
      if (!body.hasMore) break;
    }
    if (selectedRef.current !== id || !latest) return;
    lastEventIdRef.current = after;
    jobRef.current = latest;
    setJob(latest);
    setJobs((current) => current.map((row) => (row.id === id ? latest! : row)));
    if (fresh.length) setEvents((current) => [...current, ...fresh].slice(-MAX_EVENTS_KEPT));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => loadJobs().catch((caught) => !cancelled && setError(String(caught?.message ?? caught)));
    void refresh();
    const timer = setInterval(refresh, JOB_LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadJobs]);

  useEffect(() => {
    selectedRef.current = selectedId;
    lastEventIdRef.current = 0;
    jobRef.current = null;
    setJob(null);
    setEvents([]);
    if (!selectedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        await loadDetail(selectedId);
      } catch (caught: any) {
        if (!cancelled) setError(String(caught?.message ?? caught));
      }
      if (cancelled) return;
      const active = jobRef.current ? isActiveStatus(jobRef.current.status) : true;
      timer = setTimeout(poll, active ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedId, loadDetail]);

  async function queueRun() {
    setError(null);
    const origin = ownOrigin();
    const preview = parseRunnerInput(input, origin ? [origin] : []);
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    setQueueing(true);
    try {
      const body = await authFetch(JOBS_API, { method: "POST", body: { path: toSubmittedPath(input) } });
      setInput("");
      await loadJobs();
      setSelectedId(body.job.id);
    } catch (caught: any) {
      setError(String(caught?.message ?? caught));
    } finally {
      setQueueing(false);
    }
  }

  async function runAction(action: "cancel" | "run_now") {
    if (!selectedId) return;
    setActionBusy(true);
    setError(null);
    try {
      await authFetch(`${JOBS_API}/${selectedId}`, { method: "POST", body: { action } });
      await loadDetail(selectedId);
    } catch (caught: any) {
      setError(String(caught?.message ?? caught));
    } finally {
      setActionBusy(false);
    }
  }

  const activeCount = jobs.filter((row) => isActiveStatus(row.status)).length;

  return (
    <Container contentVariant="full">
      <Head>
        <title>Route Runner | FHFH</title>
      </Head>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.eyebrow}>Admin · Database</span>
            <h1>Route Runner</h1>
            <p>
              The server runs a queued route step by step, following its resume contract, until it finishes (up
              to 72 h). You can close this page.
            </p>
          </div>
          <nav className={styles.topActions} aria-label="Runner links">
            <span>
              {activeCount} active · {jobs.length} recent
            </span>
            <Link href="/db" className={styles.link}>
              Back to /db
            </Link>
          </nav>
        </header>

        <RunBuilder input={input} setInput={setInput} queueing={queueing} error={error} onQueue={() => void queueRun()} />

        <div className={styles.panels}>
          <section className={styles.panel} aria-labelledby="runner-jobs-title">
            <div className={styles.panelHead}>
              <h2 id="runner-jobs-title">Jobs</h2>
              <span>latest 50</span>
            </div>
            {jobs.length === 0 ? (
              <div className={styles.empty}>No jobs yet. Queue a run above.</div>
            ) : (
              <ul className={styles.jobList}>
                {jobs.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={styles.jobRow}
                      onClick={() => setSelectedId(row.id)}
                      aria-pressed={row.id === selectedId}
                    >
                      <span className={styles.jobRowTitle}>
                        <StatusPill status={row.status} />
                        {routeLabel(row.route_path)}
                      </span>
                      <span className={styles.jobRowMeta}>
                        {new Date(row.created_at).toLocaleString()} · {row.steps} steps ·{" "}
                        {Number(row.rows_total).toLocaleString()} {readJobProgress(row.progress)?.rowsUnit ?? "rows"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {job ? (
            <JobDetail job={job} events={events} offsetMs={offsetMs} onAction={(action) => void runAction(action)} busy={actionBusy} />
          ) : (
            <section className={styles.panel} aria-label="Job detail">
              <div className={styles.panelHead}>
                <h2>Job detail</h2>
              </div>
              <div className={styles.empty}>
                {selectedId ? "Loading the job…" : "Select a job to see its terminal, progress and charts."}
              </div>
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}

export default function RouteRunnerPage() {
  return (
    <AdminPageGate>
      <RouteRunner />
    </AdminPageGate>
  );
}
