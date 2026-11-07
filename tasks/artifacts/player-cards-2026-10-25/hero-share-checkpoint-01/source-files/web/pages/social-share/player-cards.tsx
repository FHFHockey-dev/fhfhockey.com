import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import SocialShareAccessGate from "components/SocialShare/SocialShareAccessGate";
import PlayerCardShareStudio from "components/player-cards/PlayerCardShareStudio";
import { SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";

export default function PlayerCardsSharePage() {
  return <Container contentVariant="full"><NextSeo title="Player cards | FHFH Share studio" noindex nofollow /><SocialShareAccessGate><PlayerCardShareStudio /></SocialShareAccessGate></Container>;
}
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow"); res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  return { props: {} };
};
