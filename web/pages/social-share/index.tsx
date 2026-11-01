import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import ShareLanding from "components/SocialShare/ShareLanding";
import SocialShareAccessGate from "components/SocialShare/SocialShareAccessGate";
import { SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";

export default function SocialShareLandingPage() {
  return <Container contentVariant="full">
    <NextSeo title="Build a card | FHFH Share studio" noindex nofollow />
    <SocialShareAccessGate><ShareLanding /></SocialShareAccessGate>
  </Container>;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  return { props: {} };
};
