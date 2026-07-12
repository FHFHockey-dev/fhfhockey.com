type TeamUnitToiHealthResponse = {
  success: boolean;
  dryRun: boolean;
  generatedRows: number;
  sourceCounts?: {
    shifts?: number;
    players?: number;
    powerPlayRows?: number;
  };
  coverage?: {
    gameCount?: number;
    teamGameCount?: number;
    forwardRows?: number;
    defenseRows?: number;
    powerPlayRows?: number;
  };
  error?: string;
};

type Options = {
  baseUrl: string;
  season: number;
  gameIds: string;
  snapshotDate: string;
};

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue != null) {
      values.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      values.set(key, "true");
    }
  }

  return {
    baseUrl: values.get("baseUrl") ?? "http://localhost:3000",
    season: Number(values.get("season") ?? 20252026),
    gameIds: values.get("gameIds") ?? "2025020001",
    snapshotDate:
      values.get("snapshotDate") ?? new Date().toISOString().slice(0, 10),
  };
}

function assertHealth(response: TeamUnitToiHealthResponse) {
  const failures: string[] = [];
  if (!response.success) {
    failures.push(response.error ?? "team unit TOI health endpoint failed");
  }
  if (!response.dryRun) {
    failures.push("health check must run with dryRun=true");
  }
  if (response.generatedRows <= 0) {
    failures.push("team unit TOI generated no aggregate rows");
  }
  if ((response.sourceCounts?.shifts ?? 0) <= 0) {
    failures.push("nhl_api_shift_rows source returned no rows");
  }
  if ((response.sourceCounts?.players ?? 0) <= 0) {
    failures.push("players position source returned no rows");
  }
  if ((response.coverage?.teamGameCount ?? 0) <= 0) {
    failures.push("no team/game aggregate coverage was generated");
  }
  if ((response.coverage?.forwardRows ?? 0) <= 0) {
    failures.push("no forward-line aggregate rows were generated");
  }
  if ((response.coverage?.defenseRows ?? 0) <= 0) {
    failures.push("no defense-pair aggregate rows were generated");
  }
  if ((response.coverage?.powerPlayRows ?? 0) <= 0) {
    failures.push("no power-play unit aggregate rows were generated");
  }

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const params = new URLSearchParams({
    season: String(options.season),
    gameIds: options.gameIds,
    snapshot_date: options.snapshotDate,
    dryRun: "true",
  });
  const url = `${options.baseUrl.replace(/\/$/, "")}/api/v1/db/update-team-unit-toi?${params.toString()}`;
  const response = await fetch(url);
  const body = (await response.json()) as TeamUnitToiHealthResponse;
  if (!response.ok) {
    throw new Error(
      `team unit TOI health request failed with HTTP ${response.status}: ${
        body.error ?? response.statusText
      }`,
    );
  }

  assertHealth(body);
  console.log(
    "[check-team-unit-toi-source-health] summary",
    JSON.stringify(
      {
        url,
        generatedRows: body.generatedRows,
        sourceCounts: body.sourceCounts,
        coverage: body.coverage,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    `[check-team-unit-toi-source-health] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
