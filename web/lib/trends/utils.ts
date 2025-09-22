export function seasonStringToId(season: string): number | null {
  const match = season.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const startYear = Number(match[1]);
  const endYear = Number(match[1].slice(0, 2) + match[2]);
  if (Number.isNaN(startYear) || Number.isNaN(endYear)) {
    return null;
  }
  return startYear * 10000 + endYear;
}

export function seasonIdToString(seasonId: number): string {
  const startYear = Math.floor(seasonId / 10000);
  const endYear = seasonId % 10000;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

export function buildBaselineDensity(
  mu0: number,
  sigma0: number,
  sampleCount = 61
) {
  const safeSigma = sigma0 > 0 ? sigma0 : 0.01;
  const span = safeSigma * 4;
  const minX = mu0 - span;
  const maxX = mu0 + span;
  const step = sampleCount > 1 ? (maxX - minX) / (sampleCount - 1) : 0;

  const normalPdf = (x: number) =>
    (1 / (safeSigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * Math.pow((x - mu0) / safeSigma, 2));

  return Array.from({ length: sampleCount }, (_, idx) => {
    const x = minX + idx * step;
    return { x, y: normalPdf(x) };
  });
}
