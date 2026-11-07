import { fileURLToPath } from "node:url";

// Explicit aliases avoid workspace-wide tsconfig discovery for this isolated artifact.
const root = fileURLToPath(new URL("../../../../", import.meta.url));
export default { root, resolve: { alias: { lib: `${root}web/lib` } } };
