import type { NextApiRequest, NextApiResponse } from "next";

import sanityClient from "@sanity/client";
import { config } from "lib/sanity/config";

const client = sanityClient({ ...config, token: process.env.SANITY_API_TOKEN });

export default async function createComment(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { postId, name, comment } = req.body;
  try {
    await client.create({
      _type: "comment",
      post: {
        _type: "reference",
        _ref: postId,
      },
      name,
      comment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: `Couldn't submit comment`, error });
  }
  return res.status(200).json({ message: "Comment submitted" });
}
