import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('../assets/ui');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'es-CO' });
const page = await ctx.newPage();
await page.goto('https://via-nova-ia.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
await page.evaluate(() => document.fonts.ready);

for (const t of ['Hotel Plaza Neiva', 'Asadero El Huilense', 'Taxi Rápido Neiva', 'Transfer al Desierto de la Tatacoa', 'Hotel Chicalá Real', 'Restaurante La Casona del Río']) {
  const h = page.getByRole('heading', { name: t, exact: false }).first();
  const data = await h.evaluate((el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      if (n.className && String(n.className).includes('group') && n.getBoundingClientRect().width > 380) break;
      n = n.parentElement;
    }
    const r = n.getBoundingClientRect();
    return {
      text: n.innerText.slice(0, 300),
      box: { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      imgs: [...n.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight })),
      bg: getComputedStyle(n).backgroundColor,
    };
  });
  console.log(JSON.stringify({ t, ...data }, null, 1));
}

// mobile catalog capture fixed
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'light', reducedMotion: 'reduce', locale: 'es-CO' });
const mp = await m.newPage();
await mp.goto('https://via-nova-ia.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await mp.waitForTimeout(6000);
await mp.evaluate(() => document.fonts.ready);
const mh = mp.getByRole('heading', { name: 'Hotel Plaza Neiva', exact: false }).first();
await mh.scrollIntoViewIfNeeded();
await mp.waitForTimeout(600);
const y = await mp.evaluate(() => scrollY);
await mp.screenshot({ path: path.join(OUT, 'm-home-catalog.png') });
console.log('MOBILE scrollY', y, fs.statSync(path.join(OUT, 'm-home-catalog.png')).size);

const info = await mp.evaluate(() => {
  const h = [...document.querySelectorAll('h3')].find((e) => e.innerText.includes('Hotel Plaza Neiva'));
  const card = h?.closest('div.group');
  const r = card?.getBoundingClientRect();
  return { card: r ? { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } : null, bodyH: document.body.scrollHeight };
});
console.log('MOBILE INFO', JSON.stringify(info));

await browser.close();
