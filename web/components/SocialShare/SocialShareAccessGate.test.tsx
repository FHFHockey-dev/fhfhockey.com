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

  it("serves only a locked shell during initial auth and role revalidation", () => {
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

  it("keeps valid and unknown page responses private, with only generic page props", async () => {
    const setHeader = vi.fn();
    const result = await getServerSideProps({ params: { format: "game-grid" }, res: { setHeader } } as any);
    expect(result).toEqual({ props: { format: "game-grid", asOf: expect.any(String) } });
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
    expect(await getServerSideProps({ params: { format: "publish" }, res: { setHeader } } as any)).toEqual({ notFound: true });
  });
});
