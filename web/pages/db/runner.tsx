/**
 * /db/runner: queue a long allowlisted route run and watch it. The server
 * runs it step by step (pg_cron -> /api/v1/db/route-runner-tick), so the
 * browser can close. This page only reads jobs/events and sends
 * queue/cancel/run-now requests to the admin-only route-runner API.
 */
import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
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
import { TextBanner } from "components/Banner/Banner";
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
import { ROUTE_RUNNER_PATHS, ROUTE_RUNNER_ROUTES } from "lib/routeRunner/registry";
import type { RouteRunnerEventRow, RouteRunnerJobRow } from "lib/routeRunner/store";
import supabase from "lib/supabase";

const JOBS_API = "/api/v1/db/route-runner/jobs";
const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 30_000;
const JOB_LIST_POLL_MS = 15_000;
const MAX_EVENT_PAGES = 20;
const MAX_EVENTS_KEPT = 5_000;

// Dark chart surface and series/status steps (dataviz reference palette).
const INK = "#f0efec";
const INK_MUTED = "#c3c2b7";
const GRID = "#2c2c2a";
const SERIES = "#3987e5";
const STATUS_COLORS: Record<string, string> = {
  queued: "#8a8a85",
  running: SERIES,
  waiting: "#fab219",
  completed: "#0ca30c",
  failed: "#d03b3b",
  cancelled: "#8a8a85"
};
const LEVEL_STYLE: Record<string, { tag: string; color: string }> = {
  info: { tag: "INFO", color: INK_MUTED },
  success: { tag: "OK  ", color: "#0ca30c" },
  warn: { tag: "WARN", color: "#fab219" },
  error: { tag: "ERR ", color: "#e66767" }
};

const cardSx = (border: string) => ({
  border: `5px solid ${border}`,
  borderRadius: "8px",
  background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
  color: "#fff"
});
const inputSx = {
  backgroundColor: "#202020",
  borderRadius: "4px",
  "& .MuiInputBase-input, & .MuiInputLabel-root": { color: "#fff" }
};

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

