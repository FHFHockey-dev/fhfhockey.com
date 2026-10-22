import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, user: null as any },
  from: vi.fn(),
  getSession: vi.fn(),
  doPOST: vi.fn()
}));

vi.mock("next/head", () => ({ default: () => null }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: {}, push: vi.fn(), replace: vi.fn(), isReady: true }) }));
vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => mocks.auth,
  useUser: () => mocks.auth.user
}));
vi.mock("lib/supabase", () => ({
  default: { from: mocks.from, auth: { getSession: mocks.getSession } },
  doPOST: mocks.doPOST,
  createClientWithToken: vi.fn()
}));

import { ADMIN_PROHIBITED_MESSAGE } from "components/Admin/AdminPageGate";
import DbIndexPage from "pages/db";
import PlayerAliasesPage from "pages/db/player-aliases";
import PlayerForecastReviewPage from "pages/db/player-forecast-review";
import PlayerForecastSeasonEditorPage from "pages/db/player-forecast-season-editor";
import RouteRunnerPage from "pages/db/runner";
import TweetPatternReviewPage from "pages/db/tweet-pattern-review";
import UpsertProjectionsPage from "pages/db/upsert-projections";

const pages = [
  ["/db", DbIndexPage],
  ["/db/runner", RouteRunnerPage],
  ["/db/player-aliases", PlayerAliasesPage],
  ["/db/player-forecast-review", PlayerForecastReviewPage],
  ["/db/player-forecast-season-editor", PlayerForecastSeasonEditorPage],
  ["/db/tweet-pattern-review", TweetPatternReviewPage],
  ["/db/upsert-projections", UpsertProjectionsPage]
] as const;

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  ["signed out", null],
  ["a non-admin", { id: "u1", role: null }]
])("/db pages for %s", (_label, user) => {
  it.each(pages)("%s shows the prohibited message and fetches nothing", (_path, Page) => {
    mocks.auth = { isLoading: false, user };
    render(<Page />);
    expect(screen.getByText(ADMIN_PROHIBITED_MESSAGE)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.doPOST).not.toHaveBeenCalled();
  });
});
