import { mockHandler } from "lib/mockDraft/api";
export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };
export default mockHandler("register");
