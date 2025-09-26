import type { NextApiRequest, NextApiResponse } from "next";

interface StepResult {
  step: string;
  status: "ok" | "error";
  duration_sec: number;
  message: string;
  status_code: number | null;
  response?: any;
}

interface PipelineResponse {
  success: boolean;
  message: string;
  steps: StepResult[];
  total_duration_sec: number;
}

const DEFAULT_STEPS = ["backfill", "train", "score", "upload"] as const;
const STEP_TIMEOUTS: Record<string, number> = {
  backfill: 120,
  train: 240,
  score: 120,
  upload: 120
};
const SENSITIVE_KEYS = new Set([
  "secret",
  "token",
  "authorization",
  "sko_pipeline_secret",
  "api_key"
]);

function checkAuth(req: NextApiRequest): [boolean, string] {
  const expected = process.env.SKO_PIPELINE_SECRET;
  if (!expected) return [true, "no secret configured"];
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return [false, "missing bearer token"];
  const token =
    auth.split(" ", 1)[0] === "Bearer" ? auth.slice(7) : auth.split(" ")[1];
  if (token !== expected) return [false, "invalid token"];
  return [true, "ok"];
}

function normalizeSteps(payload: any): string[] {
  const stepsValue = payload.steps || payload.step;
  if (stepsValue == null) return [...DEFAULT_STEPS];
  if (typeof stepsValue === "string") return [stepsValue];
  if (Array.isArray(stepsValue)) {
    const cleaned = stepsValue.map((s) => `${s}`.trim()).filter(Boolean);
    return cleaned.length ? cleaned : [...DEFAULT_STEPS];
  }
  return [...DEFAULT_STEPS];
}

function sanitizePayload(payload: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    const lowered = k.toLowerCase();
    if (SENSITIVE_KEYS.has(lowered)) continue;
    if (lowered === "step" || lowered === "steps") continue;
    out[k] = v;
  }
  return out;
}

async function postStep(
  endpoint: string,
  headers: Record<string, string>,
  payload: any,
  step: string
): Promise<StepResult> {
  const controller = new AbortController();
  const timeout = STEP_TIMEOUTS[step] ?? 180;
  const t = setTimeout(() => controller.abort(), timeout * 1000);
  const envelope = { ...payload, step };
  const started = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(envelope),
      signal: controller.signal
    });
    const duration_sec = Number(
      ((performance.now() - started) / 1000).toFixed(2)
    );
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    const ok = res.ok;
    return {
      step,
      status: ok ? "ok" : "error",
      duration_sec,
      status_code: res.status,
      response: data,
      message:
        data?.message ||
        data?.error ||
        `${step} step ${ok ? "completed" : "failed"}`
    };
  } catch (err: any) {
    const duration_sec = Number(
      ((performance.now() - started) / 1000).toFixed(2)
    );
    return {
      step,
      status: "error",
      duration_sec,
      status_code: null,
      message: `Request failed: ${err?.message || String(err)}`
    };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PipelineResponse | { success: false; message: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const [ok, authMsg] = checkAuth(req);
  if (!ok) return res.status(401).json({ success: false, message: authMsg });

  let payload: any = {};
  if (typeof req.body === "string" && req.body) {
    try {
      payload = JSON.parse(req.body);
    } catch {
      payload = {};
    }
  } else if (req.body && typeof req.body === "object") {
    payload = req.body;
  }

  // Support query args ?step=score or ?steps=a,b,c
  if (!payload.step && !payload.steps) {
    if (typeof req.query.step === "string") payload.step = req.query.step;
    else if (typeof req.query.steps === "string")
      payload.steps = req.query.steps
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  }

  const endpoint = process.env.SKO_PIPELINE_ENDPOINT;
  if (!endpoint) {
    return res
      .status(500)
      .json({
        success: false,
        message: "SKO_PIPELINE_ENDPOINT not configured"
      });
  }

  const secret = process.env.SKO_PIPELINE_SECRET;
  const headers: Record<string, string> = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const steps = normalizeSteps(payload);
  const sanitized = sanitizePayload(payload);
  const results: StepResult[] = [];
  let overallSuccess = true;
  for (const step of steps) {
    const stepResult = await postStep(endpoint, headers, sanitized, step);
    results.push(stepResult);
    if (stepResult.status !== "ok") {
      overallSuccess = false;
      break;
    }
  }
  const message = results.length
    ? results[results.length - 1].message
    : "No pipeline steps executed";
  const total_duration_sec = Number(
    results.reduce((a, r) => a + (r.duration_sec || 0), 0).toFixed(2)
  );

  return res.status(overallSuccess ? 200 : 500).json({
    success: overallSuccess,
    message,
    steps: results,
    total_duration_sec
  });
}
