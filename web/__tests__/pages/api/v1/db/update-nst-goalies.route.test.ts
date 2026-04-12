import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  fetchCurrentSeasonMock,
  fetchNstTextByUrlMock,
  upsertMock
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  const upsertMock = vi.fn().mockResolvedValue({ error: null });

  const supabaseClient = {
    from(table: string) {
      if (table === "players") {
        return {
          select() {
            return {
              ilike() {
                return {
                  eq() {
                    return {
                      limit() {
                        return {
                          maybeSingle: vi
                            .fn()
                            .mockResolvedValue({ data: { id: 8478402 }, error: null })
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      return {
        select() {
          return {
            eq() {
              return {
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
              };
            }
          };
        },
        upsert: upsertMock
      };
    }
  };

  return {
    createClientMock: vi.fn(() => supabaseClient),
    fetchCurrentSeasonMock: vi.fn(),
    fetchNstTextByUrlMock: vi.fn(),
    upsertMock
  };
});

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("../../../../../lib/nst/client", () => ({
  fetchNstTextByUrl: fetchNstTextByUrlMock
}));

vi.mock("dotenv", () => ({
  default: {
    config: vi.fn()
  }
}));

import handler from "../../../../../pages/api/v1/db/update-nst-goalies";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("/api/v1/db/update-nst-goalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves representative playerteams goalie upsert shape through the migrated NST client", async () => {
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-01",
      endDate: "2025-10-01"
    });

    fetchNstTextByUrlMock.mockResolvedValue({
      text: `
        <html>
          <body>
            <table>
              <thead>
                <tr><th>Player</th><th>Team</th><th>GP</th><th>TOI</th><th>Shots Against</th><th>Saves</th><th>Goals Against</th><th>SV%</th></tr>
              </thead>
              <tbody>
                <tr><td>John Goalie</td><td>TOR</td><td>1</td><td>60</td><td>30</td><td>28</td><td>2</td><td>93.3</td></tr>
              </tbody>
            </table>
          </body>
        </html>
      `,
      response: new Response("", { status: 200, statusText: "OK" })
    });

    const req: any = {
      method: "GET",
      query: {
        startDate: "2025-10-01",
        maxUrls: "1",
        maxDays: "1"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_name: "John Goalie",
          team: "TOR",
          player_id: 8478402,
          date_scraped: "2025-09-30",
          season: 20252026,
          gp: 1,
          toi: 60,
          shots_against: 30,
          saves: 28,
          goals_against: 2,
          sv_percentage: 93.3
        })
      ],
      { onConflict: "player_id,date_scraped" }
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      pendingUrlsProcessed: 1,
      totalQueuedUrls: 10,
      datesQueued: 1,
      stoppedEarly: true
    });
  });
});
