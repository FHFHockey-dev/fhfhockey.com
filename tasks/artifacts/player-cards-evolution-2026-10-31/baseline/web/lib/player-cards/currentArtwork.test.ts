import { createElement } from "react";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { REVIEWED_HERO_SAMPLES } from "./reviewedHeroSamples";
import { reviewedHeroFor, currentArtworkManifest } from "./currentArtwork";
import { assertCurrentNhlExport } from "./currentNhlExport";
import CurrentPlayerCard from "../../components/player-cards/CurrentPlayerCard";
import type { PreparedHero } from "../../components/player-cards/HeroPlayerCard";
import type { CurrentNhlCard } from "./currentNhl";
import { PORTRAIT_VERSION } from "./portraitTreatment";
const sample = REVIEWED_HERO_SAMPLES[0];
const hero: PreparedHero = { ...sample, dataUrl: "data:image/png;base64,reviewed", treatment: { style: "original" as const, version: PORTRAIT_VERSION, sourceAlphaSha256: sample.alphaSha256, renderedSha256: sample.alphaSha256, width: sample.sourceWidth, height: sample.sourceHeight } };
const card = { id: "contract", source: "contract-fixture", state: "ready", player: { id: sample.id, name: sample.name, team: sample.team, position: sample.position }, request: { playerId: sample.id, season: 20262027, count: 5 }, observedAt: "2026-10-27T00:00:00Z", sample: { gp: 1, toiSeconds: 1200, sourceDates: [], utcDates: [], gameIds: [] }, values: { atoi: 1200, shots60: 12, goals60: 3, points60: 3, goals: 1, assists: 0, points: 1, shots: 4, shootingPct: 25 }, issues: [], rankReason: "League pool unverified", historyStatement: "Fixture", finalityStatement: "Fixture", evidence: { version: "nhl-basic-skater-v1", sourcePaths: [], seasonGp: 1, selectedGames: [], actualEndTimesSupplied: false } } as CurrentNhlCard;
it("requires the exact accepted ID and team, never an unreviewed roster candidate", () => {
  expect(reviewedHeroFor(card.player)).toBe(sample);
  expect(reviewedHeroFor({ ...card.player, team: "MIN" })).toBeUndefined();
  expect(reviewedHeroFor({ ...card.player, id: 8470001, team: "TBL" })).toBeUndefined();
  expect(() => currentArtworkManifest({ ...card, player: { ...card.player, id: 8470001, team: "TBL" } }, hero)).toThrow("match");
});
it("uses the existing player geometry, binds embedded pixels and rejects substituted or stale artwork", () => {
  const { container } = render(createElement(CurrentPlayerCard, { card, format: "rates-opportunity", hero }));
  const svg = container.querySelector("svg")!, image = svg.querySelector('[data-hero-image="true"]')!;
  expect(["x", "y", "width", "height"].map(key => image.getAttribute(key))).toEqual(["600", "4", "600", "337.5"]);
  expect(() => assertCurrentNhlExport(svg, card, "rates-opportunity", hero)).not.toThrow();
  expect(() => assertCurrentNhlExport(svg, card, "rates-opportunity")).toThrow();
  image.setAttribute("href", "https://not-permitted.invalid/photo.png");
  expect(() => assertCurrentNhlExport(svg, card, "rates-opportunity", hero)).toThrow("Embedded");
});
it("exports an explicit image-unavailable state without disabling valid stats or inventing an asset", () => {
  const { container } = render(createElement(CurrentPlayerCard, { card, format: "results-milestones" })), svg = container.querySelector("svg")!;
  expect(svg.querySelector("image")).toBeNull(); expect(svg.textContent).toContain("PLAYER IMAGE UNAVAILABLE");
  expect(svg.textContent).toContain("SYNTHETIC CONTRACT FIXTURE"); expect(svg.textContent).toContain("League pool unverified");
  expect(() => assertCurrentNhlExport(svg, card, "results-milestones")).not.toThrow();
  expect(currentArtworkManifest(card)).toMatchObject({ state: "unavailable", playerId: sample.id, team: sample.team });
  const metadata = JSON.stringify(currentArtworkManifest(card, hero)); expect(metadata).not.toContain("data:image"); expect(metadata).toContain(sample.alphaSha256);
});

it("binds qualified Kucherov to his exact TBL source and rejects another team", () => {
  const selected = reviewedHeroFor({ id: 8476453, name: "Nikita Kucherov", team: "TBL", position: "R" });
  expect(selected).toMatchObject({ id: 8476453, team: "TBL", sweater: 86, alphaSha256: "2010d97f1e1c631f7ccf154d991517f3b6923df7739d756e39ed06140aa1f278", localPath: "/player-cards/hero-samples/8476453.png" });
  expect(reviewedHeroFor({ id: 8476453, name: "Nikita Kucherov", team: "TOR", position: "R" })).toBeUndefined();
});
