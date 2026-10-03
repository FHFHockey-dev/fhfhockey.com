export const FORGE_PROCESS_GUARDIAN_PROTOCOL = "forge-process-guardian-v1";
export type ForgeProcessGuardianIdentity = { pid: number; hostname: string; protocol: typeof FORGE_PROCESS_GUARDIAN_PROTOCOL; nonceHash: string };

/** Serialized into an independent Node process; keep runtime dependencies inside this function. */
export function runForgeProcessGuardian(protocol: string) {
  const { spawn } = require("node:child_process");
  const token = process.env.FORGE_PROCESS_GUARDIAN_TOKEN;
  if (process.platform === "win32" || !process.connected || !process.send || !token) { process.exitCode = 1; return; }
  let worker: any = null, config: any = null, workerReady = false, workerExited = false;
  let workerCode: number | null = null, workerSignal: NodeJS.Signals | null = null, bytes = 0;
  let reason: string | null = null, graceElapsed = false, finishing = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const bootstrap = setTimeout(() => { process.exit(1); }, 10000);
  const send = (message: object, callback?: () => void) => {
    if (!process.connected || !process.send) { callback?.(); return; }
    try { process.send({ ...message, protocol, token }, () => callback?.()); }
    catch { callback?.(); }
  };
  const finishGroup = () => {
    if (finishing) return;
    finishing = true;
    if (deadline) clearTimeout(deadline);
    const kill = () => {
      // This guardian remains its own process-group leader until this call; no saved/foreign PID is used.
      try { process.kill(-process.pid, "SIGKILL"); } catch { process.exit(1); }
    };
    send({ type: "forge-guardian-terminal", pid: worker?.pid ?? null, code: workerCode, signal: workerSignal, reason }, kill);
  };
  const stop = (next: string) => {
    if (reason && reason !== "completed") return;
    const first = reason === null;
    reason = next;
    if (next !== "completed") send({ type: "forge-guardian-stopped", reason: next });
    if (!first) return;
    if (!worker) { clearTimeout(bootstrap); process.exit(1); }
    // The worker and its ordinary descendants inherit this guardian's dedicated process group.
    try { process.kill(-process.pid, "SIGTERM"); } catch { worker.kill("SIGTERM"); }
    setTimeout(() => {
      graceElapsed = true;
      if (!workerExited && worker.exitCode === null && worker.signalCode === null) worker.kill("SIGKILL");
      if (workerExited) finishGroup();
      else setTimeout(finishGroup, 750); // Bounded cleanup even if a terminal worker cannot be observed.
    }, 250);
  };
  process.on("SIGTERM", () => { if (!reason) stop("cancelled"); });
  process.on("disconnect", () => stop("orphaned"));
  const output = (chunk: Buffer, stream: NodeJS.WriteStream) => {
    if (reason && reason !== "completed") return;
    const length = Math.min(chunk.length, config.maxLogBytes - bytes);
    if (length > 0) { bytes += length; stream.write(new Uint8Array(chunk.subarray(0, length))); }
    if (length < chunk.length) stop("output_limit");
  };
  process.stdout.on("error", () => stop("log_failure"));
  process.stderr.on("error", () => stop("log_failure"));
  process.on("message", (message: any) => {
    if (message?.protocol !== protocol || message.token !== token) return;
    if (!config) {
      if (message.type !== "forge-guardian-init" || message.guardianPid !== process.pid || message.parentPid !== process.ppid
        || !Array.isArray(message.argv) || !message.argv.length || message.argv.some((arg: unknown) => typeof arg !== "string")
        || typeof message.cwd !== "string" || !Number.isFinite(message.deadlineMs) || message.deadlineMs <= Date.now()
        || !Number.isSafeInteger(message.maxLogBytes) || message.maxLogBytes < 1 || typeof message.requireStart !== "boolean") {
        clearTimeout(bootstrap); process.exit(1);
      }
      config = message; clearTimeout(bootstrap);
      deadline = setTimeout(() => stop("deadline"), Math.max(0, config.deadlineMs - Date.now()));
      worker = spawn(process.execPath, config.argv, { cwd: config.cwd, detached: false,
        env: { ...process.env, FORGE_PROCESS_GUARDIAN_TOKEN: "", FORGE_CALENDAR_START_TOKEN: config.requireStart ? token : "" },
        stdio: config.requireStart ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"] });
      send({ type: "forge-guardian-spawned", pid: worker.pid ?? null });
      worker.stdout.on("data", (chunk: Buffer) => output(chunk, process.stdout));
      worker.stderr.on("data", (chunk: Buffer) => output(chunk, process.stderr));
      worker.on("message", (value: any) => {
        if (reason || workerReady || value?.type !== "forge-calendar-ready" || value.token !== token || value.protocol !== protocol) return;
        workerReady = true; send({ type: "forge-guardian-ready", pid: worker.pid });
      });
      worker.once("error", () => { workerExited = true; stop("failed"); });
      worker.once("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        workerExited = true; workerCode = code; workerSignal = signal;
        if (!reason) stop("completed");
        if (graceElapsed) finishGroup();
      });
      return;
    }
    if (message.type === "forge-guardian-stop" && ["deadline", "cancelled", "output_limit", "log_failure"].includes(message.reason)) {
      stop(message.reason);
    } else if (message.type === "forge-guardian-start" && !reason && workerReady && config.requireStart) {
      if (Date.now() >= config.deadlineMs) { stop("deadline"); return; }
      workerReady = false;
      worker.send({ type: "forge-calendar-start", token, protocol }, (error: Error | null) => { if (error) stop("log_failure"); });
    }
  });
}
