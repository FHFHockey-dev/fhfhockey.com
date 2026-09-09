import { load } from "cheerio";
import { ArticleHeading, createHeadingId, headingTone } from "./headings";

// Input is the existing sanitized provider body; never fetch or insert raw HTML here.
export function prepareArticleHtml(content: string) {
  const $ = load(content, null, false);
  const headings: ArticleHeading[] = [];
  const nextId = createHeadingId($("[id]").toArray().map((node) => $(node).attr("id") || ""));
  const seen = new Set<string>();
  $("h1, h2, h3, h4").each((_, node) => {
    const heading = $(node);
    const text = heading.text().trim();
    const existingId = heading.attr("id");
    const id = existingId && !seen.has(existingId) ? existingId : nextId(text);
    seen.add(id);
    heading.attr("id", id).attr("data-tone", headingTone(text)).attr("tabindex", "-1");
    if (node.tagName === "h1") node.tagName = "h2";
    if (text) headings.push({ id, text, level: Number(node.tagName.slice(1)) });
  });
  $("table").each((_, node) => {
    const wrapper = $("<div></div>").attr({ "data-article-table": "", role: "region", "aria-label": $(node).find("caption").text() || "Article data table", tabindex: "0" });
    $(node).wrap(wrapper);
  });
  return { content: $.html(), headings };
}
