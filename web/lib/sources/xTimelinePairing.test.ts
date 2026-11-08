import { describe, expect, it } from "vitest";
import { normalisePostText, pairShadowWithIfttt, repostHandle } from "./xTimelinePairing";

const shadow = (tweet_id: string, extra: Partial<{ post_kind: string; full_text: string; original_author_handle: string; source_key: string }> = {}) => ({
  source_key: "dfofantasy", tweet_id, post_kind: "post", full_text: "Own post", original_author_handle: null as string | null, ...extra,
});
const ifttt = (id: string, tweet_id: string | null, text: string, source_key = "dfofantasy") => ({ id, source_key, tweet_id, text });

describe("normalisePostText and repostHandle", () => {
  it("strips the RT prefix, links, ellipses and spacing", () => {
    expect(normalisePostText("RT @CapFriendly:  Line   rushes https://t.co/abc …")).toBe("line rushes");
    expect(repostHandle("RT @CapFriendly: Line rushes")).toBe("capfriendly");
    expect(repostHandle("Line rushes")).toBeNull();
    expect(repostHandle(null)).toBeNull();
  });
});

describe("pairShadowWithIfttt", () => {
  it("pairs own posts by tweet id and keeps accounts apart", () => {
    const result = pairShadowWithIfttt(
      [shadow("1"), shadow("2", { source_key: "ccc" })],
      [ifttt("a", "1", "Own post"), ifttt("b", "2", "Own post")],
    );
    expect(result.pairs.map((pair) => [pair.shadow.tweet_id, pair.ifttt.id, pair.by])).toEqual([["1", "a", "tweet_id"]]);
    expect(result.unpairedShadow.map((row) => row.tweet_id)).toEqual(["2"]);
    expect(result.unpairedIfttt.map((row) => row.id)).toEqual(["b"]);
  });

  it("pairs a repost by handle and text when IFTTT holds the wrapper id and truncated text", () => {
    const repost = shadow("900", {
      post_kind: "repost", original_author_handle: "NHLFlyers",
      full_text: "Tonight's lines: Couturier centres Konecny and Michkov on the top line",
    });
    const result = pairShadowWithIfttt([repost], [
      ifttt("x", "555", "RT @OtherTeam: Tonight's lines: Couturier centres Konecny and Michkov"),
      ifttt("w", "556", "RT @NHLFlyers: Tonight's lines: Couturier centres Konec… https://t.co/x"),
    ]);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({ by: "rt_text", ifttt: { id: "w" } });
  });

  it("does not pair a repost whose head is too short or whose IFTTT text is empty", () => {
    const short = shadow("901", { post_kind: "repost", original_author_handle: "abc", full_text: "Hi there" });
    const long = shadow("902", { post_kind: "repost", original_author_handle: "abc", full_text: "A long enough repost body here" });
    const result = pairShadowWithIfttt([short, long], [ifttt("e", "1", "RT @abc: Hi there"), ifttt("f", "2", "RT @abc: https://t.co/only")]);
    expect(result.pairs).toHaveLength(0);
  });

  it("uses each IFTTT row once", () => {
    const result = pairShadowWithIfttt([shadow("1"), shadow("1")], [ifttt("a", "1", "Own post")]);
    expect(result.pairs).toHaveLength(1);
    expect(result.unpairedShadow).toHaveLength(1);
  });
});
