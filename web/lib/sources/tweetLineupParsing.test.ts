import { describe, expect, it, vi } from "vitest";

import {
  extractStatusUrlsFromText,
  extractTcoUrlsFromText,
  extractTweetIdFromUrl,
  normalizeTweetStatusUrl,
  parseTweetOEmbedHtml,
  resolveQuotedTweetUrlFromText
} from "./tweetLineupParsing";

describe("tweetLineupParsing", () => {
  it("parses oEmbed html with preserved br line breaks and posted link metadata", () => {
    const parsed = parseTweetOEmbedHtml(`
      <blockquote>
        <p>
          The #GoBolts lines unchanged in warmups:<br><br>
          Goncalves-Point-Kucherov<br>
          Hagel-Cirelli-Guentzel
        </p>
        <a href="https://twitter.com/BenjaminJReport/status/2047808467969220779">
          Apr 24, 2026
        </a>
      </blockquote>
    `);

    expect(parsed).toEqual({
      text:
        "The #GoBolts lines unchanged in warmups:\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel",
      postedLabel: "Apr 24, 2026",
      sourceTweetUrl: "https://twitter.com/BenjaminJReport/status/2047808467969220779"
    });
  });

  it("extracts tweet ids and normalizes twitter/x status urls", () => {
    expect(extractTweetIdFromUrl("https://x.com/CcCMiddleton/status/2047809041154625899")).toBe(
      "2047809041154625899"
    );
    expect(
      normalizeTweetStatusUrl("https://twitter.com/CcCMiddleton/status/2047809041154625899")
    ).toBe("https://twitter.com/i/web/status/2047809041154625899");
  });

  it("finds direct status urls and t.co urls in text", () => {
    expect(
      extractStatusUrlsFromText(
        "wrapper https://x.com/BenjaminJReport/status/2047808467969220779 text"
      )
    ).toEqual(["https://x.com/BenjaminJReport/status/2047808467969220779"]);

    expect(extractTcoUrlsFromText("Lightning lines https://t.co/9cZkBXydVn")).toEqual([
      "https://t.co/9cZkBXydVn"
    ]);
  });

  it("resolves quoted tweet urls from direct status links or expanded t.co links", async () => {
    expect(
      await resolveQuotedTweetUrlFromText(
        "quoted https://x.com/BenjaminJReport/status/2047808467969220779"
      )
    ).toBe("https://twitter.com/i/web/status/2047808467969220779");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "location"
              ? "https://twitter.com/BenjaminJReport/status/2047808467969220779"
              : null
        },
        url: "https://t.co/9cZkBXydVn"
      })
    );

    expect(await resolveQuotedTweetUrlFromText("Lightning lines https://t.co/9cZkBXydVn")).toBe(
      "https://twitter.com/i/web/status/2047808467969220779"
    );

    vi.unstubAllGlobals();
  });
});
