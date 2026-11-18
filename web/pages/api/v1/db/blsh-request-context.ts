// Verify the signed grant against the original JSON body before opening the request ledger.
export { default } from "lib/blsh/nativeCaptureV6/requestContextHandler";
export const config = { maxDuration: 240, api: { bodyParser: false } };
