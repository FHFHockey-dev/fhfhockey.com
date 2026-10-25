import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppProps } from "next/app";

type TelemetryEvent = { type: string; url: string; route?: string };
type TelemetryProps = { beforeSend: (event: TelemetryEvent) => TelemetryEvent | null };
const telemetry = vi.hoisted(() => ({ analytics: vi.fn(), speedInsights: vi.fn() }));

vi.mock("@vercel/analytics/react", () => ({
  Analytics: (props: TelemetryProps) => {
    telemetry.analytics(props);
    return <span data-testid="analytics" />;
  },
}));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: (props: TelemetryProps) => {
    telemetry.speedInsights(props);
    return <span data-testid="speed-insights" />;
  },
}));
vi.mock("next/head", () => ({ default: () => null }));
vi.mock("next/dynamic", () => ({
  default: () => ({ children }: any) => <div data-testid="snackbar">{children}</div>,
}));
vi.mock("next-seo", () => ({ DefaultSeo: () => null }));
vi.mock("next-seo.config", () => ({ default: { openGraph: {} } }));
vi.mock("lib/seo", () => ({
  canonicalUrl: (path: string) => `https://synthetic.invalid${path}`,
  isNoindexPath: (path: string) => path.startsWith("/auth"),
}));
vi.mock("contexts/AuthProviderContext/index", () => ({
  default: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
}));
vi.mock("@tanstack/react-query", () => ({
  QueryClient: class {},
  QueryClientProvider: ({ children }: any) => <div data-testid="query-provider">{children}</div>,
}));
vi.mock("../../components/Layout", () => ({
  default: ({ children }: any) => <main>{children}</main>,
}));
vi.mock("../../styles/globals.css", () => ({}));
vi.mock("../../styles/vars.scss", () => ({}));
vi.mock("../../styles/Home.module.scss", () => ({}));
vi.mock("components/TeamLandingPage/teamLandingPage.scss", () => ({}));

import MyApp from "pages/_app";

function props(pathname: string, asPath = pathname): AppProps {
  return {
    Component: ({ label }: { label: string }) => <div>{label}</div>,
    pageProps: { label: "Synthetic page content" },
    router: { pathname, asPath },
  } as unknown as AppProps;
}

function filters() {
  return [telemetry.analytics, telemetry.speedInsights].map((mock) =>
    (mock.mock.calls.at(-1)![0] as TelemetryProps).beforeSend,
  );
}

describe("app credential-route telemetry boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in app composition test"); }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it.each([
    ["/auth/callback", "/auth/callback?code=synthetic-code"],
    ["/auth/callback", "/auth/callback#access_token=synthetic-access&refresh_token=synthetic-refresh"],
    ["/auth/reset-password", "/auth/reset-password?token_hash=synthetic-hash&type=recovery"],
    ["/auth/reset-password", "/auth/reset-password#access_token=synthetic-access"],
    ["/auth/callback", "/auth/callback"],
    ["/auth/reset-password", "/auth/reset-password/"],
  ])("never mounts telemetry on the first %s render (%s)", (pathname, asPath) => {
    window.history.replaceState({}, "", asPath);
    render(<MyApp {...props(pathname, asPath)} />);
    expect(telemetry.analytics).not.toHaveBeenCalled();
    expect(telemetry.speedInsights).not.toHaveBeenCalled();
    expect(screen.getByText("Synthetic page content")).toBeTruthy();
    expect(screen.getByTestId("auth-provider")).toBeTruthy();
    expect(screen.getByTestId("query-provider")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
  });

  it.each(["/auth/callback", "/auth/reset-password"])("omits telemetry from the %s server composition", (pathname) => {
    const output = renderToString(<MyApp {...props(pathname)} />);
    expect(output).toContain("Synthetic page content");
    expect(telemetry.analytics).not.toHaveBeenCalled();
    expect(telemetry.speedInsights).not.toHaveBeenCalled();
  });

  it.each([
    ["/auth/callback", "/account", "/account"],
    ["/account", "/auth/reset-password?code=synthetic-code", "/account"],
    ["/account", "/account", "/auth/callback?code=synthetic-code"],
  ])("suppresses mismatched router/browser state (%s, %s, %s)", (pathname, asPath, browserPath) => {
    window.history.replaceState({}, "", browserPath);
    render(<MyApp {...props(pathname, asPath)} />);
    expect(telemetry.analytics).not.toHaveBeenCalled();
    expect(telemetry.speedInsights).not.toHaveBeenCalled();
  });

  it.each(["/", "/auth", "/db", "/account", "/auth/callback-help"])("retains ordinary telemetry and page composition on %s", (pathname) => {
    window.history.replaceState({}, "", pathname);
    render(<MyApp {...props(pathname)} />);
    expect(screen.getByTestId("analytics")).toBeTruthy();
    expect(screen.getByTestId("speed-insights")).toBeTruthy();
    expect(screen.getByText("Synthetic page content")).toBeTruthy();
    expect(Boolean(screen.queryByTestId("snackbar"))).toBe(pathname === "/auth" || pathname === "/db");
    for (const beforeSend of filters()) {
      const event = { type: "pageview", url: `https://synthetic.invalid${pathname}?ordinary=1` };
      expect(beforeSend(event)).toBe(event);
    }
  });

  it.each(["/auth/callback", "/auth/reset-password"])("blocks retained SDK callbacks through transitions to and from %s", (pathname) => {
    const view = render(<MyApp {...props("/")} />);
    const retainedFilters = filters();
    // The old SDK callback may run after URL mutation and before React updates.
    window.history.replaceState({}, "", `${pathname}?code=synthetic-code#access_token=synthetic-access`);
    for (const beforeSend of retainedFilters) {
      expect(beforeSend({ type: "vital", url: "https://synthetic.invalid/" })).toBeNull();
    }
    view.rerender(<MyApp {...props(pathname)} />);
    expect(screen.queryByTestId("analytics")).toBeNull();
    expect(screen.queryByTestId("speed-insights")).toBeNull();
    // URL scrubbing does not opt the credential page back into telemetry.
    window.history.replaceState({}, "", pathname);
    view.rerender(<MyApp {...props(pathname)} />);
    expect(screen.queryByTestId("analytics")).toBeNull();
    expect(screen.queryByTestId("speed-insights")).toBeNull();
    window.history.replaceState({}, "", "/account");
    view.rerender(<MyApp {...props("/account")} />);
    expect(screen.getByTestId("analytics")).toBeTruthy();
    expect(screen.getByTestId("speed-insights")).toBeTruthy();
    for (const beforeSend of [...retainedFilters, ...filters()]) {
      // A delayed credential-page measurement is rejected after leaving it.
      expect(beforeSend({ type: "vital", url: `https://synthetic.invalid${pathname}?code=synthetic-code` })).toBeNull();
      expect(beforeSend({ type: "vital", url: "https://synthetic.invalid/account", route: pathname })).toBeNull();
      const ordinaryEvent = { type: "pageview", url: "https://synthetic.invalid/account" };
      expect(beforeSend(ordinaryEvent)).toBe(ordinaryEvent);
    }
  });
});
