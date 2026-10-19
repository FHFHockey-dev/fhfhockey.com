import type { NextApiRequest, NextApiResponse } from "next";

import sanityClient from "@sanity/client";
import { config } from "lib/sanity/config";

const client = sanityClient({ ...config, token: process.env.SANITY_API_TOKEN });

// Published Sanity document ids only; dotted ids such as "drafts.*" are not
// posts a reader can comment on.
const POST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
// The same limits CommentForm enforces in the browser.
const NAME_MIN_LENGTH = 4;
const NAME_MAX_LENGTH = 16;
const COMMENT_MAX_LENGTH = 1000;
const NAME_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
// Comments may keep tabs and line breaks, but no other control characters.
const COMMENT_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

type CommentInput = { postId: string; name: string; comment: string };

function parseCommentInput(body: unknown): CommentInput | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const { postId, name, comment } = body as Record<string, unknown>;
  if (
    typeof postId !== "string" ||
    typeof name !== "string" ||
    typeof comment !== "string"
  ) {
    return null;
  }

  const trimmedName = name.trim();
  const trimmedComment = comment.trim();
  if (
    !POST_ID_PATTERN.test(postId) ||
    trimmedName.length < NAME_MIN_LENGTH ||
    trimmedName.length > NAME_MAX_LENGTH ||
    NAME_CONTROL_CHARACTERS.test(trimmedName) ||
    trimmedComment.length === 0 ||
    trimmedComment.length > COMMENT_MAX_LENGTH ||
    COMMENT_CONTROL_CHARACTERS.test(trimmedComment)
  ) {
    return null;
  }
  return { postId, name: trimmedName, comment: trimmedComment };
}

export default async function createComment(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ message: "Method not allowed", error: "METHOD_NOT_ALLOWED" });
  }

  const input = parseCommentInput(req.body);
  if (!input) {
    return res.status(400).json({
      message:
        "Use a display name of 4-16 characters and a comment of up to 1,000 characters.",
      error: "INVALID_COMMENT",
    });
  }

  try {
    await client.create({
      _type: "comment",
      post: {
        _type: "reference",
        _ref: input.postId,
      },
      name: input.name,
      comment: input.comment,
    });
  } catch (error) {
    console.error("createComment error", error);
    return res.status(500).json({
      message: "Couldn't submit comment",
      error: "COMMENT_SUBMIT_UNAVAILABLE",
    });
  }
  return res.status(200).json({ message: "Comment submitted" });
}
