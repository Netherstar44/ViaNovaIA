import { readFileSync } from "node:fs";
import path from "node:path";

const KEY = process.env.INDEXNOW_KEY || "84f844541d60e9b000ccb51fc22f265d";
const HOST = "via-nova-ia.vercel.app";
const sitemapPath = path.resolve("dist", "public", "sitemap.xml");

let sitemap;
try {
  sitemap = readFileSync(sitemapPath, "utf8");
} catch {
  console.error(`No se encontró ${sitemapPath}. Ejecuta "npm run build" primero.`);
  process.exit(1);
}

const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1].trim())
  .filter((url) => url.startsWith(`https://${HOST}/`));

if (urlList.length === 0) {
  console.error("El sitemap no contiene URLs del dominio canónico.");
  process.exit(1);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  }),
});

const body = await response.text();
console.log(`IndexNow ${response.status} ${response.statusText}`);
if (body) console.log(body);
console.log(`URLs enviadas: ${urlList.length}`);
console.log(urlList.join("\n"));

if (!response.ok) process.exit(1);
