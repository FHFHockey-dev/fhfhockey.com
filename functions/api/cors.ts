import { Request, Response } from "express";
import corsAnywhere from "cors-anywhere";

let proxy = corsAnywhere.createServer({
  originWhitelist: [], // Allow all origins
  requireHeaders: [], // Do not require any headers.
  removeHeaders: [], // Do not remove any headers.
});

// '/api/cors?url=google.com'
export default async function handler(req: Request, res: Response) {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

  // Strip '/api/cors?url=' from the front of the URL, else the proxy won't work.
  req.url = decodeURIComponent(req.url.replace("/api/cors?url=", "/"));

  proxy.emit("request", req, res);
}
