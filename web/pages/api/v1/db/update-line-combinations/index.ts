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
    await Promise.all(
      gameIds.map((item) => updateLineCombos(item.id, supabase))
    );
    res.json({
      success: true,
      message:
        `Successfully updated the line combinations for these games ` +
        JSON.stringify(gameIds.map((item) => item.id)),
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
});
