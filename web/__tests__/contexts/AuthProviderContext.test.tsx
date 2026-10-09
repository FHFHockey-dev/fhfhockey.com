import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
  profileEq: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: {
      getSession: authState.getSession,
      onAuthStateChange: authState.onAuthStateChange,
      signOut: authState.signOut,
    },
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          if (table === "user_profiles") authState.profileEq(column, value);
          return { maybeSingle: table === "user_profiles" ? authState.profileMaybeSingle : authState.maybeSingle };
        },
      }),
    }),
  },
}));

vi.mock("lib/user-settings/ensureUserRecords", () => ({
  ensureUserRecords: vi.fn().mockResolvedValue(undefined),
}));

import AuthProvider, { useAuth } from "contexts/AuthProviderContext";
import UserMenu from "components/auth/UserMenu";

function AuthProbe() {
  const { user, isLoading, signOut, refreshProfileAvatar } = useAuth();

  return (
    <div>
      <div>{isLoading ? "loading" : user?.email || "signed-out"}</div>
      <div data-testid="avatar-url">{user?.avatarUrl || "none"}</div>
      <UserMenu />
      <button type="button" onClick={() => user && void refreshProfileAvatar(user.id)}>Refresh avatar</button>
      <button type="button" onClick={() => void signOut()}>
        Sign Out
      </button>
    </div>
  );
}

