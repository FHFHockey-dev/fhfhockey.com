import { describe, expect, it } from "vitest";

import { normalizeDependencyError } from "./normalizeDependencyError";

describe("normalizeDependencyError", () => {
  it("normalizes html upstream responses into a structured dependency error", () => {
    const result = normalizeDependencyError(
      "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>"
    );

    expect(result).toMatchObject({
      kind: "dependency_error",
      source: "supabase_or_proxy",
      classification: "html_upstream_response",
      htmlLike: true
    });
  });

  it("normalizes fetch failed into a transport classification", () => {
    const result = normalizeDependencyError(new Error("TypeError: fetch failed"));

    expect(result).toMatchObject({
      kind: "dependency_error",
      classification: "transport_fetch_failure",
      htmlLike: false
    });
  });

  it("extracts html-like messages from object-shaped upstream errors", () => {
    const result = normalizeDependencyError({
      message:
        "<!DOCTYPE html><html><title>fyhftlxokyjtpndbkfse.supabase.co | 522: Connection timed out</title></html>"
    });

    expect(result).toMatchObject({
      kind: "dependency_error",
      source: "supabase_or_proxy",
      classification: "html_upstream_response",
      htmlLike: true
    });
  });
});
