import supabase from "lib/supabase";
import supabaseServer from "lib/supabase/server";
import puppeteer from "puppeteer-core";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req, res) => {
  const gameId = Number(req.query.gameId);

  let teamIds = (
    await supabase
      .from("lineCombinations")
      .select("...teams(id)")
      .eq("gameId", gameId)
      .returns<
        {
          id: number;
        }[]
      >()
  ).data!.map((team) => team.id);
  try {
    await saveLinemateMatrixImages(gameId, teamIds);
    res.json({
      message: "Successfully saved the line combo images. " + gameId,
    });
  } catch (e: any) {
    console.error(e);
    res.json({
      error: "Failed to save the line combo " + e.message,
    });
  }
});

function createURL(gameId: number) {
  return `https://fhfhockey.com/lines/line-combo/${gameId}`;
}

async function saveLinemateMatrixImages(gameId: number, teamIds: number[]) {
  let old = Date.now();
  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.PUPPETEER_ENDPOINT,
  });

  // Create a page
  const page = await browser.newPage();

  // Go to your site
  await page.goto(createURL(gameId));
  await page.waitForSelector(".content");
  console.log(`show linemate duration: ${Date.now() - old}`);

  old = Date.now();
  // Hide header
  await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return;
    header!.style.display = "none";
  });

  console.log(`hide header duration: ${Date.now() - old}`);

  old = Date.now();

  console.log(`get teamIds duration: ${Date.now() - old}`);

  console.log({ teamIds });
  const urls = await Promise.all(
    teamIds.map(async (teamId) => {
      old = Date.now();

      const content = await page.$(`#linemate-matrix-${teamId} > .content`);
      const image = await content!.screenshot({
        type: "png",
      });
      console.log(`take one screenshot duration: ${Date.now() - old}`);

      old = Date.now();

      const { data, error } = await supabaseServer.storage
        .from("images")
        .upload(`line-combos/${gameId}-${teamId}.png`, image, {
          cacheControl: "604800",
          contentType: "image/png",
          upsert: true,
        });

      console.log(`upload one image duration: ${Date.now() - old}`);

      if (error) throw error;
      return data.path;
    })
  );

  // Close browser.
  await browser.close();
  return urls;
}
