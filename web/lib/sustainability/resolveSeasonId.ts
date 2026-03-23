import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

function normalizeSeasonParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export async function resolveSeasonId(
  seasonParam: string | string[] | undefined
): Promise<number> {
  const candidate = normalizeSeasonParam(seasonParam)?.trim();

  if (!candidate || candidate.toLowerCase() === "current") {
    const currentSeason = await fetchCurrentSeason();
    return Number(currentSeason.id);
  }

  const parsed = Number(candidate);
  if (!parsed || Number.isNaN(parsed)) {
    throw new Error("Missing or invalid ?season");
  }

  return parsed;
}
