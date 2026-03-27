import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accountState = vi.hoisted(() => ({
  routerQuery: {},
  replace: vi.fn(),
  profileMaybeSingle: vi.fn(),
  profileUpsert: vi.fn(),
  settingsMaybeSingle: vi.fn(),
  settingsUpsert: vi.fn(),
  connectedAccountMaybeSingle: vi.fn(),
  externalLeaguesOrder: vi.fn(),
  externalTeamsOrder: vi.fn(),
  providerPreferencesMaybeSingle: vi.fn(),
  providerPreferencesUpsert: vi.fn(),
  savedTeamsRows: [] as Array<any>,
  savedTeamsInsert: vi.fn(),
  savedTeamsUpdate: vi.fn(),
  savedTeamsDelete: vi.fn(),
  authGetSession: vi.fn()
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: accountState.routerQuery,
    replace: accountState.replace
  })
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "tim@example.com",
      displayName: "Tim Tester",
      avatarUrl: null,
      isEmailVerified: true
    }
  })
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      getSession: accountState.authGetSession
    },
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: accountState.profileMaybeSingle
            })
          }),
          upsert: accountState.profileUpsert
        };
      }

      if (table === "user_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: accountState.settingsMaybeSingle
            })
          }),
          upsert: accountState.settingsUpsert
        };
      }

      if (table === "connected_accounts") {
        return {
          select: () => ({
            eq: (_field: string, _value: string) => ({
              eq: (_nextField: string, _nextValue: string) => ({
                maybeSingle: accountState.connectedAccountMaybeSingle
              })
            })
          })
        };
      }

      if (table === "external_leagues") {
        return {
          select: () => ({
            eq: (_field: string, _value: string) => ({
              eq: (_nextField: string, _nextValue: string) => ({
                order: accountState.externalLeaguesOrder
              })
            })
          })
        };
      }

      if (table === "external_teams") {
        return {
          select: () => ({
            eq: (_field: string, _value: string) => ({
              eq: (_nextField: string, _nextValue: string) => ({
                order: accountState.externalTeamsOrder
              })
            })
          })
        };
      }

      if (table === "user_provider_preferences") {
        return {
          select: () => ({
            eq: (_field: string, _value: string) => ({
              eq: (_nextField: string, _nextValue: string) => ({
                maybeSingle: accountState.providerPreferencesMaybeSingle
              })
            })
          }),
          upsert: accountState.providerPreferencesUpsert
        };
      }

      if (table === "user_saved_teams") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [...accountState.savedTeamsRows].sort((a, b) =>
                    a.created_at < b.created_at ? 1 : -1
                  ),
                  error: null
                })
            })
          }),
          insert: (payload: any) => {
            accountState.savedTeamsInsert(payload);
            const row = {
              id: payload.id || `team-${accountState.savedTeamsRows.length + 1}`,
              created_at: payload.created_at || "2026-03-27T12:00:00.000Z",
              updated_at: payload.updated_at || "2026-03-27T12:00:00.000Z",
              ...payload
            };
            accountState.savedTeamsRows = [row, ...accountState.savedTeamsRows];
            return Promise.resolve({ error: null });
          },
          update: (payload: any) => ({
            eq: (field: string, value: string) => {
              accountState.savedTeamsUpdate(payload, field, value);
              accountState.savedTeamsRows = accountState.savedTeamsRows.map((row) =>
                row[field] === value
                  ? {
                      ...row,
                      ...payload,
                      updated_at: "2026-03-27T13:00:00.000Z"
                    }
                  : row
              );
              return Promise.resolve({ error: null });
            }
          }),
          delete: () => ({
            eq: (field: string, value: string) => {
              accountState.savedTeamsDelete(field, value);
              accountState.savedTeamsRows = accountState.savedTeamsRows.filter(
                (row) => row[field] !== value
              );
              return Promise.resolve({ error: null });
            }
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  }
}));

import AccountSettingsPage from "components/account/AccountSettingsPage";

