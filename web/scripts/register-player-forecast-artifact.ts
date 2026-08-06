import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { registerPlayerForecastServingArtifact } from "../lib/player-forecasts/serving";
import { getServiceRoleClient } from "../lib/supabase/server";

function artifactPath(): string {
  const argument = process.argv.find((value) => value.startsWith("--artifact="));
  if (!argument) throw new Error("Pass --artifact=/absolute/path/to/model-artifact.json.");
  const resolved = path.resolve(argument.slice("--artifact=".length));
  if (!fs.statSync(resolved).isFile()) throw new Error("Artifact path is not a file.");
  return resolved;
}

function requiredPath(name: string): string | null {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!argument) return null;
  const resolved = path.resolve(argument.slice(name.length + 3));
  if (!fs.statSync(resolved).isFile()) throw new Error(`${name} path is not a file.`);
  return resolved;
}

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_ARTIFACT_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_ARTIFACT_CONFIRM must equal local-only.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
    throw new Error("Artifact registration is restricted to local Supabase.");
  }
}

async function main(): Promise<void> {
  assertLocalOnly();
  const sourcePath = artifactPath();
  const offlineArtifact = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const receiptPath = requiredPath("primary-receipt");
  const evidencePath = requiredPath("evidence");
  if (offlineArtifact.lockboxReady === true && (!receiptPath || !evidencePath)) {
    throw new Error("Pass --primary-receipt and --evidence for a lockbox-ready artifact.");
  }
  if (Boolean(receiptPath) !== Boolean(evidencePath)) {
    throw new Error("Primary receipt and evidence companion must be supplied together.");
  }
  const verification = spawnSync(
    process.env.PLAYER_FORECAST_PYTHON?.trim() || "python3",
    receiptPath && evidencePath
      ? [
          "-m", "modeling.player_forecasts", "verify-serving-bundle",
          `--artifact=${sourcePath}`,
          `--primary-receipt=${receiptPath}`,
          `--evidence=${evidencePath}`,
        ]
      : offlineArtifact.contractVersion === "player-forecasts-research-v2-validation"
        ? [
            "-m", "modeling.player_forecasts", "verify-validation-challenger-artifact",
            `--artifact=${sourcePath}`,
          ]
        : ["-m", "modeling.player_forecasts", "verify-artifact", `--artifact=${sourcePath}`],
    { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8" },
  );
  if (verification.status !== 0) {
    throw new Error("Python artifact verification failed; registration was not attempted.");
  }
  const verified = JSON.parse(verification.stdout);
  if (verified.artifactChecksum !== offlineArtifact.artifactChecksum) {
    throw new Error("Verified artifact identity changed before registration.");
  }
  const registered = await registerPlayerForecastServingArtifact({
    supabase: getServiceRoleClient(),
    offlineArtifact,
    sourceChecksumVerifiedExternally: true,
    evidenceDocuments: receiptPath && evidencePath ? {
      primaryReceipt: new Uint8Array(fs.readFileSync(receiptPath)),
      receiptChecksum: verified.receiptChecksum,
      companion: new Uint8Array(fs.readFileSync(evidencePath)),
      evidenceChecksum: verified.evidenceChecksum,
    } : undefined,
  });
  process.stdout.write(`${JSON.stringify({
    id: registered.id,
    checksum: registered.checksum,
    uri: registered.uri,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Artifact registration failed."}\n`);
  process.exitCode = 1;
});
