// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-line-combinations\index.ts

import adminOnly from "utils/adminOnlyMiddleware";
import { updateLineCombos } from "./[id]";

export default adminOnly(async (req, res) => {
  const supabase = req.supabase;
  const count = req.query.count ? Number(req.query.count) : 5;

  try {
    const { data: gameIds } = await supabase
      .rpc("get_unprocessed_line_combinations")
      .select("id")
      .limit(count)
      .throwOnError();
    if (!gameIds) throw new Error("Cannot find unprocessed game ids.");
    if (gameIds.length === 0) {
      return res.json({
        message: "All line combination data have been updated.",
        success: true,
      });
    }
    const results = await Promise.allSettled(
      gameIds.map((item) => updateLineCombos(item.id, supabase))
    );
    const updated = results.filter(
      (item) => item.status === "fulfilled"
    ) as PromiseFulfilledResult<any[]>[];
    const failed = results.filter(
      (item) => item.status === "rejected"
    ) as PromiseRejectedResult[];

    // Log the errors if any
    failed.forEach((item) => console.error(item.reason));

    res.json({
      success: true,
      message:
        `Successfully updated the line combinations for these games [${updated.map(
          (item) => item.value[0].gameId
        )}]` +
        (failed.length > 0
          ? ` failed games [${failed.map((item) => item.reason.message)}]`
          : ""),
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
});
