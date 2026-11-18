// Dedicated offline artifact harness. Run with the trending artifact Vitest config.
import React, { useState } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SWRConfig } from "swr";
import { AsyncLocalStorage } from "node:async_hooks";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import * as fixture from "./fixture.mjs";

vi.mock("lib/supabase/server", async () => {
  const { query } = await import("./fixture.mjs");
  const client = { from: query };
  return {
    default: client,
    supabase: client,
    getServiceRoleClient: () => client,
  };
});
const nav = vi.hoisted(() => ({
  query: {},
  replace: null as any,
  isReady: true,
  pathname: "/rankings",
}));
vi.mock("next/router", () => ({ useRouter: () => nav }));
import RankingsPage from "pages/rankings";
import matrix from "pages/api/v1/contextual-rankings/matrix";
import comparison from "pages/api/v1/contextual-rankings/comparison";
import metadata from "pages/api/v1/contextual-rankings/metadata";
import trending from "pages/api/v1/contextual-rankings/trending";
import war from "pages/api/v1/contextual-rankings/war";
import { clearPlayerMatrixSurfaceCachesForTests } from "lib/rankings/playerMatrix";
import * as trendingModule from "lib/rankings/trending";
import { clearContextualRankingsQueryCachesForTests } from "lib/rankings/rankingQueries";
import { clearEntityMetricRankingReaderCachesForTests } from "lib/rankings/entityMetricRankingReader";
const folder = resolve(
  "../tasks/artifacts/rankings-current-season-2026-11-18/trending",
);
const version = process.env.TRENDING_VERSION!;
const reps = Number(process.env.TRENDING_REPS || 5);
const scope = new AsyncLocalStorage<any>();
const routes: any = { matrix, comparison, metadata, trending, war };
const samples: any[] = [];
const calls: any[] = [];
let lastTrending: any, lastComparison: any, lastMatrix: any, dataset: any;
let consoleError: any;
const issues: string[] = [];
const round = (n: number) => Math.round(n * 10) / 10;
async function localFetch(input: any) {
  const url = String(input);
  if (!url.startsWith("/api/v1/")) throw Error("Unhandled offline URL " + url);
  const u = new URL(url, "http://localhost");
  const route = u.pathname.split("/").at(-1)!;
  if (!routes[route] && route !== "season")
    throw Error("Unknown local route " + url);
  const t = performance.now();
  const call = { route, url, ms: 0, reads: 0, rows: 0, bytes: 0, tables: {} };
  calls.push(call);
  return scope.run(call, async () => {
    let payload: any,
      status = 200;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: any) {
        payload = body;
        return this;
      },
      setHeader() {},
    };
    if (route === "season") payload = { seasonId: 20262027 };
    else
      await routes[route](
        { method: "GET", query: Object.fromEntries(u.searchParams) },
        res,
      );
    if (status !== 200) {
      issues.push(JSON.stringify(payload));
      throw Error(JSON.stringify(payload));
    }
    const raw = JSON.stringify(payload);
    if (route === "trending") lastTrending = payload;
    if (route === "comparison") lastComparison = payload;
    if (route === "matrix") lastMatrix = payload;
    call.ms = round(performance.now() - t);
    return new Response(raw, {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}
function mountPage(initialQuery = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const cache = new Map();
  function App() {
    const [query, setQuery] = useState(initialQuery);
    Object.assign(nav, {
      query,
      replace: async (to: any) => setQuery(to.query),
    });
    return (
      <QueryClientProvider client={queryClient}>
        <SWRConfig value={{ provider: () => cache }}>
          <RankingsPage />
        </SWRConfig>
      </QueryClientProvider>
    );
  }
  const view = render(<App />);
  return () => {
    view.unmount();
    queryClient.clear();
  };
}
function clickButton(node: HTMLButtonElement | null) {
  if (!node) throw Error("Button missing");
  act(() => node.click());
}
function drawer() {
  return document.querySelector<HTMLButtonElement>(
    '[aria-controls="rankings-snapshot-drawer"]',
  );
}
function tab(name: string) {
  return (
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        'nav[aria-label="Rankings views"] button',
      ),
    ].find((button) => button.textContent?.trim() === name) || null
  );
}
async function comparisonReady() {
  await waitFor(
    () => {
      if (issues.length) throw Error(issues.join("\n"));
      expect(drawer()?.getAttribute("aria-expanded")).toBe("true");
      const articles = [
        ...document.querySelectorAll(
          '[aria-label="Comparison context"] article',
        ),
      ];
      expect(articles.length).toBe(6);
      expect(
        articles.every((article) =>
          [...article.querySelectorAll("dt")].some(
            (dt) =>
              dt.textContent === "Opportunity Evidence" &&
              /^(TOI Up|Usage Drop|Shot Volume Spike):/.test(
                dt.nextElementSibling!.textContent!,
              ),
          ),
        ),
      ).toBe(true);
    },
    {
      timeout: 45000,
      interval: 15,
      onTimeout: (e) =>
        new Error(e.message + " " + JSON.stringify({ calls, issues })),
    },
  );
  return [
    ...document.querySelectorAll('[aria-label="Comparison context"] article'),
  ].map((article, i) => ({
    id: lastComparison.subjects[i].row.entity.id,
    subject: article.querySelector("h3")!.textContent,
    evidence: [...article.querySelectorAll("dt")].find(
      (dt) => dt.textContent === "Opportunity Evidence",
    )!.nextElementSibling!.textContent,
  }));
}
async function trendingReady() {
  await waitFor(
    () => {
      if (issues.length) throw Error(issues.join("\n"));
      expect(
        document.querySelectorAll(
          '[aria-label="Trending players"] tbody tr td:first-child strong',
        ).length,
      ).toBe(25);
    },
    {
      timeout: 45000,
      interval: 15,
      onTimeout: (e) =>
        new Error(e.message + " " + JSON.stringify({ calls, issues })),
    },
  );
  return [
    ...document.querySelectorAll('[aria-label="Trending players"] tbody tr'),
  ].map((tr, i) => ({
    id: lastTrending.rows[i].entity.id,
    player: tr.querySelector("td strong")!.textContent,
    cells: [...tr.querySelectorAll("td")].map((td) => td.textContent),
    signals: [...tr.querySelectorAll("[title]")].map((el) =>
      el.getAttribute("title"),
    ),
  }));
}
function clearServer() {
  clearContextualRankingsQueryCachesForTests();
  clearPlayerMatrixSurfaceCachesForTests();
  clearEntityMetricRankingReaderCachesForTests();
  (trendingModule as any).clearTrendingSurfaceCacheForTests?.();
}
const parity = new Map<string, string>();
function capture(
  name: string,
  rep: number,
  start: number,
  from: number,
  visible: any,
  elapsed: number,
) {
  const rowType = name.includes("comparison") ? "comparison" : "trending";
  if (rowType === "comparison") {
    expect(lastMatrix.meta.rankingSource).toBe("entity_metric_rankings");
    expect(lastMatrix.meta.snapshotDate).toBe(fixture.cutoff);
    expect(lastMatrix.meta.totalRankedRows).toBe(750);
    expect(lastMatrix.rows.length).toBe(10);
    for (const row of [
      ...lastMatrix.rows,
      ...lastComparison.subjects.map((s: any) => s.row),
    ]) {
      expect(row.composite.snapshotDate).toBe(fixture.cutoff);
      expect(row.composite.methodologyVersion).toBe("contextual_composites_v3");
      expect(row.composite.mcmScore).toBe(
        90 - ((row.entity.id - 8470000) % 70),
      );
    }
    if (name === "comparison.cold") {
      const matrixReads = calls
        .slice(from)
        .find((c) => c.route === "matrix").tables;
      expect(matrixReads.ranking_publications.rows).toBe(6); // Latest markers and oldest marker
      expect(matrixReads.skater_composite_ratings.rows).toBe(751); // Date probe plus 750 composites
    }
  }
  const stable = JSON.stringify(visible);
  if (!parity.has(rowType)) parity.set(rowType, stable);
  expect(stable).toBe(parity.get(rowType));
  const data = JSON.stringify(lastTrending.rows);
  if (!dataset) dataset = data;
  expect(data).toBe(dataset);
  const requests = calls.slice(from).map((call) => ({ ...call }));
  samples.push({ scenario: name, rep, ms: round(elapsed - start), requests });
}
async function comparisonVisit(
  rep: number,
  temperature: string,
  alsoNavigate: boolean,
) {
  const from = calls.length,
    start = performance.now();
  const close = mountPage();
  clickButton(drawer());
  const comp = await comparisonReady();
  capture(
    `comparison.${temperature}`,
    rep,
    start,
    from,
    comp,
    performance.now(),
  );
  if (alsoNavigate) {
    const from = calls.length,
      start = performance.now();
    clickButton(tab("Trending"));
    const visible = await trendingReady();
    capture(
      "trending.warm-client",
      rep,
      start,
      from,
      visible,
      performance.now(),
    );
    const again = calls.length,
      returnStart = performance.now();
    clickButton(tab("Rankings"));
    if (drawer()?.getAttribute("aria-expanded") !== "true")
      clickButton(drawer());
    const visibleComp = await comparisonReady();
    capture(
      "comparison.warm-client",
      rep,
      returnStart,
      again,
      visibleComp,
      performance.now(),
    );
  }
  close();
}
async function trendingVisit(rep: number, temperature: string) {
  const close = mountPage({ tab: "war" });
  await waitFor(() =>
    expect(
      document.querySelector(
        '[aria-label="Wins Above Replacement status"] article',
      ),
    ).toBeTruthy(),
  );
  const from = calls.length,
    start = performance.now();
  clickButton(tab("Trending"));
  const visible = await trendingReady();
  capture(
    `trending.${temperature}`,
    rep,
    start,
    from,
    visible,
    performance.now(),
  );
  close();
}
beforeAll(() => {
  vi.stubGlobal("fetch", localFetch);
  vi.setSystemTime(new Date(fixture.cutoff + "T23:00:00Z"));
  Object.defineProperty(window, "innerWidth", {
    value: 1440,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: 960,
    configurable: true,
  });
  fixture.observeReads((read: any) => {
    const call = scope.getStore();
    if (!call) throw Error("Missing API context");
    call.reads++;
    call.rows += read.rows;
    call.bytes += read.bytes;
    const table = (call.tables[read.table] ||= { reads: 0, rows: 0, bytes: 0 });
    table.reads++;
    table.rows += read.rows;
    table.bytes += read.bytes;
  });
  consoleError = vi.spyOn(console, "error").mockImplementation((...args) => {
    if (!String(args[0]).includes("not wrapped in act"))
      issues.push(args.map(String).join(" "));
  });
});
afterAll(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});
it("measures both usable rows through actual page interactions", async () => {
  for (let rep = 0; rep <= reps; rep++) {
    clearServer();
    await comparisonVisit(rep, "cold", false);
    await comparisonVisit(rep, "warm-server", true);
    clearServer();
    await trendingVisit(rep, "cold");
    await trendingVisit(rep, "warm-server");
  }
  expect(issues).toEqual([]);
  const values = {
    comparison: JSON.parse(parity.get("comparison")!),
    trending: JSON.parse(parity.get("trending")!),
    apiRows: JSON.parse(dataset),
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");
  if (version === "after")
    expect(values).toEqual(
      JSON.parse(readFileSync(resolve(folder, "before-rows.json"), "utf8")),
    );
  else
    writeFileSync(
      resolve(folder, "before-rows.json"),
      JSON.stringify(values, null, 2) + "\n",
    );
  writeFileSync(
    resolve(folder, version + "-samples.json"),
    JSON.stringify(
      {
        version,
        reps,
        cutoff: fixture.cutoff,
        paritySha256: hash,
        samples: samples.filter((s) => s.rep > 0),
      },
      null,
      2,
    ) + "\n",
  );
});
