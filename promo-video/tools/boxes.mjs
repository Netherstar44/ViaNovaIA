import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'es-CO' });

async function boxes(url, label) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4500);
  await page.evaluate(() => document.fonts.ready);
  const data = await page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || el.placeholder || '').slice(0, 100) };
    };
    const h1 = document.querySelector('h1');
    const input = document.querySelector('input[type="search"], input[placeholder*="Buscar"], input');
    const hero = document.querySelector('section');
    const heroRect = hero?.getBoundingClientRect();
    const rel = (el) => {
      if (!el || !heroRect) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left - heroRect.left), y: Math.round(r.top - heroRect.top), w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || el.placeholder || '').slice(0, 100) };
    };
    return { h1: pick(h1), h1rel: rel(h1), input: pick(input), inputrel: rel(input), hero: pick(hero), imgs: [...document.querySelectorAll('section img')].slice(0, 6).map((i) => ({ src: (i.currentSrc || i.src).slice(0, 120), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight, box: pick(i) })) };
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 1));
}

await boxes('https://via-nova-ia.vercel.app/', 'HOME');
await boxes('https://via-nova-ia.vercel.app/planificador-viajes-ia', 'PLANNER');
await boxes('https://via-nova-ia.vercel.app/que-hacer-en-neiva', 'NEIVA');
await browser.close();
