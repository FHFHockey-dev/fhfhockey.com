type AuditResult = {
  ok: boolean;
  issues: string[];
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const validateProbability = (
  value: unknown,
  label: string,
  issues: string[]
): void => {
  const n = toNumber(value);
  if (n == null) return;
  if (n < 0 || n > 1) {
    issues.push(`${label} out of probability bounds [0,1]: ${n}`);
  }
};

export const auditTeamRatings = (rows: unknown[]): AuditResult => {
  const issues: string[] = [];
  rows.forEach((row, idx) => {
    const r = row as Record<string, unknown>;
    if (!hasNonEmptyString(r.teamAbbr ?? r.team_abbreviation)) {
      issues.push(`team_ratings[${idx}] missing team abbreviation`);
    }
    if (!hasNonEmptyString(r.date)) {
      issues.push(`team_ratings[${idx}] missing date`);
    }
    ["offRating", "defRating", "paceRating"].forEach((key) => {
      const alt = `${key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`;
      if (toNumber(r[key] ?? r[alt]) == null) {
        issues.push(`team_ratings[${idx}] missing numeric ${key}`);
      }
    });
    const ppTier = toNumber(r.ppTier ?? r.pp_tier);
    const pkTier = toNumber(r.pkTier ?? r.pk_tier);
    if (ppTier != null && ![1, 2, 3].includes(ppTier)) {
      issues.push(`team_ratings[${idx}] invalid ppTier=${ppTier}`);
    }
    if (pkTier != null && ![1, 2, 3].includes(pkTier)) {
      issues.push(`team_ratings[${idx}] invalid pkTier=${pkTier}`);
    }
  });
  return { ok: issues.length === 0, issues };
};

export const auditSustainabilityRows = (rows: unknown[]): AuditResult => {
  const issues: string[] = [];
  rows.forEach((row, idx) => {
    const r = row as Record<string, unknown>;
    if (toNumber(r.player_id) == null) {
      issues.push(`sustainability[${idx}] missing player_id`);
    }
    const s100 = toNumber(r.s_100);
    if (s100 == null) {
      issues.push(`sustainability[${idx}] missing s_100`);
    } else if (s100 < 0 || s100 > 100) {
      issues.push(`sustainability[${idx}] s_100 out of range [0,100]: ${s100}`);
    }
    if (toNumber(r.luck_pressure) == null) {
      issues.push(`sustainability[${idx}] missing luck_pressure`);
    }
  });
  return { ok: issues.length === 0, issues };
};

export const auditCtpiRows = (rows: unknown[]): AuditResult => {
  const issues: string[] = [];
  rows.forEach((row, idx) => {
    const r = row as Record<string, unknown>;
    if (!hasNonEmptyString(r.team)) {
      issues.push(`ctpi[${idx}] missing team`);
    }
    const score = toNumber(r.ctpi_0_to_100);
    if (score == null) {
      issues.push(`ctpi[${idx}] missing ctpi_0_to_100`);
    } else if (score < 0 || score > 100) {
      issues.push(`ctpi[${idx}] ctpi_0_to_100 out of range [0,100]: ${score}`);
    }
  });
  return { ok: issues.length === 0, issues };
};

export const auditGoalieRows = (rows: unknown[]): AuditResult => {
  const issues: string[] = [];
  rows.forEach((row, idx) => {
    const r = row as Record<string, unknown>;
    if (toNumber(r.goalie_id) == null) {
      issues.push(`goalies[${idx}] missing goalie_id`);
    }
    if (!hasNonEmptyString(r.goalie_name)) {
      issues.push(`goalies[${idx}] missing goalie_name`);
    }
    validateProbability(r.starter_probability, `goalies[${idx}].starter_probability`, issues);
    validateProbability(r.proj_win_prob, `goalies[${idx}].proj_win_prob`, issues);
    validateProbability(r.proj_shutout_prob, `goalies[${idx}].proj_shutout_prob`, issues);
    validateProbability(r.blowup_risk, `goalies[${idx}].blowup_risk`, issues);
  });
  return { ok: issues.length === 0, issues };
};

export const auditStartChartGames = (rows: unknown[]): AuditResult => {
  const issues: string[] = [];
  rows.forEach((row, idx) => {
    const r = row as Record<string, unknown>;
    if (toNumber(r.id) == null) {
      issues.push(`start_chart_games[${idx}] missing id`);
    }
    if (toNumber(r.homeTeamId) == null || toNumber(r.awayTeamId) == null) {
      issues.push(`start_chart_games[${idx}] missing team ids`);
    }
    const validateGoalieBucket = (key: "homeGoalies" | "awayGoalies") => {
      const list = Array.isArray(r[key]) ? (r[key] as Array<Record<string, unknown>>) : [];
      list.forEach((goalie, gIdx) => {
        if (toNumber(goalie.player_id) == null) {
          issues.push(`start_chart_games[${idx}].${key}[${gIdx}] missing player_id`);
        }
        if (!hasNonEmptyString(goalie.name)) {
          issues.push(`start_chart_games[${idx}].${key}[${gIdx}] missing name`);
        }
        validateProbability(
          goalie.start_probability,
          `start_chart_games[${idx}].${key}[${gIdx}].start_probability`,
          issues
        );
      });
    };
    validateGoalieBucket("homeGoalies");
    validateGoalieBucket("awayGoalies");
  });
  return { ok: issues.length === 0, issues };
};

