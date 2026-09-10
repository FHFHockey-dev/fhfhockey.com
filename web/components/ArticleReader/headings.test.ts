// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHeadingId, portableHeadings } from "./headings";
import { prepareArticleHtml } from "./html.server";

describe("article heading navigation", () => {
  it("allocates stable unique IDs including empty and colliding headings", () => {
    const id = createHeadingId();
    expect([id("Too Cold"), id("Too Cold"), id("Too Cold 2"), id("!!!"), id("Lukáš Dostál")]).toEqual(["too-cold", "too-cold-2", "too-cold-2-2", "section", "lukas-dostal"]);
  });
  it("preserves inbound IDs and full text, figures and tables", () => {
    const result = prepareArticleHtml('<h2 id="legacy">Too Cold</h2><h2>Too Cold</h2><h2 id="legacy">Again</h2><h1>Conclusion</h1><p>All original text.</p><figure><img src="https://example.com/chart.png"><figcaption>Original units</figcaption></figure><table><caption>Player data</caption><tr><td>42</td></tr></table>');
    expect(result.headings.map((heading) => heading.id)).toEqual(["legacy", "too-cold", "again", "conclusion"]);
    expect(result.content).toContain('aria-label="Player data"');
    expect(result.content).toContain("All original text.");
    expect(result.content).toContain("<figcaption>Original units</figcaption>");
    expect(result.content).toContain("<td>42</td>");
    expect(result.content).not.toContain("<h1");
  });
  it("anchors portable text headings without changing source blocks", () => {
    const blocks = ["h1", "h2", "h3"].map((style, index) => ({ _type: "block", _key: String(index), style, children: [{ text: "Section" }] }));
    expect(portableHeadings(blocks).map(({ id, level }) => ({ id, level }))).toEqual([{ id: "section", level: 2 }, { id: "section-2", level: 2 }, { id: "section-3", level: 3 }]);
    expect(blocks[0].style).toBe("h1");
  });
});
