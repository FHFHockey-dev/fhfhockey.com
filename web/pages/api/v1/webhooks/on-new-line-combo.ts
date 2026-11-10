import adminOnly from "utils/adminOnlyMiddleware";
import puppeteer from "puppeteer-core";
import supabase from "lib/supabase/server";
import { linemateMatrixCaptureSelector } from "lib/lines/matrixCapture";
import { webhookErrorDiagnostic } from "lib/lines/webhookErrorDiagnostic";

const BASE_URL = true ? "https://fhfhockey.com" : "http://localhost:3000";

class NonRetryableWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableWebhookError";
  }
}

function isNonRetryableWebhookError(error: unknown): boolean {
  if (error instanceof NonRetryableWebhookError) return true;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    message.includes("PUPPETEER_ENDPOINT is not configured") ||
    message.includes("ECONNREFUSED") ||
    message.includes("browser endpoint is unavailable")
  );
}

export default adminOnly(async (req, res) => {
  const gameId = Number(req.query.gameId);
  const teamId = Number(req.query.teamId);
  console.log(`start to handle new line combo for ${gameId} team: ${teamId}`);
  let stage: "screenshots" | "discord" = "screenshots";
  try {
    let start = performance.now();
    await retryAsyncOperation(() => saveLinemateMatrixImages(gameId, [teamId]));

    console.log(
      `Screenshots are taken and saved to supabase storage. duration: ${
        performance.now() - start
      }`
    );

    start = performance.now();

    stage = "discord";
    await retryAsyncOperation(() => sendLineComboToDiscord(gameId, teamId));

    console.log(
      `Successfully send the messages to discord. duration ${
        performance.now() - start
      }`
    );

    res.json({
      message: "Successfully handled the line combo for " + gameId
    });
  } catch (e: unknown) {
    console.error("on-new-line-combo error:", {
      gameId,
      teamId,
      stage,
      error: webhookErrorDiagnostic(e)
    });
    res.status(500).json({
      success: false,
      error: "Line-combination webhook processing failed."
    });
  }
});

async function saveLinemateMatrixImages(gameId: number, teamIds: number[]) {
  console.log("Start to save line combo for " + gameId);
  let old = Date.now();
  if (!process.env.PUPPETEER_ENDPOINT) {
    throw new NonRetryableWebhookError("PUPPETEER_ENDPOINT is not configured.");
  }
  let browser: any;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.PUPPETEER_ENDPOINT
    });
  } catch (err: unknown) {
    console.error("Failed to connect to puppeteer:", {
      gameId,
      error: webhookErrorDiagnostic(err)
    });
    throw new NonRetryableWebhookError(
      "Failed to connect to puppeteer: browser endpoint is unavailable."
    );
  }

  // Create a page
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // Go to your site
  await page.goto(`${BASE_URL}/lines/line-combo/${gameId}?isScreenshot=1`);
  await page.waitForSelector(".content");
  console.log(`show linemate duration: ${Date.now() - old}`);

  old = Date.now();
  // Hide header
  await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return;
    header.style.display = "none";
  });

  // Hide mobile bottom navigation if present (defensive)
  await page.evaluate(() => {
    const mobile = document.querySelector(
      ".mobileNavWrapper"
    ) as HTMLElement | null;
    if (mobile) mobile.style.display = "none";
    const bottom = document.querySelector(".bottomNav") as HTMLElement | null;
    if (bottom) bottom.style.display = "none";
  });

  console.log(`hide header duration: ${Date.now() - old}`);

  old = Date.now();

  console.log(`get teamIds duration: ${Date.now() - old}`);

  const urls = await Promise.all(
    teamIds.map(async (teamId) => {
      old = Date.now();

      const content = await page.$(linemateMatrixCaptureSelector(teamId));
      if (!content) throw new Error("Cannot find the matrix");

      const image = await content.screenshot({
        type: "png"
      });
      console.log(`take one screenshot duration: ${Date.now() - old}`);

      old = Date.now();

      const { data, error } = await supabase.storage
        .from("images")
        .upload(`line-combos/${gameId}-${teamId}.png`, image, {
          cacheControl: "604800",
          contentType: "image/png",
          upsert: true
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
        Authorization: `Bearer ${process.env.CRON_SECRET}`
      }
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
      if (isNonRetryableWebhookError(error)) {
        throw error;
      }
      if (retryCount >= maxRetries) {
        throw error; // If max retries reached, rethrow the error
      }
      console.error(`Attempt ${retryCount + 1} failed:`, webhookErrorDiagnostic(error));
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
    }
  }
}
