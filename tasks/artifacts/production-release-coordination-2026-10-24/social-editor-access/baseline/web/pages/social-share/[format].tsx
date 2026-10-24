import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import SocialShare from "components/SocialShare/SocialShare";
import { isSocialShareFormat, type SocialShareFormat } from "lib/socialShare/types";

export default function SocialSharePage({ format, asOf }: { format: SocialShareFormat; asOf: string }) {
  return <Container contentVariant="full">
    <NextSeo title="Schedule share studio | FHFH" noindex nofollow />
    <SocialShare key={format} format={format} asOf={asOf} />
  </Container>;
}

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const format = params?.format;
  if (typeof format !== "string" || !isSocialShareFormat(format)) return { notFound: true };
  return { props: { format, asOf: new Date().toISOString() } };
};
