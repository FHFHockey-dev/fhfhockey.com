// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  emptyOccurrenceIdentity, planOccurrenceIdentity, verifyDistinctOccurrenceDocument,
  type OccurrenceIdentityInput,
} from "../../../web/lib/sources/tweetClaimOccurrenceIdentity";

const asOf = "2026-10-15T18:00:00Z";
const input = (id: string): OccurrenceIdentityInput => ({
  derivationId: `review:${id}`, receiptId: "review:receipt-a",
  sourceText: "Jordan Staal will not play tonight.",
  subjectSpan: { start: 0, end: 12, text: "Jordan Staal" },
  predicateSpan: { start: 13, end: 26, text: "will not play" },
  original: { tweetId: "9900000000000000001", author: "fixture_a", publishedAt: "2026-10-15T12:00:00Z" },
});

describe("independent occurrence safety regressions", () => {
  it("holds overlapping same-text anchor changes instead of allocating a second lexical occurrence", () => {
    const first = planOccurrenceIdentity(emptyOccurrenceIdentity("review:overlap"), input("first"), asOf);
    expect(first.accepted).toBe(true);
    const second = planOccurrenceIdentity(first.nextState, {
      ...input("narrower"), predicateSpan: { start: 18, end: 26, text: "not play" },
    }, asOf);
    console.log("overlap result", JSON.stringify(second));
    expect(second.accepted).toBe(false);
    expect(second.nextState).toEqual(first.nextState);
  });

  it("holds different text of the same bound original even when the receipt changes", () => {
    const first = planOccurrenceIdentity(emptyOccurrenceIdentity("review:cross-receipt"), input("first"), asOf);
    const second = planOccurrenceIdentity(first.nextState, {
      ...input("different-text"), receiptId: "review:receipt-b",
      sourceText: "Jordan Staal will not play tomorrow.",
    }, asOf);
    console.log("cross-receipt result", JSON.stringify(second));
    expect(second.accepted).toBe(false);
    expect(second.nextState).toEqual(first.nextState);
  });

  it.each([
    ["subjectSpan", 0], ["subjectSpan", 999], ["predicateSpan", 0], ["predicateSpan", 999],
  ] as const)("rejects a document proof when the input %s end is %s", (field, end) => {
    const left = input("left");
    const right = { ...input("right"), sourceText: "Jordan Staal will not play tomorrow." };
    const offset = left.sourceText.length + 1;
    const side = (i: OccurrenceIdentityInput, start: number) => ({
      clause: { start, end: start + i.sourceText.length, text: i.sourceText },
      subject: { ...i.subjectSpan, start: start + i.subjectSpan.start, end: start + i.subjectSpan.end },
      predicate: { ...i.predicateSpan, start: start + i.predicateSpan.start, end: start + i.predicateSpan.end },
    });
    const proof = {
      original: left.original!, text: `${left.sourceText} ${right.sourceText}`,
      receiptId: "review:full-document", knownAt: asOf, basis: "explicit synthetic retained document",
      left: side(left, 0), right: side(right, offset),
    };
    expect(verifyDistinctOccurrenceDocument(proof, left, right, asOf)).toBe(true);
    const malformed = { ...left, [field]: { ...left[field], end } };
    const accepted = verifyDistinctOccurrenceDocument(proof, malformed, right, asOf);
    console.log("malformed span result", JSON.stringify({ field, end, accepted }));
    expect(accepted).toBe(false);
  });
});
