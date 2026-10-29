import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // `extensions` maps clean URLs (/viajes-colombia) to the prerendered
  // viajes-colombia.html files, so the SEO pages keep their content even when
  // the app is hosted on a plain Node server instead of Vercel's cleanUrls.
  app.use(express.static(distPath, { extensions: ["html"] }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
