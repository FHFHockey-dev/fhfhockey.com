export function selectLatestSeasonRows<T extends Record<string, unknown>>(
  rows: T[],
  idKey: keyof T,
  seasonKey: keyof T,
  beforeSeason?: string | number,
) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (
      beforeSeason != null &&
      String(row[seasonKey]).localeCompare(String(beforeSeason), undefined, {
        numeric: true,
      }) >= 0
    )
      continue;
    const id = String(row[idKey] ?? "");
    if (!id) continue;
    const current = latest.get(id);
    if (
      !current ||
      String(row[seasonKey] ?? "").localeCompare(
        String(current[seasonKey] ?? ""),
        undefined,
        { numeric: true },
      ) > 0
    ) {
      latest.set(id, row);
    }
  }
  return latest;
}
