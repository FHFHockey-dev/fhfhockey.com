import { officialPilotHandler } from "lib/blsh/nativeCaptureV6/officialPilotHandler";

export const config = { maxDuration: 240, api: { bodyParser: false } };
export default officialPilotHandler(typeof __filename === "string" ? __filename : "");
