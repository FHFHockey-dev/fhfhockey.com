import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import SocialShareAccessGate from "components/SocialShare/SocialShareAccessGate";
import PlayerCardShareStudio from "components/player-cards/PlayerCardShareStudio";
import { SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";
import { cardEvidenceVerdict, unclaimedBundle, type EvidenceVerdict } from "lib/player-cards/cardEvidenceVerdict";
import { buildInteractionFixture } from "lib/player-cards/interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "lib/player-cards/interactionSnapshot";

// `evidence` is computed server-side and not rendered yet; showing it is a separate, reviewed UI change.
export default function PlayerCardsSharePage(_props: { evidence: EvidenceVerdict }) {
  return <Container contentVariant="full"><NextSeo title="Player cards | FHFH Share studio" noindex nofollow /><SocialShareAccessGate><PlayerCardShareStudio /></SocialShareAccessGate></Container>;
}
export const getServerSideProps: GetServerSideProps<{ evidence: EvidenceVerdict }> = async ({ res }) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow"); res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
  return { props: { evidence: await cardEvidenceVerdict(input, unclaimedBundle(input, INITIAL_FLOW.playerId, "studio-preview")) } };
};
