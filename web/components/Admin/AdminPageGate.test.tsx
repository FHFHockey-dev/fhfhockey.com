import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const auth = vi.hoisted(() => ({ value: { isLoading: true, user: null as any } as any }));
vi.mock("next/head", () => ({ default: () => null }));
vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => auth.value,
  useUser: () => auth.value.user
}));

import AdminPageGate, { ADMIN_PROHIBITED_MESSAGE } from "./AdminPageGate";

function renderGate(
  value: { isLoading: boolean; isRoleLoading?: boolean; user: any },
  options: { allowReviewToken?: boolean; search?: string } = {}
) {
  auth.value = value;
  window.history.replaceState(null, "", `/db/test${options.search ?? ""}`);
  const child = vi.fn(() => <p>admin tools</p>);
  const Child = () => child();
  render(
    <AdminPageGate allowReviewToken={options.allowReviewToken}>
      <Child />
    </AdminPageGate>
  );
  return child;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("AdminPageGate", () => {
  it("shows a neutral check while auth loads and mounts nothing", () => {
    const child = renderGate({ isLoading: true, user: null });
    expect(screen.getByText("Checking administrator access…")).toBeTruthy();
    expect(child).not.toHaveBeenCalled();
  });

  it("prohibits a signed-out visitor with a sign-in link and a link home", () => {
    const child = renderGate({ isLoading: false, user: null });
    expect(screen.getByText(ADMIN_PROHIBITED_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("You are signed out");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth");
    expect(screen.getByRole("link", { name: "Return home" }).getAttribute("href")).toBe("/");
    expect(child).not.toHaveBeenCalled();
  });

  it("prohibits a signed-in non-admin", () => {
    const child = renderGate({ isLoading: false, user: { id: "u1", role: null } });
    expect(screen.getByText(ADMIN_PROHIBITED_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("not an administrator");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(child).not.toHaveBeenCalled();
  });

  it("waits while a signed-in user's role is still unknown", () => {
    const child = renderGate({ isLoading: false, isRoleLoading: true, user: { id: "u1", role: null } });
    expect(screen.getByText("Checking administrator access…")).toBeTruthy();
    expect(screen.queryByText(ADMIN_PROHIBITED_MESSAGE)).toBeNull();
    expect(child).not.toHaveBeenCalled();
  });

  it("keeps a known admin's page mounted while the role is re-read", () => {
    const child = renderGate({ isLoading: false, isRoleLoading: true, user: { id: "a1", role: "admin" } });
    expect(screen.getByText("admin tools")).toBeTruthy();
    expect(child).toHaveBeenCalled();
  });

  it("lets an emailed review link through only where the page allows it", () => {
    const allowed = renderGate({ isLoading: false, user: null }, { allowReviewToken: true, search: "?reviewToken=tok" });
    expect(screen.getByText("admin tools")).toBeTruthy();
    expect(allowed).toHaveBeenCalled();
    cleanup();

    const notAllowed = renderGate({ isLoading: false, user: null }, { search: "?reviewToken=tok" });
    expect(screen.getByText(ADMIN_PROHIBITED_MESSAGE)).toBeTruthy();
    expect(notAllowed).not.toHaveBeenCalled();
    cleanup();

    const blank = renderGate({ isLoading: false, user: null }, { allowReviewToken: true, search: "?reviewToken=%20" });
    expect(screen.getByText(ADMIN_PROHIBITED_MESSAGE)).toBeTruthy();
    expect(blank).not.toHaveBeenCalled();
  });

  it("renders the children for an admin", () => {
    const child = renderGate({ isLoading: false, user: { id: "a1", role: "admin" } });
    expect(screen.getByText("admin tools")).toBeTruthy();
    expect(screen.queryByText(ADMIN_PROHIBITED_MESSAGE)).toBeNull();
    expect(child).toHaveBeenCalled();
  });
});
