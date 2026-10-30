import { createForgeReadHandler } from "../../../../lib/forge-v2/api.server";

// No credentials, provider clients or generation routes are constructed on a public request.
// Separate scientific qualification and explicit public-release authorization are required.
export default createForgeReadHandler({ enabled: false, repository: null });
