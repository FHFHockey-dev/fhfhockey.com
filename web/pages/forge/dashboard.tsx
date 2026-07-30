import type { GetServerSideProps, NextPage } from "next";

const COMPATIBLE_QUERY_KEYS = [
  "date",
  "resolvedDate",
  "team",
  "position",
  "slate",
  "mode",
] as const;

type CompatibleQueryKey = (typeof COMPATIBLE_QUERY_KEYS)[number];

function readQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export function buildCommandCenterRedirect(
  query: Partial<Record<CompatibleQueryKey, string | string[]>>,
): string {
  const params = new URLSearchParams();

  for (const key of COMPATIBLE_QUERY_KEYS) {
    const value = readQueryValue(query[key]);
    if (value) params.set(key, value);
  }

  const search = params.toString();
  return `/forge/command-center${search ? `?${search}` : ""}`;
}

const ForgeDashboardRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async ({ query }) => ({
  redirect: {
    destination: buildCommandCenterRedirect(query),
    permanent: false,
  },
});

export default ForgeDashboardRedirectPage;