describe("AccountSettingsPage profile section", () => {
  beforeEach(() => {
    accountState.routerQuery = {};
    accountState.replace.mockReset();
    accountState.profileMaybeSingle.mockReset();
    accountState.profileUpsert.mockReset();
    accountState.settingsMaybeSingle.mockReset();
    accountState.settingsUpsert.mockReset();
    accountState.connectedAccountMaybeSingle.mockReset();
    accountState.externalLeaguesOrder.mockReset();
    accountState.externalTeamsOrder.mockReset();
    accountState.providerPreferencesMaybeSingle.mockReset();
    accountState.providerPreferencesUpsert.mockReset();
    accountState.savedTeamsRows = [];
    accountState.savedTeamsInsert.mockReset();
    accountState.savedTeamsUpdate.mockReset();
    accountState.savedTeamsDelete.mockReset();
    accountState.authGetSession.mockReset();
    accountState.settingsMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });
    accountState.connectedAccountMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });
    accountState.externalLeaguesOrder.mockResolvedValue({
      data: [],
      error: null
    });
    accountState.externalTeamsOrder.mockResolvedValue({
      data: [],
      error: null
    });
    accountState.providerPreferencesMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });
    accountState.providerPreferencesUpsert.mockResolvedValue({
      error: null
    });
    accountState.authGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "session-token"
        }
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("loads persisted profile fields into the editor", async () => {
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Commissioner Tim",
        avatar_url: "https://example.com/tim.png",
        timezone: "America/Chicago"
      },
      error: null
    });

    render(<AccountSettingsPage />);

    expect(await screen.findByDisplayValue("Commissioner Tim")).toBeTruthy();
    expect(screen.getByDisplayValue("https://example.com/tim.png")).toBeTruthy();
    expect(screen.getByDisplayValue("America/Chicago")).toBeTruthy();
    expect(screen.getByAltText("Commissioner Tim")).toBeTruthy();
  });

  it("shows an initialization notice when the profile row is missing", async () => {
    accountState.profileMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });

    render(<AccountSettingsPage />);

    expect(
      await screen.findByText(
        "Your profile record is not stored yet. The form is using your current auth identity as a fallback, and saving will initialize the profile row."
      )
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Tim Tester")).toBeTruthy();
  });

  it("saves updated profile settings", async () => {
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/New_York"
      },
      error: null
    });
    accountState.profileUpsert.mockResolvedValue({ error: null });

    render(<AccountSettingsPage />);

    await screen.findByDisplayValue("Tim Tester");
    fireEvent.change(screen.getByLabelText("Display Name"), {
      target: { value: "Tim The Commissioner" }
    });
    fireEvent.change(screen.getByLabelText("Timezone"), {
      target: { value: "America/Chicago" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    await waitFor(() => {
      expect(accountState.profileUpsert).toHaveBeenCalledWith(
        {
          user_id: "user-1",
          display_name: "Tim The Commissioner",
          avatar_url: null,
          timezone: "America/Chicago"
        },
        {
          onConflict: "user_id"
        }
      );
    });

    expect(await screen.findByText("Profile settings saved.")).toBeTruthy();
  });

  it("loads persisted league settings into the league editor", async () => {
    accountState.routerQuery = {
      section: "league-settings"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.settingsMaybeSingle.mockResolvedValue({
      data: {
        league_type: "categories",
        scoring_categories: {
          GOALS: 5,
          ASSISTS: 4
        },
        category_weights: {
          GOALS: 2,
          HITS: 3
        },
        roster_config: {
          C: 3,
          bench: 5,
          utility: 2
        },
        ui_preferences: {
          account_settings_section: "league-settings"
        },
        active_context: {
          source_type: "yahoo",
          provider: "yahoo",
          external_team_id: "team-9",
          external_league_id: "league-2"
        }
      },
      error: null
    });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(
        (screen.getByLabelText("League Type") as HTMLSelectElement).value
      ).toBe("categories");
    });
    expect(
      (screen.getByLabelText("Points: GOALS") as HTMLInputElement).value
    ).toBe("5");
    expect(screen.getByText("Source: yahoo")).toBeTruthy();
    expect(screen.getByText("Team: team-9")).toBeTruthy();
  });

  it("shows site defaults when the league settings row is missing", async () => {
    accountState.routerQuery = {
      section: "league-settings"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.settingsMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });

    render(<AccountSettingsPage />);

    expect(
      await screen.findByText(
        "Your league defaults have not been saved yet. Site defaults are shown here until you save your first personalized settings row."
      )
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("League Type") as HTMLSelectElement).value
    ).toBe("points");
  });

  it("saves updated league defaults", async () => {
    accountState.routerQuery = {
      section: "league-settings"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.settingsMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });
    accountState.settingsUpsert.mockResolvedValue({ error: null });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(
        (screen.getByLabelText("League Type") as HTMLSelectElement).value
      ).toBe("points");
    });
    fireEvent.change(screen.getByLabelText("League Type"), {
      target: { value: "categories" }
    });
    fireEvent.change(screen.getByLabelText("Points: GOALS"), {
      target: { value: "4.5" }
    });
    fireEvent.change(screen.getByLabelText("Roster: C"), {
      target: { value: "3" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save League Defaults" }));

    await waitFor(() => {
      expect(accountState.settingsUpsert).toHaveBeenCalledWith(
        {
          user_id: "user-1",
          league_type: "categories",
          scoring_categories: {
            GOALS: 4.5,
            ASSISTS: 2,
            PP_POINTS: 1,
            SHOTS_ON_GOAL: 0.2,
            HITS: 0.2,
            BLOCKED_SHOTS: 0.25
          },
          category_weights: {
            GOALS: 1,
            ASSISTS: 1,
            PP_POINTS: 1,
            SHOTS_ON_GOAL: 1,
            HITS: 1,
            BLOCKED_SHOTS: 1,
            WINS_GOALIE: 1,
            SAVES_GOALIE: 1,
            SAVE_PERCENTAGE: 1
          },
          roster_config: {
            C: 3,
            LW: 2,
            RW: 2,
            D: 4,
            G: 2,
            bench: 4,
            utility: 1
          },
          ui_preferences: {
            account_settings_section: "league-settings",
            league_settings_panel_open: true
          },
          active_context: {
            source_type: "manual",
            provider: null,
            external_league_id: null,
            external_team_id: null
          }
        },
        {
          onConflict: "user_id"
        }
      );
    });

    expect(await screen.findByText("League defaults saved.")).toBeTruthy();
  });

  it("lists saved teams and creates a new manual saved team", async () => {
    accountState.routerQuery = {
      section: "saved-teams"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.savedTeamsRows = [
      {
        id: "team-1",
        user_id: "user-1",
        name: "Dynasty Squad",
        source_type: "manual",
        provider: null,
        external_team_key: null,
        external_league_key: null,
        roster_json: { manualNotes: "Keeper-heavy roster." },
        settings_snapshot: { league_type: "points" },
        is_default: true,
        created_at: "2026-03-20T12:00:00.000Z",
        updated_at: "2026-03-22T12:00:00.000Z"
      }
    ];

    render(<AccountSettingsPage />);

    expect(await screen.findByText("Dynasty Squad")).toBeTruthy();
    expect(screen.getByText("Keeper-heavy roster.")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Team Name"), {
      target: { value: "Playoff Push" }
    });
    fireEvent.change(screen.getByLabelText("Manual Notes"), {
      target: { value: "Streaming-focused bench." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Team" }));

    await waitFor(() => {
      expect(accountState.savedTeamsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          name: "Playoff Push",
          source_type: "manual",
          is_default: false,
          roster_json: {
            manualNotes: "Streaming-focused bench."
          },
          settings_snapshot: expect.objectContaining({
            league_type: "points"
          })
        })
      );
    });

    expect(await screen.findByText("Saved team created.")).toBeTruthy();
    expect(screen.getByText("Playoff Push")).toBeTruthy();
  });

  it("edits a saved team and promotes another team to default", async () => {
    accountState.routerQuery = {
      section: "saved-teams"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.savedTeamsRows = [
      {
        id: "team-1",
        user_id: "user-1",
        name: "Dynasty Squad",
        source_type: "manual",
        provider: null,
        external_team_key: null,
        external_league_key: null,
        roster_json: { manualNotes: "Keeper-heavy roster." },
        settings_snapshot: { league_type: "points" },
        is_default: true,
        created_at: "2026-03-20T12:00:00.000Z",
        updated_at: "2026-03-22T12:00:00.000Z"
      },
      {
        id: "team-2",
        user_id: "user-1",
        name: "Redraft Flyers",
        source_type: "manual",
        provider: null,
        external_team_key: null,
        external_league_key: null,
        roster_json: { manualNotes: "High-upside late-round build." },
        settings_snapshot: { league_type: "categories" },
        is_default: false,
        created_at: "2026-03-24T12:00:00.000Z",
        updated_at: "2026-03-24T12:00:00.000Z"
      }
    ];

    render(<AccountSettingsPage />);

    expect(await screen.findByText("Redraft Flyers")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByDisplayValue("Redraft Flyers")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team Name"), {
      target: { value: "Redraft Rockets" }
    });
    fireEvent.click(screen.getByLabelText("Set as default team"));
    fireEvent.click(screen.getByRole("button", { name: "Update Saved Team" }));

    await waitFor(() => {
      expect(accountState.savedTeamsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_default: false
        }),
        "id",
        "team-1"
      );
      expect(accountState.savedTeamsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Redraft Rockets",
          is_default: true
        }),
        "id",
        "team-2"
      );
    });

    expect(await screen.findByText("Saved team updated.")).toBeTruthy();
    expect(screen.getByText("Redraft Rockets")).toBeTruthy();
  });

  it("deletes a saved team from the manual list", async () => {
    accountState.routerQuery = {
      section: "saved-teams"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.savedTeamsRows = [
      {
        id: "team-1",
        user_id: "user-1",
        name: "Dynasty Squad",
        source_type: "manual",
        provider: null,
        external_team_key: null,
        external_league_key: null,
        roster_json: { manualNotes: "Keeper-heavy roster." },
        settings_snapshot: { league_type: "points" },
        is_default: true,
        created_at: "2026-03-20T12:00:00.000Z",
        updated_at: "2026-03-22T12:00:00.000Z"
      }
    ];

    render(<AccountSettingsPage />);

    expect(await screen.findByText("Dynasty Squad")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(accountState.savedTeamsDelete).toHaveBeenCalledWith("id", "team-1");
    });

    expect(await screen.findByText('"Dynasty Squad" was removed.')).toBeTruthy();
    expect(
      screen.getByText(
        "No manual saved teams yet. Create one here to establish a default team before Yahoo, Fantrax, or ESPN connections are introduced."
      )
    ).toBeTruthy();
  });

  it("shows explicit provider architecture cards in connected accounts", async () => {
    accountState.routerQuery = {
      section: "connected-accounts"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });

    render(<AccountSettingsPage />);

    expect(await screen.findByText("Yahoo Fantasy")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect Yahoo Fantasy" })).toBeTruthy();
    expect(screen.getByText("Fantrax")).toBeTruthy();
    expect(screen.getAllByText("Patreon").length).toBeGreaterThan(1);
    expect(screen.getByText("ESPN")).toBeTruthy();
    expect(screen.getAllByText("No live token flow yet").length).toBeGreaterThan(0);
    expect(screen.getByText("Linked League and Team Context")).toBeTruthy();
    expect(
      screen.getByText(
        "Refresh on sign-in: planned preference toggle"
      )
    ).toBeTruthy();
    expect(
      screen.getByText("Cooldown window: planned anti-throttling lockout after a sync run")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Active league switcher: in-place context change without losing draft/dashboard progress"
      )
    ).toBeTruthy();
  });

  it("shows discovered Yahoo leagues and teams when the user is connected", async () => {
    accountState.routerQuery = {
      section: "connected-accounts",
      yahoo_status: "connected",
      yahoo_message: "Yahoo synced 2 teams across 2 leagues."
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });
    accountState.connectedAccountMaybeSingle.mockResolvedValue({
      data: {
        id: "yahoo-account-1",
        user_id: "user-1",
        provider: "yahoo",
        provider_user_id: "guid-123",
        account_label: "Tim's Yahoo",
        status: "connected",
        scopes: [],
        metadata: {},
        last_synced_at: "2026-03-27T12:00:00.000Z",
        created_at: "2026-03-27T12:00:00.000Z",
        updated_at: "2026-03-27T12:00:00.000Z"
      },
      error: null
    });
    accountState.externalLeaguesOrder.mockResolvedValue({
      data: [
        {
          id: "league-1",
          connected_account_id: "yahoo-account-1",
          user_id: "user-1",
          provider: "yahoo",
          external_league_key: "nhl.l.1",
          league_name: "Keeper League",
          season_key: "2026",
          league_metadata: {},
          scoring_settings: {},
          roster_settings: {},
          imported_at: "2026-03-27T12:00:00.000Z",
          created_at: "2026-03-27T12:00:00.000Z",
          updated_at: "2026-03-27T12:00:00.000Z"
        }
      ],
      error: null
    });
    accountState.externalTeamsOrder.mockResolvedValue({
      data: [
        {
          id: "team-1",
          external_league_id: "league-1",
          connected_account_id: "yahoo-account-1",
          user_id: "user-1",
          provider: "yahoo",
          external_team_key: "nhl.l.1.t.1",
          team_name: "Tim's Test Team",
          team_metadata: {},
          roster_snapshot: {},
          imported_at: "2026-03-27T12:00:00.000Z",
          created_at: "2026-03-27T12:00:00.000Z",
          updated_at: "2026-03-27T12:00:00.000Z"
        }
      ],
      error: null
    });
    accountState.providerPreferencesMaybeSingle.mockResolvedValue({
      data: {
        id: "pref-1",
        user_id: "user-1",
        provider: "yahoo",
        connected_account_id: "yahoo-account-1",
        default_external_league_id: "league-1",
        default_external_team_id: "team-1",
        refresh_on_login: false,
        active_context: {},
        created_at: "2026-03-27T12:00:00.000Z",
        updated_at: "2026-03-27T12:00:00.000Z"
      },
      error: null
    });

    render(<AccountSettingsPage />);

    expect(await screen.findByText("Yahoo synced 2 teams across 2 leagues.")).toBeTruthy();
    expect(screen.getByText("Connected account label: Tim's Yahoo")).toBeTruthy();
    expect(screen.getByText("Keeper League (default league)")).toBeTruthy();
    expect(screen.getByText("Tim's Test Team")).toBeTruthy();
    expect(screen.getAllByText("Default team: Tim's Test Team").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Disconnect Yahoo Fantasy" })
    ).toBeTruthy();
    expect(screen.getByText("Default Team")).toBeTruthy();
  });

  it("shows Patreon as an account-linked entitlement placeholder, not site auth", async () => {
    accountState.routerQuery = {
      section: "patreon"
    };
    accountState.profileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "Tim Tester",
        avatar_url: null,
        timezone: "America/Chicago"
      },
      error: null
    });

    render(<AccountSettingsPage />);

    expect(await screen.findByText("Patreon Account Link and Entitlements")).toBeTruthy();
    expect(screen.getByText("Connection Intent")).toBeTruthy();
    expect(screen.getByText("Entitlement Model")).toBeTruthy();
    expect(screen.getByText("Anti-Sharing Controls")).toBeTruthy();
    expect(
      screen.getByText(
        "Connection location: account settings, not auth modal"
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Duplicate attachment check: planned single-account Patreon identity rule"
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Failure state: clear mismatch messaging without blocking core site auth"
      )
    ).toBeTruthy();
  });
});