describe("AuthProviderContext", () => {
  beforeEach(() => {
    authState.getSession.mockReset();
    authState.onAuthStateChange.mockReset();
    authState.signOut.mockReset();
    authState.maybeSingle.mockReset();
    authState.profileMaybeSingle.mockReset();
    authState.profileEq.mockReset();
    authState.unsubscribe.mockReset();

    authState.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "tim@example.com",
            email_confirmed_at: "2026-07-14T00:00:00.000Z",
            user_metadata: { full_name: "Tim Tester", avatar_url: "https://fixture.test/metadata.png" },
            app_metadata: { providers: ["google"] },
          },
        },
      },
    });
    authState.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authState.unsubscribe } },
    });
    authState.maybeSingle.mockResolvedValue({ data: null, error: null });
    authState.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  function renderProvider() {
    return render(<AuthProvider><AuthProbe /></AuthProvider>);
  }

  function deferredProfile() {
    let resolve!: (value: { data: { avatar_url: string } | null; error: null }) => void;
    const promise = new Promise<{ data: { avatar_url: string } | null; error: null }>(res => { resolve = res; });
    return { promise, resolve };
  }

  it("prefers a trimmed saved avatar and preserves the broken-image initials fallback", async () => {
    authState.profileMaybeSingle.mockResolvedValue({ data: { avatar_url: "  https://fixture.test/profile.png  " }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/profile.png"));
    expect(authState.profileEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://fixture.test/profile.png");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("TT")).toBeTruthy();
  });

  it.each([null, { avatar_url: null }, { avatar_url: "   " }])("uses metadata when the profile avatar is absent: %j", async (data) => {
    authState.profileMaybeSingle.mockResolvedValue({ data, error: null });
    renderProvider();
    await screen.findByText("tim@example.com");
    await waitFor(() => expect(authState.profileMaybeSingle).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/metadata.png");
  });

  it.each(["response", "rejection"])("retains the displayed avatar after a profile read %s error", async (failure) => {
    authState.profileMaybeSingle.mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/saved.png" }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png"));
    if (failure === "response") authState.profileMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
    else authState.profileMaybeSingle.mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" })));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png");
  });

  it("uses picture metadata when there is no saved avatar or avatar_url", async () => {
    const session = (await authState.getSession()).data.session;
    session.user.user_metadata = { full_name: "Tim Tester", picture: "https://fixture.test/picture.png" };
    authState.getSession.mockResolvedValue({ data: { session } });
    renderProvider();
    await screen.findByText("tim@example.com");
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/picture.png");
  });

  it("keeps the saved avatar during a same-user session event whose profile read fails", async () => {
    authState.profileMaybeSingle.mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/saved.png" }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png"));
    authState.profileMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
    const session = (await authState.getSession()).data.session;
    await act(async () => authState.onAuthStateChange.mock.calls[0][0]("TOKEN_REFRESHED", session));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png");
  });

  it("ignores an older refresh that finishes after the latest refresh", async () => {
    renderProvider();
    await screen.findByText("tim@example.com");
    const older = deferredProfile();
    authState.profileMaybeSingle.mockReturnValueOnce(older.promise).mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/latest.png" }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" }));
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/latest.png"));
    await act(async () => older.resolve({ data: { avatar_url: "https://fixture.test/older.png" }, error: null }));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/latest.png");
  });

  it("ignores a previous account's profile response after switching accounts", async () => {
    const old = deferredProfile();
    authState.profileMaybeSingle.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/morgan.png" }, error: null });
    renderProvider();
    await screen.findByText("tim@example.com");
    const sync = authState.onAuthStateChange.mock.calls[0][0];
    await act(async () => sync("SIGNED_IN", { user: { id: "user-2", email: "morgan@example.test", user_metadata: { full_name: "Morgan Example" }, app_metadata: {} } }));
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/morgan.png"));
    await act(async () => old.resolve({ data: { avatar_url: "https://fixture.test/tim.png" }, error: null }));
    expect(screen.getByRole("img", { name: "Morgan Example" }).getAttribute("src")).toBe("https://fixture.test/morgan.png");
    expect(screen.queryByText("tim@example.com")).toBeNull();
  });

  it("ignores a pending avatar response after local sign-out", async () => {
    const old = deferredProfile();
    authState.profileMaybeSingle.mockReturnValueOnce(old.promise);
    authState.signOut.mockResolvedValue({ error: null });
    renderProvider();
    await screen.findByText("tim@example.com");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign Out" })));
    await act(async () => old.resolve({ data: { avatar_url: "https://fixture.test/tim.png" }, error: null }));
    expect(screen.getByTestId("avatar-url").textContent).toBe("none");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("signed-out")).toBeTruthy();
  });

  it("does not let a refresh scoped to a previous user read the new user's profile", async () => {
    const session = (await authState.getSession()).data.session;
    let refresh!: (userId: string) => Promise<void>;
    function CaptureRefresh() { refresh = useAuth().refreshProfileAvatar; return null; }
    render(<AuthProvider><AuthProbe /><CaptureRefresh /></AuthProvider>);
    await screen.findByText("tim@example.com");
    const sync = authState.onAuthStateChange.mock.calls[0][0];
    await act(async () => sync("SIGNED_IN", { user: { ...session.user, id: "user-2", email: "morgan@example.test" } }));
    const calls = authState.profileMaybeSingle.mock.calls.length;
    await act(async () => refresh("user-1"));
    expect(authState.profileMaybeSingle).toHaveBeenCalledTimes(calls);
  });

  it("fails closed to signed out and clears only targeted auth state when local sign-out rejects", async () => {
    authState.signOut.mockRejectedValue(
      new Error("Invalid or expired session"),
    );
    window.localStorage.setItem("sb-fhfh-auth-token", "stale");
    window.sessionStorage.setItem("sb-fhfh-code-verifier", "stale");
    window.localStorage.setItem("unrelated-app-session", "preserve-me");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("tim@example.com")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeTruthy();
    });
    expect(authState.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(window.localStorage.getItem("sb-fhfh-auth-token")).toBeNull();
    expect(window.sessionStorage.getItem("sb-fhfh-code-verifier")).toBeNull();
    expect(window.localStorage.getItem("unrelated-app-session")).toBe(
      "preserve-me",
    );
  });
  it("reviewer: ignores initial session resolving after account switch", async () => {
    const oldSession = (await authState.getSession()).data.session;
    let resolve!: (value: any) => void;
    authState.getSession.mockReturnValue(new Promise(res => { resolve = res; }));
    authState.profileMaybeSingle.mockResolvedValue({ data: { avatar_url: "https://fixture.test/saved.png" }, error: null });
    renderProvider();
    await act(async () => authState.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", { user: { ...oldSession.user, id: "user-2", email: "morgan@example.test" } }));
    expect(screen.getByText("morgan@example.test")).toBeTruthy();
    await act(async () => resolve({ data: { session: oldSession } }));
    expect(screen.queryByText("tim@example.com")).toBeNull();
    expect(screen.getByText("morgan@example.test")).toBeTruthy();
  });

  it("reviewer: ignores initial session resolving after sign-out event", async () => {
    const oldSession = (await authState.getSession()).data.session;
    let resolve!: (value: any) => void;
    authState.getSession.mockReturnValue(new Promise(res => { resolve = res; }));
    renderProvider();
    await act(async () => authState.onAuthStateChange.mock.calls[0][0]("SIGNED_OUT", null));
    expect(screen.getByText("signed-out")).toBeTruthy();
    await act(async () => resolve({ data: { session: oldSession } }));
    expect(screen.getByText("signed-out")).toBeTruthy();
    expect(screen.getByTestId("avatar-url").textContent).toBe("none");
  });

  it("reviewer: ignores initial session rejection after account switch", async () => {
    const oldSession = (await authState.getSession()).data.session;
    let reject!: (error: Error) => void;
    authState.getSession.mockReturnValue(new Promise((_res, rej) => { reject = rej; }));
    renderProvider();
    await act(async () => authState.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", { user: { ...oldSession.user, id: "user-2", email: "morgan@example.test" } }));
    expect(screen.getByText("morgan@example.test")).toBeTruthy();
    await act(async () => reject(new Error("stale session lookup failure")));
    expect(screen.getByText("morgan@example.test")).toBeTruthy();
  });

  it("ignores initial session resolution after explicit local sign-out without an auth event", async () => {
    const oldSession = (await authState.getSession()).data.session;
    let resolve!: (value: any) => void;
    authState.getSession.mockReturnValue(new Promise(res => { resolve = res; }));
    authState.signOut.mockResolvedValue({ error: null });
    renderProvider();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign Out" })));
    await act(async () => resolve({ data: { session: oldSession } }));
    expect(screen.getByText("signed-out")).toBeTruthy();
    expect(screen.getByTestId("avatar-url").textContent).toBe("none");
  });

  it.each([null, { avatar_url: null }, { avatar_url: " " }])("reviewer: removes a previously saved avatar after a null/deleted read: %j", async (data) => {
    authState.profileMaybeSingle.mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/saved.png" }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png"));
    authState.profileMaybeSingle.mockResolvedValueOnce({ data, error: null });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" })));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/metadata.png");
  });

  it("reviewer: an old same-user session response cannot replace a new session avatar", async () => {
    renderProvider();
    await screen.findByText("tim@example.com");
    const old = deferredProfile();
    authState.profileMaybeSingle.mockReturnValueOnce(old.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" }));
    const session = (await authState.getSession()).data.session;
    await act(async () => authState.onAuthStateChange.mock.calls[0][0]("SIGNED_OUT", null));
    authState.profileMaybeSingle.mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/new-session.png" }, error: null });
    await act(async () => authState.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", session));
    await act(async () => old.resolve({ data: { avatar_url: "https://fixture.test/old-session.png" }, error: null }));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/new-session.png");
  });

  it("reviewer: latest failed refresh retains saved avatar and rejects older success", async () => {
    authState.profileMaybeSingle.mockResolvedValueOnce({ data: { avatar_url: "https://fixture.test/saved.png" }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png"));
    const old = deferredProfile();
    authState.profileMaybeSingle.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Refresh avatar" })));
    await act(async () => old.resolve({ data: { avatar_url: "https://fixture.test/older.png" }, error: null }));
    expect(screen.getByTestId("avatar-url").textContent).toBe("https://fixture.test/saved.png");
  });

});
