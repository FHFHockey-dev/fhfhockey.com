import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NameSearchBar from "./NameSearchBar";

const { fromMock, selectMock, ilikeMock, limitMock } = vi.hoisted(() => {
  const limitMock = vi.fn();
  const ilikeMock = vi.fn(() => ({
    limit: limitMock
  }));
  const selectMock = vi.fn(() => ({
    ilike: ilikeMock
  }));
  const fromMock = vi.fn(() => ({
    select: selectMock
  }));

  return {
    fromMock,
    selectMock,
    ilikeMock,
    limitMock
  };
});

vi.mock("lib/supabase", () => ({
  default: {
    from: fromMock
  }
}));

vi.mock("lib/cors-fetch", () => ({
  default: vi.fn()
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("NameSearchBar", () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockClear();
    ilikeMock.mockClear();
    limitMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("loads debounced results and selects a player with keyboard navigation", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: 1,
          fullName: "Jack Hughes",
          firstName: "Jack",
          lastName: "Hughes",
          position: "C",
          birthDate: "2001-05-14",
          birthCity: null,
          birthCountry: null,
          heightInCentimeters: 178,
          weightInKilograms: 80,
          image_url: "https://example.com/jack.png"
        }
      ],
      error: null
    });

    const onSelect = vi.fn();
    renderWithClient(<NameSearchBar onSelect={onSelect} />);

    const input = screen.getByPlaceholderText("Search player");
    fireEvent.change(input, { target: { value: "Jack" } });

    await new Promise((resolve) => setTimeout(resolve, 350));

    await waitFor(() => {
      expect(screen.getByText("Jack Hughes")).toBeTruthy();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, fullName: "Jack Hughes" }),
        "https://example.com/jack.png"
      );
    });

    expect(screen.queryByText("Jack Hughes")).toBeNull();
  });
});
