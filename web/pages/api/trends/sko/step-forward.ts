import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

interface StepForwardPayload {
  startDate?: string;
  endDate?: string;
  days?: number;
  lookbackDays?: number;
  horizon?: number;
}

interface StepForwardResult {
  success: boolean;
  asOfDate?: string;
  message?: string;
  logs?: string;
  error?: string;
}

const DEFAULT_START = "2025-01-01";
const DEFAULT_DAYS = 1;
const DEFAULT_LOOKBACK = 365;
const DEFAULT_HORIZON = 5;

function normalizeIsoDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function computeEndDate(startIso: string, days: number): string {
  const base = new Date(startIso);
  base.setDate(base.getDate() + Math.max(1, days));
  return base.toISOString().slice(0, 10);
}

function pickPythonBin(): string {
  const candidates = [
    process.env.SKO_PYTHON_BIN,
    path.join(process.cwd(), ".venv/bin/python"),
    path.join(process.cwd(), "..", ".venv/bin/python"),
    path.join(process.cwd(), "..", ".venv", "bin", "python"),
    path.join(process.cwd(), "venv/bin/python"),
    "python3",
    "python",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    return candidate;
  }

  return "python3";
}

function runStepForward(
  pythonBin: string,
  scriptPath: string,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(pythonBin, [scriptPath], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StepForwardResult>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const payload = (typeof req.body === "string" && req.body ? JSON.parse(req.body) : req.body ?? {}) as StepForwardPayload;
    const startIso = normalizeIsoDate(payload.startDate) ?? DEFAULT_START;
    const horizon = payload.horizon ?? DEFAULT_HORIZON;
    const days = payload.days ?? DEFAULT_DAYS;
    const endIso = normalizeIsoDate(payload.endDate) ?? computeEndDate(startIso, days);
    const lookback = payload.lookbackDays ?? DEFAULT_LOOKBACK;

    const scriptCandidates = [
      path.resolve(process.cwd(), "scripts", "modeling", "step_forward.py"),
      path.resolve(process.cwd(), "web", "scripts", "modeling", "step_forward.py"),
      path.resolve(process.cwd(), "..", "web", "scripts", "modeling", "step_forward.py"),
    ];
    const scriptPath = scriptCandidates.find((candidate) => fs.existsSync(candidate));
    if (!scriptPath) {
      return res.status(500).json({
        success: false,
        error: "Step forward script not found",
        logs: scriptCandidates.join("\n"),
      });
    }

    const pythonBin = pickPythonBin();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SKO_STEP_START: startIso,
      SKO_STEP_END: endIso,
      SKO_STEP_LOOKBACK: String(lookback),
      SKO_STEP_HORIZON: String(horizon),
    };

    const { code, stdout, stderr } = await runStepForward(pythonBin, scriptPath, env);

    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: `Step forward failed with exit code ${code}`,
        logs: `${stdout}\n${stderr}`.trim(),
      });
    }

    const condensedLogs = stdout.split("\n").slice(-10).join("\n");
    return res.status(200).json({
      success: true,
      asOfDate: endIso,
      message: `Step forward completed (${startIso} → ${endIso})`,
      logs: `${condensedLogs}${stderr ? `\n${stderr}` : ""}`.trim(),
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("step-forward handler error", error);
    return res
      .status(500)
      .json({ success: false, error: error?.message ?? "Unexpected error" });
  }
}
