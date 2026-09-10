import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";

const publicationUrl = "https://fhfhockey.substack.com";

export type SubstackPost = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  author: string;
  imageUrl: string;
  sourceUrl: string;
  content: string;
};

export function parseSubstackFeed(xml: string): SubstackPost[] {
  const $ = load(xml, { xmlMode: true });
  if (!$("rss > channel").length) throw new Error("Invalid Substack RSS feed");

  return $("channel > item").toArray().flatMap((item) => {
    const field = (name: string) => $(item).children().filter((_, node) => node.tagName === name).text().trim();
    const sourceUrl = field("link");
    const url = new URL(sourceUrl, publicationUrl);
    const slug = url.pathname.match(/^\/p\/([a-zA-Z0-9-]+)$/)?.[1];
    const publishedAt = new Date(field("pubDate"));
    if (url.origin !== publicationUrl || !slug || !field("title") || !Number.isFinite(publishedAt.getTime())) return [];

    const content = sanitizeHtml(field("content:encoded") || field("description"), {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
      allowedAttributes: {
        a: ["href", "title", "id", "name"],
        h1: ["id"],
        h2: ["id"],
        h3: ["id"],
        h4: ["id"],
        h5: ["id"],
        h6: ["id"],
        img: ["src", "alt", "title", "width", "height"],
        th: ["colspan", "rowspan", "scope", "id"],
        td: ["colspan", "rowspan", "headers"]
      },
      allowedSchemes: ["https", "http", "mailto"],
      allowedSchemesByTag: { img: ["https"] },
      allowProtocolRelative: false
    });
    const enclosure = $(item).children("enclosure").attr("url") || "";
    const imageUrl = /^https:\/\//.test(enclosure) ? enclosure : "/android-chrome-512x512.png";
    return [{
      slug,
      title: field("title"),
      summary: load(field("description")).text(),
      publishedAt: publishedAt.toISOString(),
      author: field("dc:creator") || "FHFH",
      imageUrl,
      sourceUrl: url.href,
      content
    }];
  });
}

export async function getSubstackPosts(): Promise<SubstackPost[]> {
  const response = await fetch(`${publicationUrl}/feed`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Substack feed returned ${response.status}`);
  return parseSubstackFeed(await response.text());
}
