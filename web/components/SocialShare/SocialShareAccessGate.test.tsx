import { useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: { isLoading: true, isRoleLoading: true, user: null as any } }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => auth.value }));
vi.mock("next-seo", () => ({ NextSeo: () => null }));
vi.mock("components/Layout/Container", () => ({ default: ({ children }: any) => <div>{children}</div> }));
const studio = vi.hoisted(() => ({ mounted: vi.fn() }));
vi.mock("components/SocialShare/SocialShare", () => ({ default: () => { studio.mounted(); return <p>Protected studio</p>; } }));
import SocialShareAccessGate from "./SocialShareAccessGate";
import SocialSharePage, { getServerSideProps } from "pages/social-share/[format]";
import { SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
function state(role: unknown, id = "one") {
  auth.value = { isLoading: false, isRoleLoading: false, user: role === undefined ? null : { id, role } };
}

describe("social-share locked page", () => {
  it.each([undefined, null, "basic", "developer", "social-editor"])("keeps the workspace unmounted for %j", role => {
    state(role);
    render(<SocialSharePage format="game-grid" asOf="2026-10-24T19:00:00Z" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(studio.mounted).not.toHaveBeenCalled();
    if (role === undefined) expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth");
  });

  it.each(["social_editor", "admin"])("mounts the existing workspace for %s", role => {
    state(role);
    render(<SocialSharePage format="game-grid" asOf="2026-10-24T19:00:00Z" />);
    expect(screen.getByText("Protected studio")).toBeTruthy();
  });

  it("serves only a locked shell during initial auth and the first unresolved role check", () => {
    auth.value = { isLoading: true, isRoleLoading: true, user: null };
    const html = renderToString(<SocialSharePage format="game-grid" asOf="2026-10-24T19:00:00Z" />);
    expect(html).toContain("Checking share studio access");
    expect(html).not.toContain("Protected studio");
    state("social_editor"); auth.value.isRoleLoading = true;
    render(<SocialSharePage format="game-grid" asOf="2026-10-24T19:00:00Z" />);
    expect(screen.getByRole("status").textContent).toContain("Checking");
    expect(studio.mounted).not.toHaveBeenCalled();
  });

  it("discards the old workspace on account switch and unmounts it on sign-out/revocation", () => {
    const unmounted = vi.fn();
    function Workspace() {
      const [edition, setEdition] = useState("Fresh edition");
      useEffect(() => () => { unmounted(); }, []);
      return <button onClick={() => setEdition("Previous user's edition")}>{edition}</button>;
    }
    state("social_editor");
    const view = render(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    fireEvent.click(screen.getByRole("button"));
    state("social_editor", "two");
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.getByText("Fresh edition")).toBeTruthy();
    expect(screen.queryByText("Previous user's edition")).toBeNull();
    state(null, "two");
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.queryByRole("button")).toBeNull();
    state(undefined);
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(unmounted).toHaveBeenCalledTimes(2);
  });

  it("preserves mounted state only after the same user has completed a successful role check", () => {
    const mounted = vi.fn(), unmounted = vi.fn();
    function Workspace() {
      const [value, setValue] = useState("Fresh edition");
      useEffect(() => { mounted(); return () => { unmounted(); }; }, []);
      return <input aria-label="Draft edition" value={value} onChange={event => setValue(event.target.value)} />;
    }
    state("social_editor"); auth.value.isRoleLoading = true;
    const view = render(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
    state("social_editor");
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Unsaved studio selection" } });
    for (const pending of [true, false, true, false]) {
      auth.value.isRoleLoading = pending;
      view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
      expect(screen.getByRole("textbox")).toBe(input);
      expect((input as HTMLInputElement).value).toBe("Unsaved studio selection");
      expect(mounted).toHaveBeenCalledTimes(1);
      expect(unmounted).not.toHaveBeenCalled();
    }
  });

  it.each(["basic", null, undefined])("closes a preserved studio on revoked role, lookup failure or sign-out (%j)", role => {
    const unmounted = vi.fn();
    function Workspace() {
      useEffect(() => () => { unmounted(); }, []);
      return <p>Authorized child</p>;
    }
    state("admin");
    const view = render(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    auth.value.isRoleLoading = true;
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.getByText("Authorized child")).toBeTruthy();
    // The provider maps both rejected and error-returning role reads to null.
    state(role);
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.queryByText("Authorized child")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(unmounted).toHaveBeenCalledTimes(1);
    state("admin"); auth.value.isRoleLoading = true;
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.queryByText("Authorized child")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("does not carry a previous grant or workspace through another user's pending check", () => {
    const unmounted = vi.fn();
    function Workspace() {
      const [value, setValue] = useState("Fresh edition");
      useEffect(() => () => { unmounted(); }, []);
      return <button onClick={() => setValue("Private draft")}>{value}</button>;
    }
    state("social_editor");
    const view = render(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    fireEvent.click(screen.getByRole("button"));
    state("social_editor", "two"); auth.value.isRoleLoading = true;
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(unmounted).toHaveBeenCalledTimes(1);
    state("social_editor", "two");
    view.rerender(<SocialShareAccessGate><Workspace /></SocialShareAccessGate>);
    expect(screen.getByText("Fresh edition")).toBeTruthy();
    expect(screen.queryByText("Private draft")).toBeNull();
  });

  it("keeps valid and unknown page responses private, with only generic page props", async () => {
    const setHeader = vi.fn();
    const result = await getServerSideProps({ params: { format: "game-grid" }, res: { setHeader } } as any);
    expect(result).toEqual({ props: { format: "game-grid", asOf: expect.any(String) } });
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
    expect(await getServerSideProps({ params: { format: "publish" }, res: { setHeader } } as any)).toEqual({ notFound: true });
  });
});
