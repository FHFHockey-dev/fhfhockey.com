import React, { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apollo = vi.hoisted(() => ({ refetch: vi.fn(), useQuery: vi.fn() }));

vi.mock("@apollo/client", () => ({
  ApolloProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="apollo-provider">{children}</div>,
  gql: (strings: TemplateStringsArray) => strings.join(""),
  NetworkStatus: {},
  useQuery: apollo.useQuery,
}));
vi.mock("lib/apollo-client", () => ({ default: {} }));
vi.mock("components/Spinner", () => ({ default: () => <span>Loading comments</span> }));

import Comments from "components/Comments";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  apollo.refetch.mockReset();
  apollo.useQuery.mockReset();
});

function renderComments() {
  apollo.useQuery.mockReturnValue({
    data: { comments: [{ id: "c1", userName: "Ann", content: "Nice read", createdAt: "2026-10-01T00:00:00.000Z" }] },
    loading: false,
    refetch: apollo.refetch,
  });
  const ref = createRef<{ refetch: () => void }>();
  render(<Comments ref={ref} slug="a-post" />);
  return ref;
}

describe("Comments", () => {
  // Comments owns the Apollo provider so the shared app chunk does not ship Apollo.
  it("queries inside its own provider and keeps the refetch handle", () => {
    vi.stubEnv("NEXT_PUBLIC_SANITY_GRAPHQL_URI", "https://graphql.example.invalid/v1/graphql/production/default");
    const ref = renderComments();

    expect(screen.getByTestId("apollo-provider").textContent).toContain("Nice read");
    expect(apollo.useQuery).toHaveBeenCalledWith(expect.anything(), {
      variables: { slug: "a-post" },
      notifyOnNetworkStatusChange: true,
    });
    ref.current?.refetch();
    expect(apollo.refetch).toHaveBeenCalledTimes(1);
  });

  it("does not add a provider when GraphQL is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SANITY_GRAPHQL_URI", "");
    renderComments();

    expect(screen.queryByTestId("apollo-provider")).toBeNull();
    expect(screen.getByText("Nice read")).toBeTruthy();
  });
});
