import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const invokedProjectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
// A reconciled dependency copy must still run Next from the source project so
// its ignored local environment files are loaded.
const reconcileSegment = `${path.sep}.next-codex-reconcile${path.sep}`;
const reconcileIndex = invokedProjectDir.indexOf(reconcileSegment);
const projectDir =
  reconcileIndex === -1
    ? invokedProjectDir
    : invokedProjectDir.slice(0, reconcileIndex);

if (process.argv[2] === "--print-project-dir") {
  console.log(projectDir);
  process.exit(0);
}

const nextBin = path.join(projectDir, "node_modules", ".bin", "next");
if (!existsSync(nextBin)) {
  console.error(`[dev:stable] Next.js executable not found at ${nextBin}.`);
  process.exit(1);
}

if (projectDir !== invokedProjectDir) {
  console.log(`[dev:stable] Starting from canonical project: ${projectDir}`);
}

const result = spawnSync(
  nextBin,
  ["dev", "-H", "0.0.0.0", "-p", "3000", ...process.argv.slice(2)],
  {
    cwd: projectDir,
    env: {
      ...process.env,
      WATCHPACK_POLLING: "true",
      WATCHPACK_POLLING_INTERVAL: "1000",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`[dev:stable] Unable to start Next.js: ${result.error.message}`);
  process.exit(1);
}

const signalExitCode = result.signal === "SIGINT" ? 130 : 143;
process.exit(result.status ?? signalExitCode);
