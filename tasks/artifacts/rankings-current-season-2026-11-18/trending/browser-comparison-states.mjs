import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export async function checkComparisonStates(page, rows, drawer, tab) {
  const cutoff = "2026-11-17";
  const expected = [
    "TOI Up: TOI/G up +93s from last 20 to last 5.",
    "Trending sample found, but no material opportunity-change signal.",
    "No live opportunity-change signal in the current trending sample.",
  ];
  const dateLabel = page.getByText("Dataset snapshot", { exact: true }).locator("..").locator("strong");
  await page.locator(drawer).click();
  const cards = page.locator('[aria-label="Comparison context"] article');
  // A positive signal and the explicit no-material state require the Trending
  // response to have settled. Absence alone could occur while it is loading.
  for (const [index, value] of expected.entries()) {
    await cards.nth(index).getByText(value, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
  }

  assert.equal(rows.matrix.meta.totalRankedRows, 750);
  assert.equal(rows.matrix.meta.rankingSource, "entity_metric_rankings");
  assert.equal(rows.matrix.meta.snapshotDate, cutoff);
  assert.equal(rows.comparison.source.snapshotDate, cutoff);
  const comparisonDateLabel = await dateLabel.innerText();
  assert.equal(comparisonDateLabel, "Nov 17, 2026");
  const rendered = await cards.evaluateAll(nodes => nodes.map(card => {
    const evidence = [...card.querySelectorAll("dt")].find(el => el.textContent === "Opportunity Evidence").nextElementSibling;
    return { player: card.querySelector("h3").innerText, evidence: evidence.innerText };
  }));
  assert.equal(rendered.length, 6);
  const subjects = rows.comparison.subjects.map(({ row }, index) => {
    const id = row.entity.id;
    assert.equal(id, 8470000 + index);
    assert.equal(rendered[index].player, row.entity.name);
    assert.equal(row.composite.snapshotDate, cutoff);
    const sampleIndex = rows.trending.rows.findIndex(item => item.entity.id === id);
    const signalTypes = sampleIndex < 0 ? null : rows.trending.rows[sampleIndex].opportunitySignals.map(item => item.type);
    return { id, ...rendered[index], sampleRank: sampleIndex < 0 ? null : sampleIndex + 1, signalTypes };
  });
  assert.deepEqual(subjects.slice(0, 3).map(row => row.evidence), expected);
  assert.ok(subjects[0].signalTypes.includes("toi_up"));
  assert.deepEqual(subjects[1].signalTypes, []);
  assert.equal(subjects[2].sampleRank, null);

  await tab(page, "Trending").click();
  const tablePlayers = page.locator('[aria-label="Trending players"] tbody tr td:first-child strong');
  await tablePlayers.nth(24).waitFor({ state: "visible" });
  const names = await tablePlayers.allInnerTexts();
  assert.deepEqual(names, rows.trending.rows.map(row => row.entity.name));
  assert.equal(names.length, 25);
  const trendingDateLabel = await dateLabel.innerText();
  assert.equal(trendingDateLabel, comparisonDateLabel);
  assert.equal(rows.trending.meta.latestAvailableSnapshotDate, cutoff);
  for (const window of ["season", "last5", "last10", "last20"]) assert.equal(rows.trending.meta.snapshotDates[window], cutoff);
  return {
    subjects,
    trendingIds: rows.trending.rows.map(row => row.entity.id),
    trendingRowsSha256: createHash("sha256").update(JSON.stringify(rows.trending.rows)).digest("hex"),
    freshness: { comparisonDateLabel, trendingDateLabel, matrix: rows.matrix.meta.snapshotDate,
      comparison: rows.comparison.source.snapshotDate, latestTrending: rows.trending.meta.latestAvailableSnapshotDate,
      windows: rows.trending.meta.snapshotDates },
  };
}
