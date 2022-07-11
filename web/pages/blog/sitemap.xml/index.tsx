import { GetServerSideProps } from "next";
import { getServerSideSitemap } from "next-sitemap";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // TODO: fetch all blog posts' id
  const postIds = ["1", "2", "3", "4"];
  const paths = postIds.map((id) => ({ id }));

  const newsSitemaps = paths.map((item) => ({
    loc: `${process.env.SITE_URL}/blog/${item.id.toString()}`,
  }));

  const fields = [...newsSitemaps];

  return getServerSideSitemap(ctx, fields);
};

export default function Sitemap() {}
