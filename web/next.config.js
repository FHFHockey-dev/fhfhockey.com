const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { PHASE_PRODUCTION_BUILD } = require("next/constants");

const CMS_URL = process.env.CMS_URL;
const isProd = process.env.NODE_ENV === "production";
const preserveDistDir = process.env.PRESERVE_NEXT_DIST === "1";
const nextDistDir =
  process.env.PLAYWRIGHT_ISOLATED_NEXT === "1"
    ? ".next-playwright"
    : process.env.PLAYER_FORECAST_ISOLATED_NEXT === "1"
      ? ".next-player-forecasts"
      : ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  cleanDistDir: !preserveDistDir,
  // Next 15.5's Pages Router static indicator can receive an ISR manifest
  // before the router component map exists, producing a noisy dev-only HMR error.
  devIndicators: false,
  distDir: nextDistDir,
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/api/v1/db/cron-report": [
      "../tasks/TASKS/cron-operations/cron-schedule.md",
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep production entrypoints checked without loading the test-only program.
    tsconfigPath: isProd ? "tsconfig.build.json" : "tsconfig.json",
  },
  transpilePackages: ["@portabletext/react", "@portabletext/toolkit"],
  images: {
    // If the image optimizer is failing in dev (common when sharp/libvips mismatches),
    // bypass it so local development isn't blocked.
    unoptimized: !isProd,
    // We intentionally allow SVGs because we use NHL-provided SVG team logos
    // (e.g. https://assets.nhle.com/logos/nhl/svg/TOR_light.svg) throughout the site.
    // Without this, `next/image` returns 400 for any `.svg` source.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
      {
        protocol: "https",
        hostname: "nhl.bamcontent.com",
      },
      {
        protocol: "https",
        hostname: "assets.nhle.com",
      },
    ],
  },
  reactStrictMode: true,
  watchOptions: {
    pollIntervalMs: 1000,
  },
  webpack(config, { dev }) {
    if (dev) {
      const ignored = [
        "**/.next/**",
        "**/.next-playwright/**",
        "**/.next-codex-reconcile/**",
        "**/.next-player-forecasts/**",
        "**/node_modules/**",
        "**/coverage/**",
        "**/storybook-static/**",
        "**/tasks/artifacts/**",
        "**/package-lock 2.json",
      ];
      const existingIgnored = config.watchOptions?.ignored;
      const existingIgnoredGlobs = Array.isArray(existingIgnored)
        ? existingIgnored.filter(
            (entry) => typeof entry === "string" && entry.length > 0,
          )
        : typeof existingIgnored === "string" && existingIgnored.length > 0
          ? [existingIgnored]
          : [];
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [...existingIgnoredGlobs, ...ignored],
      };
    }
    return config;
  },
  // swcMinify: false, // Default is true, sticking to standard
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      {
        source: "/studio",
        destination: `${CMS_URL}/studio`,
      },
      {
        source: "/studio/:path*",
        destination: `${CMS_URL}/studio/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/game-grid",
        // not the url to change button label
        destination: "/game-grid/7-Day-Forecast",
        permanent: false,
      },
    ];
  },
};

/**
 * FORGE producer identity (TJ/Astra F1, 2026-10-26): the sha256 of the FORGE producer import closure of the source being
 * built (scripts/forge-producer-closure.ts, the same scan the release verifier uses). A production build defines it as
 * the bundler constant `__FORGE_PRODUCER_CLOSURE_SHA256__` in server bundles, so each run stamps the closure that
 * executed it (lib/projections/forgeProducerIdentity.ts). It is never an env var, so no env label or unbuilt code can
 * supply it (C7 R40 V2). A failure defines it empty: such runs stamp an unknown closure and readers withhold them.
 */
function forgeProducerClosureSha256() {
  try {
    const hash = execFileSync(process.execPath, [require.resolve("ts-node/dist/bin.js"), "--transpile-only",
      "--compiler-options", JSON.stringify({ module: "commonjs", moduleResolution: "node" }),
      path.join(__dirname, "scripts/forge-producer-closure.ts"), "--print"],
    { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
    if (/^[0-9a-f]{64}$/.test(hash)) return hash;
    console.warn("FORGE producer closure hash was not a sha256; runs from this build stay unadmitted.");
  } catch (error) {
    console.warn(`FORGE producer closure hash failed (${error.message}); runs from this build stay unadmitted.`);
  }
  return "";
}

/**
 * FORGE build admission (C1 prevention, H2; TJ 2026-11-16): readers serve a run only when its stamped closure is in
 * VERIFIED_FORGE_PRODUCER_CLOSURES and it carries a full commit SHA, so a build missing either ships a producer whose every
 * run is withheld. scripts/forge-build-admission.ts judges the hash computed above against the allowlist and the build
 * env. A production build (VERCEL_ENV=production) fails on any problem, including a check that could not run; preview
 * and local builds only warn. There is no override.
 */
function checkForgeBuildAdmission(closureSha256) {
  const production = process.env.VERCEL_ENV === "production";
  let verdict = null;
  let failure = null;
  const result = spawnSync(process.execPath, [require.resolve("ts-node/dist/bin.js"), "--transpile-only",
    "--compiler-options", JSON.stringify({ module: "commonjs", moduleResolution: "node" }),
    path.join(__dirname, "scripts/forge-build-admission.ts"), "--closure", closureSha256],
  { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  try {
    if (result.error) throw result.error;
    verdict = JSON.parse(String(result.stdout).trim().split("\n").pop());
    if (!verdict || !["pass", "warn", "fail"].includes(verdict.action)) throw new Error("no verdict");
  } catch (error) {
    failure = `FORGE build admission check could not run (${error.message}).`;
  }
  if (verdict?.action === "pass") {
    console.log(`FORGE build admission: closure ${verdict.closureSha256} is verified; runs stamp ${verdict.commitSha}.`);
    return;
  }
  const problems = failure ? [failure] : verdict.problems.map((problem) => `${problem.code}: ${problem.message}`);
  const report = ["FORGE build admission FAILED: runs from this build would be withheld from every reader.",
    ...problems.map((problem) => `  - ${problem}`)].join("\n");
  if (production) throw new Error(`${report}\nProduction builds stop here (VERCEL_ENV=production).`);
  console.warn(`\n${report.replace("FAILED", "WARNING")}\n  (Not a production build, so it continues.)\n`);
}

module.exports = (phase) => {
  if (phase !== PHASE_PRODUCTION_BUILD) return nextConfig;
  const closureSha256 = forgeProducerClosureSha256();
  checkForgeBuildAdmission(closureSha256);
  return {
    ...nextConfig,
    webpack(config, options) {
      const configured = nextConfig.webpack(config, options);
      if (options.isServer) {
        configured.plugins.push(new options.webpack.DefinePlugin({
          __FORGE_PRODUCER_CLOSURE_SHA256__: JSON.stringify(closureSha256),
        }));
      }
      return configured;
    },
  };
};
