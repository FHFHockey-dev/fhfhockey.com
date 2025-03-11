// /web/pages/api/v1/db/update-yahoo-players.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import path from "path";

// Define the absolute path to your Python script
const PY_SCRIPT_PATH = path.join(
  process.cwd(),
  "lib",
  "supabase",
  "Upserts",
  "Yahoo",
  "yahooAPI.py"
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow only POST and GET requests
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  // Start timer
  const startTime = Date.now();

  // Spawn the Python process
  const child = spawn("python3", [PY_SCRIPT_PATH]);

  let stdoutData = "";
  let stderrData = "";
  let responded = false; // Track whether a response has been sent

  // Collect standard output
  child.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  // Collect error output
  child.stderr.on("data", (data) => {
    stderrData += data.toString();
  });

  // If the script closes, send a response
  child.on("close", (code) => {
    const endTime = Date.now();
    const elapsedMs = endTime - startTime;
    const elapsedSec = (elapsedMs / 1000).toFixed(2);

    if (!responded) {
      responded = true;
      if (code === 0) {
        return res.status(200).json({
          success: true,
          message: "yahooAPI.py ran successfully!",
          stdout: stdoutData,
          elapsedTime: `${elapsedSec} seconds`
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "yahooAPI.py failed!",
          stderr: stderrData,
          exitCode: code,
          elapsedTime: `${elapsedSec} seconds`
        });
      }
    }
  });

  // Add a timeout to ensure the request does not hang forever
  const timeoutMs = 5 * 60 * 1000; // 5 minutes timeout (adjust as needed)
  setTimeout(() => {
    if (!responded) {
      responded = true;
      child.kill(); // Kill the process if it takes too long
      return res.status(500).json({
        success: false,
        message: "Process timeout: yahooAPI.py took too long to respond.",
        elapsedTime: `${(timeoutMs / 1000).toFixed(2)} seconds`
      });
    }
  }, timeoutMs);

  // Catch unexpected errors
  child.on("error", (error) => {
    if (!responded) {
      responded = true;
      return res.status(500).json({
        success: false,
        message: "Failed to start yahooAPI.py process.",
        error: error.message
      });
    }
  });
}
