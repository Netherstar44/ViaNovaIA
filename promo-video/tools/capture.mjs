import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('../assets/ui');
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];

const browser = await chromium.launch();

async function open(width, height, dsf) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'es-CO',
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function settle(page, ms = 4000) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page, id, opts) {
  const file = path.join(OUT, `${id}.png`);
  await page.screenshot({ path: file, ...opts });
  const buf = fs.readFileSync(file);
  manifest.push({ id, file: `assets/ui/${id}.png`, bytes: buf.length, ...opts });
  console.log('SHOT', id, buf.length);
}

async function elementShot(page, id, handle) {
  const file = path.join(OUT, `${id}.png`);
  await handle.screenshot({ path: file });
  const box = await handle.boundingBox();
  const buf = fs.readFileSync(file);
  manifest.push({ id, file: `assets/ui/${id}.png`, bytes: buf.length, box });
  console.log('ELEMENT', id, JSON.stringify(box), buf.length);
}

function sectionByHeading(page, re) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: re }) }).first();
}

async function cardByHeading(page, text) {
  const h = page.getByRole('heading', { name: text, exact: false }).first();
  await h.waitFor({ state: 'attached', timeout: 20000 });
  return await h.evaluateHandle((el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) {
      if (n.className && String(n.className).includes('group') && n.getBoundingClientRect().width > 380) return n;
      n = n.parentElement;
    }
    return el.parentElement?.parentElement?.parentElement;
  });
}

async function runDesktop() {
  const { ctx, page } = await open(1920, 1080, 2);

  // HOME
  await page.goto('https://via-nova-ia.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 5000);
  await shot(page, 'home-full-top', { fullPage: false });
  const hero = sectionByHeading(page, /Planifica tu viaje con/);
  await elementShot(page, 'home-hero-section', await hero.elementHandle());
  await shot(page, 'home-catalog-band', { fullPage: true, clip: { x: 0, y: 780, width: 1920, height: 1000 } });
  const map = page.locator('.maplibregl-map').first();
  if (await map.count()) await elementShot(page, 'home-map', await map.elementHandle());

  for (const [id, text] of [
    ['card-hotel-plaza', 'Hotel Plaza Neiva'],
    ['card-asadero', 'Asadero El Huilense'],
    ['card-taxi', 'Taxi Rápido Neiva'],
    ['card-transfer', 'Transfer al Desierto de la Tatacoa'],
  ]) {
    try {
      const handle = await cardByHeading(page, text);
      await elementShot(page, id, handle);
    } catch (e) { console.log('MISS', id, e.message.slice(0, 120)); }
  }

  // PLANNER
  await page.goto('https://via-nova-ia.vercel.app/planificador-viajes-ia', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 4000);
  await elementShot(page, 'planner-hero', await sectionByHeading(page, /Planificador de viajes con IA/).elementHandle());
  await elementShot(page, 'planner-steps', await sectionByHeading(page, /Cómo crear tu itinerario/).elementHandle());
  await elementShot(page, 'planner-includes', await sectionByHeading(page, /Qué incluye un plan/).elementHandle());
  await shot(page, 'planner-top', { fullPage: false });

  // NEIVA
  await page.goto('https://via-nova-ia.vercel.app/que-hacer-en-neiva', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 4000);
  await elementShot(page, 'neiva-hero', await sectionByHeading(page, /Qué hacer en Neiva/).elementHandle());
  await elementShot(page, 'neiva-tatacoa', await sectionByHeading(page, /Desierto de la Tatacoa/).elementHandle());
  await elementShot(page, 'neiva-rivera', await sectionByHeading(page, /Rivera, termales/).elementHandle());
  await elementShot(page, 'neiva-itinerary', await sectionByHeading(page, /Itinerario de 4 días/).elementHandle());
  await shot(page, 'neiva-top', { fullPage: false });

  await ctx.close();
}

async function runMobile() {
  const { ctx, page } = await open(390, 844, 3);
  await page.goto('https://via-nova-ia.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 5000);
  await shot(page, 'm-home-hero', { fullPage: false });
  await shot(page, 'm-home-catalog', { fullPage: true, clip: { x: 0, y: 780, width: 390, height: 900 } });

  await page.goto('https://via-nova-ia.vercel.app/planificador-viajes-ia', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 4000);
  await shot(page, 'm-planner-hero', { fullPage: false });

  await page.goto('https://via-nova-ia.vercel.app/que-hacer-en-neiva', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(page, 4000);
  await shot(page, 'm-neiva-hero', { fullPage: false });

  await ctx.close();
}

await runDesktop();
await runMobile();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
console.log('DONE', manifest.length);
