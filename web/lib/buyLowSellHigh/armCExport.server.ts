import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync } from "node:fs";
import { join } from "node:path";
import { createArmCCandidateReader } from "./armCCandidate.server";
import type { ReviewedFiveGameWindowInput } from "./reviewedFiveGameWindow.server";

const MiB = 1024 * 1024;
const byteHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function boundedFile(path: string, limit: number) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > limit) throw Error("arm_c_export_file_outside_bounds");
    const bytes = new Uint8Array(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw Error("arm_c_export_changed_during_read");
      offset += count;
    }
    if (fstatSync(fd).size !== bytes.length) throw Error("arm_c_export_changed_during_read");
    return bytes;
  } finally { closeSync(fd); }
}

/** One offline export. Its contents can supply evidence bytes, never the active review policy. */
export async function inspectArmCExport(directory: string, target: ReviewedFiveGameWindowInput["target"],
  evaluatedAtUTC: string, operation: "build" | "read", verify = createArmCCandidateReader()) {
  const manifestBytes = boundedFile(join(directory, "manifest.json"), MiB);
  const artifactPath = join(directory, "artifacts");
  if (!lstatSync(artifactPath).isDirectory()) throw Error("arm_c_export_artifact_directory_invalid");
  const dir = opendirSync(artifactPath);
  const artifacts = new Map<string, Uint8Array>();
  let remaining = 128 * MiB;
  try {
    for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
      if (!entry.isFile() || !/^[a-f0-9]{64}$/.test(entry.name) || artifacts.size >= 512) throw Error("arm_c_export_artifact_index_invalid");
      const bytes = boundedFile(join(artifactPath, entry.name), Math.min(64 * MiB, remaining));
      if (byteHash(bytes) !== entry.name) throw Error("arm_c_export_artifact_digest_mismatch");
      remaining -= bytes.length;
      artifacts.set(entry.name, bytes);
    }
  } finally { dir.closeSync(); }
  const saved = operation === "read" ? boundedFile(join(directory, "snapshot.json"), 4 * MiB) : undefined;
  return verify({ target, manifestBytes, artifacts }, evaluatedAtUTC, saved);
}
