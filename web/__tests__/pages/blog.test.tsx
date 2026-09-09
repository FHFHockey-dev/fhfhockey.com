import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sources = vi.hoisted(() => ({ sanity: vi.fn(), substack: vi.fn() }));
vi.mock("lib/sanity/sanity.server", () => ({ getClient: () => ({ fetch: sources.sanity }) }));
vi.mock("lib/substack", () => ({ getSubstackPosts: sources.substack }));
vi.mock("lib/sanity/sanity", () => ({ urlFor: () => ({ url: () => "/chart.png" }) }));
vi.mock("next/image", () => ({ default: ({ fill, priority, unoptimized, ...props }: any) => React.createElement("img", props) }));
vi.mock("next/head", () => ({ default: ({ children }: any) => <>{children}</> }));
import Blog, { getStaticProps, PostPreviewData } from "pages/blog";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const posts: PostPreviewData[] = [
  { slug: "substack/newest", title: "Latest source story", summary: "A full article", createdAt: "September 8, 2026", publishedAt: "2026-09-08T12:00:00Z", imageUrl: "/hero.png" },
  { slug: "archive-one", title: "An unusually long source headline that stays readable in the archive", summary: "Deployment analysis", createdAt: "September 7, 2026", publishedAt: "2026-09-07T12:00:00Z", imageUrl: "/chart.png", topics: ["Strategy"] },
  { slug: "substack/archive-two", title: "Another source story", summary: "Goalie analysis", createdAt: "September 6, 2026", publishedAt: "2026-09-06T12:00:00Z", imageUrl: "", topics: ["Goaltending"] }
];

describe("FHFH article library", () => {
  it("promotes one story, keeps archive routes internal, and filters/reset across metadata", () => {
    render(<Blog posts={posts} />);
    const archive = screen.getByRole("region", { name: /From the archive/i });
    expect(within(archive).queryByText(posts[0].title)).toBeNull();
    expect(within(archive).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search articles" }), { target: { value: "Strategy" } });
    expect(within(archive).getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(within(archive).getByRole("link", { name: posts[1].title }).getAttribute("href")).toBe("/blog/archive-one");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-match" } });
    expect(within(archive).queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }));
    expect(within(archive).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox", { name: "Topic" }), { target: { value: "Goaltending" } });
    expect(within(archive).getByRole("link", { name: posts[2].title }).getAttribute("href")).toBe("/blog/substack/archive-two");
  });

  it("handles an empty publication without placeholder stories or unavailable topic controls", () => {
    render(<Blog posts={[]} />);
    expect(screen.getByText("No articles published yet.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("link", { name: /Read article/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Subscribe on Substack/ }).getAttribute("href")).toBe("https://fhfhockey.substack.com/subscribe");
  });

  it("sorts by original timestamp and returns serializable missing-field fallbacks", async () => {
    sources.sanity.mockResolvedValue([{ slug: "older", title: "Older", publishedAt: "2026-01-01T02:00:00Z", mainImage: null, author: null, summary: null, topics: null }]);
    sources.substack.mockResolvedValue([{ slug: "newer", title: "Newer", summary: "Source summary", publishedAt: "2026-01-01T20:00:00Z", imageUrl: "", author: "" }]);
    const result: any = await getStaticProps({});
    expect(result.props.posts.map((p: PostPreviewData) => p.slug)).toEqual(["substack/newer", "older"]);
    expect(JSON.parse(JSON.stringify(result.props))).toEqual(result.props);
    expect(result.props.posts[1].summary).toBe("");
    expect(result.props.posts[1].imageUrl).toBeTruthy();
  });
});
