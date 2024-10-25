import adminOnly from "utils/adminOnlyMiddleware";
import puppeteer from "puppeteer-core";
import supabase from "lib/supabase/server";

const BASE_URL = true ? "https://fhfhockey.com" : "http://localhost:3000";

export default adminOnly(async (req, res) => {
  const gameId = Number(req.query.gameId);
  const teamId = Number(req.query.teamId);
  const start = performance.now();
  console.log(`start to handle new line combo for ${gameId} team: ${teamId}`);
  try {
    await retryAsyncOperation(() => saveLinemateMatrixImages(gameId, [teamId]));

    console.log("Screenshots are saved to supabase storage.");

    const resp = await retryAsyncOperation(() =>
      sendLineComboToDiscord(gameId, teamId)
    );
    console.log(resp);
    const end = performance.now();
    res.json({
      message: "Successfully handled the line combo for " + gameId,
      executionTime: `${(end - start).toFixed(3)} milliseconds`,
    });
  } catch (e: any) {
    console.error(e);
    res.json({
      error:
        `Failed to handle the line combo ${teamId}-${gameId} error: ` +
        e.message,
    });
  }
});

async function saveLinemateMatrixImages(gameId: number, teamIds: number[]) {
  console.log("Start to save line combo for " + gameId);
  let old = Date.now();
  console.log(process.env.PUPPETEER_ENDPOINT);
  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.PUPPETEER_ENDPOINT,
  });

  // Create a page
  const page = await browser.newPage();

  // Go to your site
  await page.goto(`${BASE_URL}/lines/line-combo/${gameId}`);
  await page.waitForSelector(".content");
  console.log(`show linemate duration: ${Date.now() - old}`);

  old = Date.now();
  // Hide header
  await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return;
    header.style.display = "none";
  });

  console.log(`hide header duration: ${Date.now() - old}`);

  old = Date.now();

  console.log(`get teamIds duration: ${Date.now() - old}`);

  const urls = await Promise.all(
    teamIds.map(async (teamId) => {
      old = Date.now();

      const content = await page.$(`#linemate-matrix-${teamId} > .content`);
      if (!content) throw new Error("Cannot find the matrix");

      const image = await content.screenshot({
        type: "png",
      });
      console.log(`take one screenshot duration: ${Date.now() - old}`);

      old = Date.now();

      const { data, error } = await supabase.storage
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

function sendLineComboToDiscord(gameId: number, teamId: number) {
  return fetch(
    `https://fhfhockey.com/api/v1/discord/send-message/line-combo/${gameId}?teamId=${teamId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    }
  ).then((res) => res.json());
}

// Utility function for retrying asynchronous operations
async function retryAsyncOperation(
  operation: any,
  maxRetries = 3,
  delay = 1000
) {
  let retryCount = 0;
  while (true) {
    try {
      return await operation(); // Execute the operation and return the result
    } catch (error: any) {
      if (retryCount >= maxRetries) {
        throw error; // If max retries reached, rethrow the error
      }
      console.error(`Attempt ${retryCount + 1} failed: ${error.message}`);
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
    }
  }
}
