// The inventory's SQL uses UTC CURRENT_DATE to build rolling date windows.
// Resolve only that documented grammar, never evaluate arbitrary SQL or treat
// an unfinished URL prefix as permission to match any query on the same path.
export function resolveScheduledHttpUrl(sql: string, scheduledAt: string): string | null {
  const date = new Date(scheduledAt);
  if (!Number.isFinite(date.getTime())) return null;
  const argument = /\burl\s*:?=\s*/i.exec(sql);
  if (!argument) return null;
  let remaining = sql.slice(argument.index + argument[0].length).trimStart();
  let url = "";
  while (remaining) {
    const literal = /^'((?:[^']|'')*)'/.exec(remaining);
    const currentDate = /^to_char\(\s*CURRENT_DATE\s*::\s*date\s*,\s*'YYYY-MM-DD'\s*\)/i.exec(remaining);
    const offsetDate = /^to_char\(\s*\(\s*CURRENT_DATE\s*([+-])\s*INTERVAL\s*'(\d+) days?'\s*\)\s*::\s*date\s*,\s*'YYYY-MM-DD'\s*\)/i.exec(remaining);
    const token = literal ?? currentDate ?? offsetDate;
    if (!token) return null;
    if (literal) {
      url += literal[1].replace(/''/g, "'");
    } else {
      const offset = offsetDate ? Number(offsetDate[2]) * (offsetDate[1] === "-" ? -1 : 1) : 0;
      const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset));
      if (!Number.isFinite(day.getTime())) return null;
      url += day.toISOString().slice(0, 10);
    }
    remaining = remaining.slice(token[0].length).trimStart();
    if (remaining.startsWith("||")) {
      remaining = remaining.slice(2).trimStart();
      continue;
    }
    // Schedule extraction can omit the enclosing call's closing parenthesis.
    // Otherwise the named argument must end at an argument or function close.
    return remaining === "" || /^[,)]/.test(remaining) ? url : null;
  }
  return null;
}
