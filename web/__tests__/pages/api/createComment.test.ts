import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("@sanity/client", () => ({
  default: () => ({ create: createMock }),
}));

import handler from "../../../pages/api/createComment";

function createMockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

const validBody = {
  postId: "8f14e45f-ceea-467a-9575-0a5f1bfa1b3c",
  name: "Puckhead",
  comment: "Great breakdown.\nThanks!",
};

describe("/api/createComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue({ _id: "comment-1" });
  });

  it("allows only POST", async () => {
    const res = createMockRes();

    await handler({ method: "GET", body: validBody } as any, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects malformed, oversized and non-string input before writing", async () => {
    const invalidBodies = [
      undefined,
      "postId=abc",
      [],
      { ...validBody, postId: 42 },
      { ...validBody, postId: "drafts.8f14e45f" },
      { ...validBody, postId: "*[_type == 'post']" },
      { ...validBody, postId: "a".repeat(129) },
      { ...validBody, name: { $ne: "" } },
      { ...validBody, name: "abc" },
      { ...validBody, name: "a".repeat(17) },
      { ...validBody, name: "   ab   " },
      { ...validBody, name: "Puck\u0000head" },
      { ...validBody, comment: "   " },
      { ...validBody, comment: "a".repeat(1001) },
      { ...validBody, comment: "ok\u0007" },
    ];

    for (const body of invalidBodies) {
      const res = createMockRes();
      await handler({ method: "POST", body } as any, res);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.body).toEqual({
        message:
          "Use a display name of 4-16 characters and a comment of up to 1,000 characters.",
        error: "INVALID_COMMENT",
      });
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("writes only the validated, trimmed fields", async () => {
    const res = createMockRes();

    await handler(
      {
        method: "POST",
        body: {
          ...validBody,
          name: "  Puckhead  ",
          comment: "  Great breakdown.\nThanks!  ",
          _type: "post",
          approved: true,
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Comment submitted" });
    expect(createMock).toHaveBeenCalledWith({
      _type: "comment",
      post: { _type: "reference", _ref: validBody.postId },
      name: "Puckhead",
      comment: "Great breakdown.\nThanks!",
    });
  });

  it("returns a stable error without the Sanity error details", async () => {
    createMock.mockRejectedValueOnce(
      Object.assign(new Error("Insufficient permissions; token secret"), {
        statusCode: 403,
        response: { body: { error: "secret project detail" } },
      }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = createMockRes();

    await handler({ method: "POST", body: validBody } as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      message: "Couldn't submit comment",
      error: "COMMENT_SUBMIT_UNAVAILABLE",
    });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