function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        color: "#101010",
        backgroundColor: STATUS_COLORS[status] ?? INK_MUTED,
        fontWeight: 600,
        textTransform: "uppercase",
        fontSize: 11
      }}
    />
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ background: "#1a1a19", borderRadius: 1, px: 1.5, py: 1, minWidth: 110 }}>
      <Typography sx={{ color: INK_MUTED, fontSize: 12 }}>{label}</Typography>
      <Typography sx={{ color: INK, fontSize: 20, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

function queryText(query: unknown) {
  const rendered = new URLSearchParams((query ?? {}) as Record<string, string>).toString();
  return rendered ? `?${rendered}` : "";
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

function Terminal({ events }: { events: RouteRunnerEventRow[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  useEffect(() => {
    const element = ref.current;
    if (element && pinnedRef.current) element.scrollTop = element.scrollHeight;
  }, [events]);
  return (
    <Box
      ref={ref}
      role="log"
      aria-label="Route runner terminal"
      onScroll={(event) => {
        const element = event.currentTarget;
        pinnedRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
      }}
      sx={{
        background: "#0b0b0b",
        border: "1px solid #333",
        borderRadius: 1,
        p: 1.5,
        height: 360,
        overflow: "auto",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}
    >
      {events.length === 0 ? (
        <span style={{ color: INK_MUTED }}>No events yet.</span>
      ) : (
        events.map((event) => {
          const style = LEVEL_STYLE[event.level] ?? LEVEL_STYLE.info;
          return (
            <div key={event.id} style={{ color: style.color }}>
              {`${style.tag} ${formatEventLine(event)}`}
            </div>
          );
        })
      )}
    </Box>
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
  const axis = { tick: { fill: INK_MUTED, fontSize: 11 }, stroke: GRID };
  const tooltipStyle = {
    contentStyle: { background: "#1a1a19", border: "1px solid #333", color: INK },
    labelStyle: { color: INK_MUTED }
  };

  return (
    <Card sx={cardSx("#4caf50")}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={job.status} />
          <Typography variant="h6" component="h2">
            {ROUTE_RUNNER_ROUTES[job.route_path as keyof typeof ROUTE_RUNNER_ROUTES]?.label ?? job.route_path}
          </Typography>
          <Chip size="small" variant="outlined" label={job.contract ?? "once"} sx={{ color: INK_MUTED, borderColor: "#555" }} />
        </Stack>
        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: INK_MUTED, mt: 1, wordBreak: "break-all" }}>
          {job.route_path}
          {queryText(job.next_query)}
        </Typography>
        {reason && (
          <Typography sx={{ mt: 1, color: job.status === "failed" ? "#e66767" : INK }}>{reason}</Typography>
        )}
        <Typography sx={{ mt: 0.5, color: INK_MUTED, fontSize: 14 }}>{nextStepText(job, offsetMs)}</Typography>

        <Box sx={{ mt: 2 }}>
          {percent != null ? (
            <>
              <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 1 }} aria-label="Job progress" />
              <Typography sx={{ fontSize: 13, color: INK_MUTED, mt: 0.5 }}>
                {progress?.done} / {progress?.total} {progress?.unit ?? ""} ({percent.toFixed(1)}%)
                {progress?.cursor ? ` · ${progress.cursor}` : ""}
              </Typography>
            </>
          ) : job.status === "running" ? (
            <LinearProgress sx={{ height: 10, borderRadius: 1 }} aria-label="Step running" />
          ) : progress?.cursor ? (
            <Typography sx={{ fontSize: 13, color: INK_MUTED }}>{progress.cursor}</Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <StatTile label="Steps" value={String(job.steps)} />
          <StatTile label={`Total ${rowsUnit}`} value={Number(job.rows_total).toLocaleString()} />
          <StatTile label="Kills" value={String(job.kills)} />
          <StatTile label="ETA" value={etaMs != null ? formatDuration(etaMs) : "—"} />
          <StatTile label="Elapsed" value={formatDuration(Math.max(0, elapsedMs))} />
          <StatTile label="Avg step" value={averageStepMs != null ? formatDuration(averageStepMs) : "—"} />
        </Stack>

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid xs={12} md={6}>
            <Typography sx={{ color: INK_MUTED, fontSize: 13, mb: 0.5 }}>Cumulative {rowsUnit}</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rowsSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="time" {...axis} minTickGap={24} />
                  <YAxis {...axis} width={56} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} formatter={(value: number) => [value.toLocaleString(), rowsUnit]} />
                  <Area type="monotone" dataKey="rows" stroke={SERIES} strokeWidth={2} fill={SERIES} fillOpacity={0.15} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
          <Grid xs={12} md={6}>
            <Typography sx={{ color: INK_MUTED, fontSize: 13, mb: 0.5 }}>Step duration (s)</Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="step" {...axis} />
                  <YAxis {...axis} width={40} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "#ffffff10" }} formatter={(value: number) => [`${value} s`, "duration"]} labelFormatter={(step) => `step ${step}`} />
                  <Bar dataKey="seconds" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>

        <Typography sx={{ color: INK_MUTED, fontSize: 13, mt: 2, mb: 0.5 }}>Live terminal</Typography>
        <Terminal events={events} />

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            color="error"
            disabled={props.busy || !isActiveStatus(job.status)}
            onClick={() => props.onAction("cancel")}
          >
            Cancel job
          </Button>
          <Button
            variant="outlined"
            disabled={props.busy || job.status !== "waiting"}
            onClick={() => props.onAction("run_now")}
          >
            Run now
          </Button>
        </Stack>
      </CardContent>
    </Card>
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

  const preview = useMemo(() => {
    if (!input.trim()) return null;
    const origin = ownOrigin();
    return parseRunnerInput(input, origin ? [origin] : []);
  }, [input]);

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
    if (preview && !preview.ok) {
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

  return (
    <Container>
      <Head>
        <title>Route Runner | FHFH</title>
      </Head>
      <TextBanner text="Route Runner" />
      <Grid container spacing={2}>
        <Grid xs={12}>
          <Card sx={cardSx("#ffb300")}>
            <CardContent>
              <Typography variant="body2">
                Paste an allowlisted route URL. The server runs it step by step, following the route&apos;s
                resume contract, until it finishes (up to 72 h). You can close this page.{" "}
                <Link href="/db" style={{ color: "#ffb300" }}>
                  Back to /db
                </Link>
              </Typography>
              <TextField
                label="Route URL or path"
                size="small"
                fullWidth
                margin="normal"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !queueing) void queueRun();
                }}
                placeholder={ROUTE_RUNNER_ROUTES["/api/v1/db/update-nst-gamelog"].example}
                disabled={queueing}
                sx={inputSx}
              />
              {preview?.ok && (
                <Typography sx={{ fontSize: 13, color: INK_MUTED }}>
                  {ROUTE_RUNNER_ROUTES[preview.routePath].label} · contract {preview.contract}
                  {preview.ignoredParams.length ? ` · runner sets ${preview.ignoredParams.join(", ")}` : ""}
                </Typography>
              )}
              {error && (
                <Typography role="alert" sx={{ color: "#ff6b6b", mt: 1 }}>
                  {error}
                </Typography>
              )}
              <Button
                sx={{ mt: 1 }}
                variant="contained"
                color="warning"
                onClick={() => void queueRun()}
                disabled={queueing || !input.trim()}
              >
                {queueing ? "Queueing…" : "Queue run"}
              </Button>
              <Box component="ul" sx={{ listStyle: "none", p: 0, mt: 2, mb: 0 }} aria-label="Allowlisted routes">
                {ROUTE_RUNNER_PATHS.map((path) => {
                  const spec = ROUTE_RUNNER_ROUTES[path];
                  return (
                    <Box component="li" key={path} sx={{ py: 0.75, borderTop: "1px solid #333" }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography sx={{ fontWeight: 600 }}>{spec.label}</Typography>
                        <Chip size="small" variant="outlined" label={spec.contract} sx={{ color: INK_MUTED, borderColor: "#555" }} />
                        <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: INK_MUTED }}>{path}</Typography>
                        <Button size="small" onClick={() => setInput(spec.example)} disabled={queueing}>
                          Use example
                        </Button>
                      </Stack>
                      <Typography sx={{ fontSize: 12, color: INK_MUTED }}>{spec.notes}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <Card sx={cardSx("#07aae2")}>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Jobs
              </Typography>
              {jobs.length === 0 ? (
                <Typography sx={{ color: INK_MUTED }}>No jobs yet.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {jobs.map((row) => (
                    <Box
                      key={row.id}
                      component="button"
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      aria-pressed={row.id === selectedId}
                      sx={{
                        textAlign: "left",
                        cursor: "pointer",
                        background: row.id === selectedId ? "#2c2c2a" : "transparent",
                        border: "1px solid #333",
                        borderRadius: 1,
                        color: INK,
                        p: 1
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StatusChip status={row.status} />
                        <Typography sx={{ fontSize: 14 }}>
                          {ROUTE_RUNNER_ROUTES[row.route_path as keyof typeof ROUTE_RUNNER_ROUTES]?.label ?? row.route_path}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 12, color: INK_MUTED }}>
                        {new Date(row.created_at).toLocaleString()} · {row.steps} steps ·{" "}
                        {Number(row.rows_total).toLocaleString()} {readJobProgress(row.progress)?.rowsUnit ?? "rows"}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={8}>
          {job ? (
            <JobDetail job={job} events={events} offsetMs={offsetMs} onAction={(action) => void runAction(action)} busy={actionBusy} />
          ) : (
            <Card sx={cardSx("#4caf50")}>
              <CardContent>
                <Typography sx={{ color: INK_MUTED }}>
                  {selectedId ? "Loading the job…" : "Select a job to see its terminal and progress."}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
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
