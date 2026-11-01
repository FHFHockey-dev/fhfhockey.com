import { describe, expect, it } from "vitest";
import { readSkaterAppearances } from "./skaterAppearances.sources";

const empty = { data: [], error: null, count: 0 };
const failure = (code: string) => ({ data: null, error: { code, message: code }, count: null });

function clientAnswering(...answers: object[]) {
  let reads = 0;
  const query: Record<string, unknown> = {};
  for (const step of ["select", "eq", "gte", "lte", "in", "order"]) query[step] = () => query;
  query.range = async () => answers[reads++] ?? empty;
  return { client: { from: () => query } as never, reads: () => reads };
}
const scope = { season: 20262027, from: "2026-10-01", through: "2026-10-31", limit: 100 };

describe("readSkaterAppearances", () => {
  it("reads a page once more after a statement timeout", async () => {
    const { client, reads } = clientAnswering(failure("57014"), empty);
    await expect(readSkaterAppearances(client, scope)).resolves.toBeDefined();
    expect(reads()).toBe(2);
  });

  it("fails closed when the second read also times out", async () => {
    const { client, reads } = clientAnswering(failure("57014"), failure("57014"));
    await expect(readSkaterAppearances(client, scope)).rejects.toBeDefined();
    expect(reads()).toBe(2);
  });

  it("does not retry any other error", async () => {
    const { client, reads } = clientAnswering(failure("42501"));
    await expect(readSkaterAppearances(client, scope)).rejects.toBeDefined();
    expect(reads()).toBe(1);
  });
});
