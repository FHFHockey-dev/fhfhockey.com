export type MockFlags = {
  enabled: boolean;
  collection: boolean;
  board: boolean;
};
export function mockFlags(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MockFlags {
  return {
    enabled: env.MOCK_DRAFT_ENABLED === "true",
    collection: env.MOCK_DRAFT_COLLECTION_ENABLED === "true",
    board: env.MOCK_DRAFT_ADP_ENABLED === "true",
  };
}
