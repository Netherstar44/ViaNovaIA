import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 160)); });

async function probe(url, label) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4500);
  await page.evaluate(() => document.fonts.ready);
  console.log(`\n=== ${label} ${url} ===`);
  const info = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('section')].map((s, i) => {
      const h = s.querySelector('h1,h2,h3');
      const r = s.getBoundingClientRect();
      return { i, y: Math.round(r.top + scrollY), h: Math.round(r.height), heading: h?.innerText?.slice(0, 70) || '' };
    });
    const h3 = [...document.querySelectorAll('h3')].find((e) => e.innerText.includes('Hotel Plaza Neiva'));
    let chain = [];
    if (h3) {
      let n = h3;
      for (let i = 0; i < 8 && n; i++) {
        const r = n.getBoundingClientRect();
        chain.push({ tag: n.tagName, cls: String(n.className).slice(0, 90), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top + scrollY) });
        n = n.parentElement;
      }
    }
    const map = document.querySelector('.maplibregl-map, .mapboxgl-map, canvas.maplibregl-canvas');
    const mapBox = map ? (() => { const r = map.getBoundingClientRect(); return { tag: map.tagName, cls: String(map.className).slice(0, 90), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top + scrollY) }; })() : null;
    return { sections, chain, mapBox, title: document.title, bodyH: document.body.scrollHeight };
  });
  console.log(JSON.stringify(info, null, 1));
}

await probe('https://via-nova-ia.vercel.app/', 'HOME');
await probe('https://via-nova-ia.vercel.app/planificador-viajes-ia', 'PLANNER');
await probe('https://via-nova-ia.vercel.app/que-hacer-en-neiva', 'NEIVA');
await browser.close();
