import express from "express";
import dotenv from "dotenv";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || "";

const supabaseServer = createClient(supabaseUrl, supabaseKey);

// Middleware to check if the request is from an admin
function adminOnly(req, res, next) {
  // Implement your admin check logic here
  const auth = req.get("authorization") ?? "";
  const token = auth.split(" ").at(-1);
  if (token === process.env.CRON_SECRET) {
    next();
  } else {
    res.json({ error: "Failed to do the operation you are not an admin." });
  }
}

app.post("/on-new-line-combo", adminOnly, async (req, res) => {
  const gameId = Number(req.query.gameId);
  const teamId = Number(req.query.teamId);
  console.log(`start to handle new line combo for ${gameId} team: ${teamId}`);
  try {
    await retryAsyncOperation(() => saveLinemateMatrixImages(gameId, [teamId]));

    const resp = await retryAsyncOperation(() =>
      sendLineComboToDiscord(gameId, teamId)
    );
    console.log(resp);
    res.json({
      message: "Successfully handled the line combo for " + gameId,
    });
  } catch (e) {
    console.error(e);
    res.json({
      error:
        `Failed to handle the line combo ${teamId}-${gameId} error: ` +
        e.message,
    });
  }
});

async function saveLinemateMatrixImages(gameId, teamIds) {
  console.log("Start to save line combo for " + gameId);
  let old = Date.now();
  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.PUPPETEER_ENDPOINT,
  });

  // Create a page
  const page = await browser.newPage();

  // Go to your site
  await page.goto(`https://fhfhockey.com/lines/line-combo/${gameId}`);
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
      const image = await content.screenshot({
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

function sendLineComboToDiscord(gameId, teamId) {
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
async function retryAsyncOperation(operation, maxRetries = 3, delay = 1000) {
  let retryCount = 0;
  while (true) {
    try {
      return await operation(); // Execute the operation and return the result
    } catch (error) {
      if (retryCount >= maxRetries) {
        throw error; // If max retries reached, rethrow the error
      }
      console.error(`Attempt ${retryCount + 1} failed: ${error.message}`);
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
    }
  }
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
