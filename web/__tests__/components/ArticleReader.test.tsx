import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArticleReader from "components/ArticleReader/ArticleReader";
import { portableHeadings } from "components/ArticleReader/headings";

vi.mock("next/image", () => ({ default: () => null }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Heading fields retained from /blog/a-commentary-on-goalie-strategy,
// build IlVhzsL9pRi_zqJo2FN_0, October 10, 2026. The dividers are h1 blocks;
// the lower-level sections and strong-marked conclusion retain their structure.
const publishedHeadingBlocks = [
  { _type: "block", _key: "8cfdef4fbf04", style: "h1", children: [{ _type: "span", text: "__", marks: [] }] },
  { _type: "block", _key: "881c315aea37", style: "h1", children: [{ _type: "span", text: "__", marks: [] }] },
  { _type: "block", _key: "d2f3dcdc81ad", style: "h1", children: [{ _type: "span", text: "__", marks: [] }] },
  { _type: "block", _key: "e7acc1bbc9f5", style: "h4", children: [{ _type: "span", text: "A Mirror Argument: Evaluating Goalie Performance with Game Played Stats", marks: [] }] },
  { _type: "block", _key: "8cce799ecb85", style: "h1", children: [{ _type: "span", text: "20 for an Eighth", marks: [] }] },
  { _type: "block", _key: "3661ba5d988e", style: "h4", children: [{ _type: "span", text: "Findings:", marks: [] }] },
  { _type: "block", _key: "a55c061d5bb3", style: "h1", children: [{ _type: "span", text: "__", marks: [] }] },
  { _type: "block", _key: "cebbcde63587", style: "h1", children: [{ _type: "span", text: "Conclusion", marks: ["strong"] }] },
];

function blocksFor(labels: string[], style = "h2") {
  return labels.map((text, index) => ({
    _type: "block",
    _key: `${style}-${index}`,
    style,
    children: [{ _type: "span", text }],
  }));
}

function article(headings: ReturnType<typeof portableHeadings>) {
  return (
    <ArticleReader title="Article fixture" headings={headings}>
      {headings.map((heading) => React.createElement(`h${heading.level}`, {
        key: heading.key,
        id: heading.id,
      }, heading.text))}
    </ArticleReader>
  );
}

describe("ArticleReader contents", () => {
  it("omits the published divider links while preserving every body heading and anchor", () => {
    const original = JSON.stringify(publishedHeadingBlocks);
    const headings = portableHeadings(publishedHeadingBlocks);
    render(article(headings));

    const links = within(screen.getByRole("navigation", { name: "In this article" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["20 for an Eighth", "#20-for-an-eighth"],
      ["Conclusion", "#conclusion"],
    ]);
    for (const heading of headings) {
      expect(document.getElementById(heading.id)?.textContent).toBe(heading.text);
    }
    expect(within(screen.getByRole("article")).getAllByRole("heading", { name: "__" })).toHaveLength(4);
    expect(JSON.stringify(publishedHeadingBlocks)).toBe(original);
    expect(screen.getByRole("link", { name: /Back to articles/ }).getAttribute("href")).toBe("/blog");
  });

  it("keeps numeric, symbol and Unicode titles while omitting blank and divider-only labels", () => {
    const meaningful = ["2026", "5v5 + xG%", "C++ / C#", "_Matchups_", "±", "⚠️", "守備"];
    const headings = portableHeadings(blocksFor(["", " \n\t", "__", " _ - — ", "‐‑‒–—―", ...meaningful]));
    render(article(headings));

    const links = within(screen.getByRole("navigation", { name: "In this article" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(meaningful);
    expect(links.map((link) => decodeURIComponent(link.getAttribute("href")!.slice(1)))).toEqual(headings.slice(-meaningful.length).map((heading) => heading.id));
  });

  it("offers lower-level headings when the only top-level entries are dividers", () => {
    const headings = portableHeadings([
      ...blocksFor(["__"]),
      ...blocksFor(["Named section"], "h3"),
      ...blocksFor(["Detailed section"], "h4"),
    ]);
    render(article(headings));

    const links = within(screen.getByRole("navigation", { name: "In this article" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Named section", "Detailed section"]);
    expect(document.getElementById("section")?.textContent).toBe("__");
  });

  it("hides empty contents and opens a newly useful desktop disclosure even when source count stays the same", () => {
    const { rerender } = render(article(portableHeadings(blocksFor(["__"]))));
    expect(screen.queryByText("In this article")).toBeNull();

    rerender(article(portableHeadings(blocksFor(["Named section"]))));
    expect(screen.getByText("In this article").closest("details")?.open).toBe(true);
    expect(screen.getByRole("navigation", { name: "In this article" })).toBeTruthy();
  });

  it("preserves duplicate heading IDs and destinations allocated before filtering", () => {
    const headings = portableHeadings(blocksFor(["__", "Conclusion", "Conclusion", "±", "±"]));
    render(article(headings));

    const links = within(screen.getByRole("navigation", { name: "In this article" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#conclusion", "#conclusion-2", "#section-2", "#section-3",
    ]);
    expect(headings.map((heading) => heading.id)).toEqual([
      "section", "conclusion", "conclusion-2", "section-2", "section-3",
    ]);
    for (const link of links) {
      expect(document.querySelector(link.getAttribute("href")!)?.textContent).toBe(link.textContent);
    }
  });
});
