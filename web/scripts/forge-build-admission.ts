/**
 * Build-time FORGE admission check (C1 prevention, H2; TJ 2026-11-16: fail production builds, no override).
 *
 * A production build inlines its producer closure hash (next.config.js, scripts/forge-producer-closure.ts), and readers
 * serve a snapshot-less run only when that hash is in VERIFIED_FORGE_PRODUCER_CLOSURES and the run carries a full
 * 40-character git_sha (externalInputProof.ts verifiedRunAttribution). A build that misses either ships a producer whose
 * every run is withheld. This check runs at build time with the hash next.config.js computed:
 *   - production (VERCEL_ENV=production): any problem fails the build, so production stays on the previous deployment;
 *   - preview and local builds: the same problems print as a warning only.
 * It reads the allowlist through the readers' own lookup and never edits it. It lives outside the producer closure (no
 * root imports it), so it never changes the hash it checks.
 *
 * The build sees only build-time env. A deployment whose runtime lacks the SHA still stamps `local:unknown`; the daily
 * cron report's FORGE serving check is the runtime backstop.
 *
 * Standalone, before spending a build (run in web/ against the exact release candidate):
 *   VERCEL_ENV=production GIT_SHA=<40-char sha> node -e 'require("./next.config.js")("phase-production-build")'
 * runs the same closure hash and check as the build. Or, with a hash in hand:
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/forge-build-admission.ts --closure <sha256>
 * which prints the verdict as JSON and exits 1 when a production build would fail.
 */
import { verifiedForgeProducerClosure } from "../lib/projections/verifiedForgeReleases";

export type ForgeBuildProblemCode = "closure_missing" | "closure_unlisted" | "commit_sha_missing" | "commit_sha_malformed"
  | "allowlist_unreadable";
export type ForgeBuildProblem = { code: ForgeBuildProblemCode; message: string };
export type ForgeBuildAdmission = {
  production: boolean;
  /** pass: no problem; warn: problems on a non-production build; fail: problems on a production build. */
  action: "pass" | "warn" | "fail";
  closureSha256: string;
  /** The SHA runs from this build would stamp, resolved as run-lifecycle-queries.ts does; null when none. */
  commitSha: string | null;
  problems: ForgeBuildProblem[];
};

const SHA256 = /^[0-9a-f]{64}$/, FULL_SHA = /^[0-9a-f]{40}$/;

/** Pure: the build's verdict from its closure hash, its env and an allowlist lookup (`isListed` may throw). */
export function assessForgeBuildAdmission(input: {
  closureSha256: string;
  env: { VERCEL_ENV?: string; VERCEL_GIT_COMMIT_SHA?: string; GIT_SHA?: string };
  isListed: (closureSha256: string) => boolean;
}): ForgeBuildAdmission {
  const production = input.env.VERCEL_ENV === "production";
  const closure = typeof input.closureSha256 === "string" ? input.closureSha256.trim() : "";
  const problems: ForgeBuildProblem[] = [];
  if (!SHA256.test(closure)) {
    problems.push({ code: "closure_missing", message: "The producer closure hash was not computed, so every run from "
      + "this build stamps an unknown closure and readers withhold it." });
  } else {
    let listed: boolean | null = null;
    try {
      listed = input.isListed(closure);
    } catch (error) {
      problems.push({ code: "allowlist_unreadable", message: `The verified-closure allowlist could not be read `
        + `(${error instanceof Error ? error.message : String(error)}).` });
    }
    if (listed === false) {
      problems.push({ code: "closure_unlisted", message: `Producer closure ${closure} is not in `
        + "VERIFIED_FORGE_PRODUCER_CLOSURES (lib/projections/verifiedForgeReleases.ts), so readers withhold every run "
        + "from this build. Verify this commit with scripts/verify-forge-release-sha.ts and list its receipt." });
    }
  }
  // Same precedence as run-lifecycle-queries.ts currentRunGitSha (an empty value falls through).
  const commitSha = input.env.VERCEL_GIT_COMMIT_SHA || input.env.GIT_SHA || null;
  if (!commitSha) {
    problems.push({ code: "commit_sha_missing", message: "Neither VERCEL_GIT_COMMIT_SHA nor GIT_SHA is set, so runs "
      + "from this build stamp git_sha 'local:unknown' and every reader drops them. Deploy from Git or set GIT_SHA." });
  } else if (!FULL_SHA.test(commitSha)) {
    problems.push({ code: "commit_sha_malformed", message: `Commit SHA '${commitSha}' is not a full 40-character `
      + "lowercase SHA, so readers cannot attribute runs from this build." });
  }
  return { production, action: problems.length === 0 ? "pass" : production ? "fail" : "warn",
    closureSha256: closure, commitSha, problems };
}

/** The verdict against the real allowlist, through the readers' own lookup. */
export function assessThisForgeBuild(closureSha256: string,
  env: Record<string, string | undefined> = process.env): ForgeBuildAdmission {
  return assessForgeBuildAdmission({ closureSha256,
    env: { VERCEL_ENV: env.VERCEL_ENV, VERCEL_GIT_COMMIT_SHA: env.VERCEL_GIT_COMMIT_SHA, GIT_SHA: env.GIT_SHA },
    isListed: hash => verifiedForgeProducerClosure(hash) !== null });
}

if (require.main === module) {
  const at = process.argv.indexOf("--closure");
  const verdict = assessThisForgeBuild(at >= 0 ? process.argv[at + 1] ?? "" : "");
  console.log(JSON.stringify(verdict));
  if (verdict.action === "fail") process.exitCode = 1;
}
