// Local Chrome/CDP + Node built-ins: no Playwright dependency and no production API.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const output = path.resolve("_capture-verification/sphere");
await mkdir(output, { recursive: true });
const profile = path.join(output, `chrome-${Date.now()}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5055", "--strictPort"], { windowsHide: true, stdio: "ignore" });
let chrome, socket;
const report = { checks: [], screenshots: [], pageErrors: [] };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5055/sphere-lab.html')).ok) break; } catch {} await sleep(100); }
  chrome = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  let port;
  for (let i = 0; i < 150; i++) { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), 'utf8')).split('\n')[0]; break; } catch {} await sleep(100); }
  if (!port) throw new Error('Chrome no abrió CDP.');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0, sessionId; const pending = new Map();
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) { const p = pending.get(data.id); if (p) { pending.delete(data.id); data.error ? p.reject(new Error(JSON.stringify(data.error))) : p.resolve(data.result); } }
    if (data.method === 'Runtime.exceptionThrown') report.pageErrors.push(data.params.exceptionDetails.text + ': ' + (data.params.exceptionDetails.exception?.description ?? ''));
  };
  const send = (method, params = {}, scoped = true) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(scoped && sessionId ? { sessionId } : {}) }));
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, false);
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, timeout = 20_000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) { try { const result = await evaluate(`(() => { const value = (${expression}); return typeof value === 'object' ? !!value : value; })()`); if (result) return result; } catch {} await sleep(100); }
    report.lastDocument = await evaluate(`({url: location.href, state: document.readyState, text: document.body.innerText.slice(0,1500), scripts: [...document.scripts].map(s=>s.src)})`);
    throw new Error(`Tiempo agotado: ${expression}; ${JSON.stringify(report.lastDocument)}`);
  };
  const navigate = async (surface, theme, width, pitch = 0) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:5055/sphere-lab.html?surface=${surface}&theme=${theme}&pitch=${pitch}&case=${Date.now()}` });
    await until(`document.querySelector('h1')?.textContent.includes('Laboratorio')`);
    if (surface === 'viewer') await until(`Math.abs(Number(document.querySelector('canvas[aria-label]')?.dataset.pitch) - (${pitch})) < 0.05`);
    await sleep(100);
  };
  const screenshot = async name => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, name), Buffer.from(data, 'base64')); report.screenshots.push(name);
  };
  for (const theme of ['light', 'dark', 'sunset', 'ocean', 'forest']) for (const width of [360, 768, 1440]) for (const surface of ['viewer', 'capture', 'identity']) {
    await navigate(surface, theme, width);
    const measurement = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth, buttons: [...document.querySelectorAll('button')].every(b => b.getBoundingClientRect().height >= 24), bodyColor: getComputedStyle(document.querySelector('main')).color, background: getComputedStyle(document.querySelector('main')).backgroundColor })`);
    assert.equal(measurement.overflow, false, `${surface}/${theme}/${width}: overflow`); assert.equal(measurement.buttons, true);
    report.checks.push({ surface, theme, width, ...measurement });
  }
  console.info(`UI: ${report.checks.length} combinaciones verificadas.`);
  for (const pitch of [-90, 0, 90]) { await navigate('viewer', 'dark', 768, pitch); await screenshot(`pitch-${pitch}.png`); }
  report.worker = await evaluate('window.sphereWorkerProof()');
  assert.ok(report.worker.coverage > 99.9); assert.equal(report.worker.width, report.worker.height * 2);
  assert.ok(report.worker.zenith[0] > 200 && report.worker.zenith[2] < 80); assert.ok(report.worker.nadir[2] > 200 && report.worker.nadir[0] < 80);
  console.info('Worker:', JSON.stringify(report.worker));
  await navigate('capture', 'light', 360);
  await evaluate(`document.querySelector('select').value = '2048'; document.querySelector('select').dispatchEvent(new Event('change', {bubbles:true})); [...document.querySelectorAll('button')].find(b => b.textContent.includes('Activar cámara')).click()`);
  await until(`document.querySelector('progress')`);
  await evaluate(`const check = document.querySelector('input[type=checkbox]'); if (!check.checked) check.click();`);
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Capturar posición' && !b.disabled)`);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Capturar posición').click()`);
  await until(`Number(document.querySelector('progress')?.value) > 0`, 45_000);
  await screenshot('capture-partial-360.png');
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Guardar')).click()`);
  report.capture = JSON.parse(await until(`document.querySelector('#capture-result')?.textContent`, 45_000));
  assert.equal(report.capture.width, report.capture.height * 2); assert.ok(report.capture.coverage > 0 && report.capture.coverage < 100);
  report.cameraReleased = await evaluate(`document.querySelector('video').srcObject.getTracks().every(t => t.readyState === 'ended')`);
  assert.equal(report.cameraReleased, true); assert.deepEqual(report.pageErrors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.info('Captura:', JSON.stringify(report.capture), 'Cámara liberada:', report.cameraReleased);
} catch (error) {
  report.error = error.message; await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); throw error;
} finally { socket?.close(); chrome?.kill(); vite.kill(); }
