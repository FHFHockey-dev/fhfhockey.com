export function localDate(value: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function zonedMidnight(date: string, zone: string): string {
  let candidate = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const target = Date.parse(`${date}T00:00:00Z`);
  for (let pass = 0; pass < 3; pass++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const part = (kind: string) => Number(parts.find(item => item.type === kind)?.value ?? 0);
    const shown = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
    candidate += target - shown;
  }
  return new Date(candidate).toISOString();
}

export function nextLocalMidnight(date: string, zone: string): string {
  const nextDate = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return zonedMidnight(nextDate, zone);
}
