import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  loadYahooGlobalCredentials,
  persistYahooGlobalTokens,
  YahooGlobalCredentialError,
} from "./globalCredentials";

function createCredentialClient(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as any,
    from,
    select,
    single,
  };
}

describe("Yahoo global credential owner", () => {
  it("loads one complete credential row through exact server-only columns", async () => {
    const credentials = {
      id: 7,
      consumer_key: "consumer",
      consumer_secret: "secret",
      access_token: "access",
      refresh_token: "refresh",
    };
    const { client, from, select } = createCredentialClient({
      data: credentials,
      error: null,
    });

    await expect(loadYahooGlobalCredentials(client)).resolves.toEqual(
      credentials,
    );
    expect(from).toHaveBeenCalledWith("yahoo_api_credentials");
    expect(select).toHaveBeenCalledWith(
      "id, consumer_key, consumer_secret, access_token, refresh_token",
    );
  });

  it.each([
    {
      data: null,
      error: { message: "database detail with sensitive-fragment" },
    },
    {
      data: {
        id: 7,
        consumer_key: "consumer",
        consumer_secret: "",
        access_token: "access",
        refresh_token: "refresh",
      },
      error: null,
    },
  ])("fails closed without provider or database detail", async (result) => {
    const { client } = createCredentialClient(result);

    const promise = loadYahooGlobalCredentials(client);

    await expect(promise).rejects.toEqual(
      new YahooGlobalCredentialError(
        "Yahoo global credentials are unavailable.",
      ),
    );
    await expect(promise).rejects.not.toThrow(/sensitive-fragment/);
  });

  it("validates refreshed tokens before issuing a database update", async () => {
    const from = vi.fn();

    await expect(
      persistYahooGlobalTokens({ from } as any, 7, {
        access_token: " ",
        refresh_token: "refresh",
      }),
    ).rejects.toEqual(
      new YahooGlobalCredentialError(
        "Yahoo refreshed credentials are invalid.",
      ),
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("persists exact refreshed tokens and redacts storage failures", async () => {
    const eq = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { message: "storage detail with sensitive-fragment" },
      });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as any;
    const tokens = {
      access_token: "new-access",
      refresh_token: "new-refresh",
    };

    await expect(
      persistYahooGlobalTokens(client, 7, tokens),
    ).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: "new-access",
        refresh_token: "new-refresh",
      }),
    );
    expect(eq).toHaveBeenNthCalledWith(1, "id", 7);

    const failed = persistYahooGlobalTokens(client, 7, tokens);
    await expect(failed).rejects.toEqual(
      new YahooGlobalCredentialError(
        "Yahoo refreshed credentials could not be stored.",
      ),
    );
    await expect(failed).rejects.not.toThrow(/sensitive-fragment/);
  });

  it("keeps every active global route on the shared owner", () => {
    const routes = [
      "manual-refresh-yahoo-token.ts",
      "update-yahoo-players.ts",
      "update-yahoo-weeks.ts",
    ];

    for (const route of routes) {
      const source = fs.readFileSync(
        path.join(process.cwd(), "pages/api/v1/db", route),
        "utf8",
      );
      expect(source).toContain(
        'from "lib/integrations/yahoo/globalCredentials"',
      );
      expect(source).not.toContain('.from("yahoo_api_credentials")');
      expect(source).not.toMatch(
        /NEXT_PUBLIC_(?:SUPABASE_PUBLIC_KEY|YAHOO|.*TOKEN)/,
      );
    }
  });
});
