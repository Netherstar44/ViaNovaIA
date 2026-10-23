import { rm, stat } from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve("dist", "public");

// Cloudflare Workers Static Assets rejects files over 25 MiB. This placeholder
// is not referenced by the app and only exists to reserve space locally.
const unusedLargeFile = path.join(assetsDir, "dummy_assets.bin");
await rm(unusedLargeFile, { force: true });

await stat(path.join(assetsDir, "index.html")).catch(() => {
  throw new Error(
    "dist/public/index.html was not generated. Run `vite build` before deploying to Cloudflare.",
  );
});

console.log("Cloudflare assets ready in dist/public");
