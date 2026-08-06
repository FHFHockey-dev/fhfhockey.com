import type { HomepagePulsePoint } from "./homepagePulse";

type VercelVisitorRow = {
  timestamp?: unknown;
  visitors?: unknown;
};

type VercelVisitorsResponse = {
  data?: unknown;
};

type FetchDailyVisitorsArgs = {
  token: string;
  projectId: string;
  teamId: string;
  now?: Date;
  fetchImpl?: typeof fetch;
};

const VISITOR_LOOKBACK_DAYS = 14;

export function buildDailyVisitorPoints(data: unknown): HomepagePulsePoint[] {
  if (!Array.isArray(data)) return [];

  return data
    .flatMap((row: VercelVisitorRow) => {
      if (
        typeof row?.timestamp !== "string" ||
        !Number.isFinite(Date.parse(row.timestamp)) ||
        typeof row.visitors !== "number" ||
        !Number.isFinite(row.visitors)
      ) {
        return [];
      }

      return [
        {
          timestamp: row.timestamp,
          value: Math.max(0, row.visitors),
        },
      ];
    })
    .sort(
      (first, second) =>
        Date.parse(first.timestamp) - Date.parse(second.timestamp),
    );
}

export async function fetchDailyVisitorPoints({
  token,
  projectId,
  teamId,
  now = new Date(),
  fetchImpl = fetch,
}: FetchDailyVisitorsArgs): Promise<HomepagePulsePoint[]> {
  const until = new Date(now);
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - VISITOR_LOOKBACK_DAYS);
  since.setUTCHours(0, 0, 0, 0);

  const searchParams = new URLSearchParams({
    projectId,
    teamId,
    since: since.toISOString(),
    until: until.toISOString(),
    by: "day",
  });
  const response = await fetchImpl(
    `https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${searchParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Vercel Web Analytics request failed (${response.status})`);
  }

  const payload = (await response.json()) as VercelVisitorsResponse;
  return buildDailyVisitorPoints(payload.data);
}
