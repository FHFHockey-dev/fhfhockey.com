import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useUrlQueryState } from "./useUrlQueryState";

afterEach(() => {
  window.history.replaceState(window.history.state, "", "/");
});

describe("useUrlQueryState", () => {
  it("hydrates a direct URL value after the client mounts", async () => {
    window.history.replaceState(
      window.history.state,
      "",
      "/drm?team=EDM&source=raw",
    );

    const { result } = renderHook(() => useUrlQueryState("team"));

    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toBe("EDM");
  });

  it("updates one key without dropping adjacent scope keys", async () => {
    window.history.replaceState(
      window.history.state,
      "",
      "/drm?team=EDM&source=raw",
    );
    const { result } = renderHook(() => useUrlQueryState("team"));
    await waitFor(() => expect(result.current[2]).toBe(true));

    await act(async () => {
      await result.current[1]("TOR");
    });

    expect(result.current[0]).toBe("TOR");
    expect(window.location.search).toBe("?team=TOR&source=raw");
  });

  it("restores browser-history changes through popstate", async () => {
    window.history.replaceState(window.history.state, "", "/drm?team=EDM");
    const { result } = renderHook(() => useUrlQueryState("team"));
    await waitFor(() => expect(result.current[0]).toBe("EDM"));

    act(() => {
      window.history.replaceState(window.history.state, "", "/drm?team=TOR");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(result.current[0]).toBe("TOR"));
  });
});
