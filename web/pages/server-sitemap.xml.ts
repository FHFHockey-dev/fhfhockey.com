import type { GetServerSideProps } from "next";
import { getServerSideSitemap } from "next-sitemap";
import { groq } from "next-sanity";
import { canonicalUrl } from "lib/seo";
import { getClient } from "lib/sanity/sanity.server";
import supabase from "lib/supabase/public-client";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

const publishedSlugsQuery = groq`*[_type == "post" && defined(slug.current) && !(_id in path("drafts.**")) && defined(publishedAt) && dateTime(publishedAt) <= dateTime(now())][].slug.current`;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const [players, slugs] = await Promise.all([
    fetchAllSupabasePages(({ from, to }) =>
      supabase.from("players").select("id").order("id").range(from, to),
    ),
    getClient().fetch(publishedSlugsQuery) as Promise<unknown>,
  ]);

  if (!Array.isArray(slugs)) {
    throw new Error("Published article lookup failed");
  }

  const fields = [
    ...players
      .filter(({ id }) => Number.isSafeInteger(id) && id > 0)
      .map(({ id }) => ({ loc: canonicalUrl(`/stats/player/${id}`) })),
    ...slugs
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
      .map((slug) => ({ loc: canonicalUrl(`/blog/${encodeURIComponent(slug)}`) })),
  ];

  context.res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return getServerSideSitemap(context, fields);
};

export default function ServerSitemap() {
  return null;
}
