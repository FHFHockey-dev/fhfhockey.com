export function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "-";
  return (value * 100).toFixed(1) + "%";
}

export function formatTOI(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return "-";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatSeason(season: string | number): string {
  const s = String(season);
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(6)}`;
  }
  return s;
}

export function formatDate(date: string): string {
  if (!date) return "-";
  // Expecting YYYY-MM-DD
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  const [year, month, day] = parts;
  // Remove leading zeros for month and day
  const m = String(Number(month));
  const d = String(Number(day));
  const yy = year.slice(2);
  return `${m}-${d}-${yy}`;
}
