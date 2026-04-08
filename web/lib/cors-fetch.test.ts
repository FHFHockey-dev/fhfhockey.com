import { afterEach, describe, expect, it, vi } from "vitest";

describe("cors-fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function importServerFetch() {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    return (await import("./cors-fetch")).default;
  }

  it("merges caller headers with the shared server defaults", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const Fetch = await importServerFetch();

    await Fetch("https://example.com/data", {
      headers: {
        Authorization: "Bearer token",
        Accept: "text/html"
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Accept: "text/html",
      Authorization: "Bearer token",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    });
  });

  it("keeps no-store cache by default but allows explicit override", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const Fetch = await importServerFetch();

    await Fetch("https://example.com/data");
    await Fetch("https://example.com/data-2", { cache: "force-cache" });

    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];

    expect(firstInit.cache).toBe("no-store");
    expect(secondInit.cache).toBe("force-cache");
  });
});
