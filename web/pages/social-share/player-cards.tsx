import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import SocialShareAccessGate from "components/SocialShare/SocialShareAccessGate";
import PlayerCardShareStudio from "components/player-cards/PlayerCardShareStudio";
import { SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";
import { cardEvidenceVerdict, unclaimedBundle, type EvidenceVerdict } from "lib/player-cards/cardEvidenceVerdict";
import { buildInteractionFixture } from "lib/player-cards/interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "lib/player-cards/interactionSnapshot";
import { evidenceStatusCopy } from "lib/player-cards/evidenceVerdictCopy";

// `evidence` is computed server-side; only its state selects fixed copy here (codes and reasons are never shown).
export default function PlayerCardsSharePage({ evidence }: { evidence: EvidenceVerdict }) {
  const status = evidenceStatusCopy(evidence);
  return <Container contentVariant="full"><NextSeo title="Player cards | FHFH Share studio" noindex nofollow /><SocialShareAccessGate><PlayerCardShareStudio /><p role="status" data-evidence-state={evidence.state}><strong>{status.title}</strong><br />{status.detail}</p></SocialShareAccessGate></Container>;
}
export const getServerSideProps: GetServerSideProps<{ evidence: EvidenceVerdict }> = async ({ res }) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow"); res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
  return { props: { evidence: await cardEvidenceVerdict(input, unclaimedBundle(input, INITIAL_FLOW.playerId, "studio-preview")) } };
};
