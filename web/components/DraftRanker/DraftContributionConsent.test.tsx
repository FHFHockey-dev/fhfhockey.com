import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { hookMock, mutateMock, refetchMock } = vi.hoisted(() => ({
  hookMock: vi.fn(),
  mutateMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("hooks/useDraftContributionPreference", () => ({
  useDraftContributionPreference: hookMock,
}));

import { DraftContributionConsent } from "./DraftContributionConsent";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function configure(enabled = false) {
  hookMock.mockReturnValue({
    state: {
      data: { contributionEnabled: enabled },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    },
    mutation: {
      mutate: mutateMock,
      isPending: false,
      isSuccess: false,
      error: null,
    },
  });
}

describe("DraftContributionConsent", () => {
  it("discloses exactly which private evidence may contribute", () => {
    configure();
    render(<DraftContributionConsent />);
    expect(hookMock).toHaveBeenCalledWith("user-1", true);
    expect(
      screen.getByText(/ranking and comparison history stay private/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Direct list edits, skips, and “too close”/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/never publishes your raw comparison history/i),
    ).toBeTruthy();
  });

  it("starts opted out and saves only an explicit checkbox choice", () => {
    configure();
    render(<DraftContributionConsent />);
    const checkbox = screen.getByRole("checkbox", {
      name: /Contribute my explicit comparisons anonymously/i,
    });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    fireEvent.click(checkbox);
    expect(mutateMock).toHaveBeenCalledWith(true);
  });

  it("renders the persisted opt-in state", () => {
    configure(true);
    render(<DraftContributionConsent />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
