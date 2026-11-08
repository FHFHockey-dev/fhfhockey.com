import React from "react";
import type { GetServerSidePropsContext } from "next";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerCardsSharePage, { getServerSideProps } from "../../pages/social-share/player-cards";
import { cardEvidenceVerdict, unclaimedBundle } from "./cardEvidenceVerdict";
import { buildInteractionFixture } from "./interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "./interactionSnapshot";

vi.mock("components/SocialShare/SocialShareAccessGate", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("components/player-cards/PlayerCardShareStudio", () => ({ default: () => null }));
vi.mock("components/player-cards/CurrentPlayerCardStudio", () => ({ default: () => null }));
afterEach(() => cleanup());

describe("studio evidence status line", () => {
  // The fabricated-preview status line belongs to the illustrative artwork source, not the default NHL results source.
  it("renders fixed copy selected by state only, never codes", async () => {
    const result = await getServerSideProps({ res: { setHeader: vi.fn() } } as unknown as GetServerSidePropsContext);
    const { evidence } = (result as { props: { evidence: Parameters<typeof PlayerCardsSharePage>[0]["evidence"] } }).props;
    const { container } = render(<PlayerCardsSharePage evidence={evidence} />);
    expect(container.querySelector("[data-evidence-state]")).toBeNull();
    fireEvent.change(screen.getByLabelText("Card source"), { target: { value: "artwork" } });
    const html = container.innerHTML;
    expect(container.querySelector('[data-evidence-state]')).toBe(container.querySelector('[role="status"][data-evidence-state="incomplete"]'));
    expect(container.querySelector('[role="status"][data-evidence-state="incomplete"]')).not.toBeNull();
    expect(html).toContain("Evidence check: incomplete");
    expect(html).toContain("Fabricated preview, no admitted evidence. Ranks are illustrative.");
    const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
    const { issueCodes } = await cardEvidenceVerdict(input, unclaimedBundle(input, INITIAL_FLOW.playerId, "studio-preview"));
    expect(issueCodes.length).toBeGreaterThan(0);
    for (const code of issueCodes) expect(html).not.toContain(code);
  });
});
