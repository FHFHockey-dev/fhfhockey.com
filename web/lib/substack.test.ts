// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSubstackPosts, parseSubstackFeed } from "./substack";

const feed = (body: string, date = "Thu, 31 Oct 2024 19:55:50 GMT") => `
  <rss><channel><item>
    <title>Hockey &amp; stats</title>
    <link>https://fhfhockey.substack.com/p/hockey-stats</link>
    <pubDate>${date}</pubDate><dc:creator>Tim</dc:creator>
    <description><![CDATA[<p>A preview</p>]]></description>
    <content:encoded><![CDATA[${body}]]></content:encoded>
  </item></channel></rss>`;

afterEach(() => vi.unstubAllGlobals());

describe("Substack feed", () => {
  it("extracts full articles and preserves prose, links, images and tables", () => {
    const body = '<h2 id="original-stats">Stats</h2><p>Full article</p><figure><img src="https://example.com/photo.jpg" alt="Chart"><figcaption>Original chart credit</figcaption></figure><table><tr><th id="shots" scope="col">Shots</th></tr><tr><td headers="shots">42</td></tr></table><p>Complete article ending</p>';
    const [post] = parseSubstackFeed(feed(body));
    expect(post).toMatchObject({ slug: "hockey-stats", title: "Hockey & stats", author: "Tim", summary: "A preview", publishedAt: "2024-10-31T19:55:50.000Z" });
    expect(post.content).toContain("Full article");
    expect(post.content).toContain('alt="Chart"');
    expect(post.content).toContain('<h2 id="original-stats">Stats</h2>');
    expect(post.content).toContain('<figcaption>Original chart credit</figcaption>');
    expect(post.content).toContain('<th id="shots" scope="col">Shots</th>');
    expect(post.content).toContain('<td headers="shots">42</td>');
    expect(post.content).toContain('Complete article ending');
  });

  it("removes executable markup, unsafe URLs and embedded forms", () => {
    const [post] = parseSubstackFeed(feed('<script>alert(1)</script><p onclick="alert(1)">Safe</p><a href="javascript:alert(1)">link</a><img src="data:text/html,bad" onerror="alert(1)"><iframe src="https://example.com"></iframe><form><input></form>'));
    expect(post.content).toContain("Safe");
    expect(post.content).not.toMatch(/script|onclick|onerror|data:|iframe|form|input/);
  });

  it("rejects invalid feeds and skips unusable dates or foreign post URLs", () => {
    expect(() => parseSubstackFeed("<html>Error</html>")).toThrow("Invalid Substack");
    expect(parseSubstackFeed(feed("Hi", "invalid"))).toEqual([]);
    expect(parseSubstackFeed(feed("Hi").replace("https://fhfhockey.substack.com/p/", "https://example.com/p/"))).toEqual([]);
  });

  it("throws on upstream failures so ISR can retain its last successful page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(getSubstackPosts()).rejects.toThrow("503");
  });
});
