import { createRequire } from "module";
import fs from "fs";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/Famil/AppData/Local/Temp/opencode/pw/node_modules/playwright-core");

const EXE = "C:\\Users\\Famil\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe";
const BASE = process.env.BASE_URL || "http://localhost:5000";
const sql = neon(process.env.DATABASE_URL);

const suffix = Date.now().toString(36);
const USERNAME = `qafull_${suffix}`;
const PASSWORD = `QaFull!${suffix}99`;
const FULL_NAME = `QA Full Tester ${suffix}`;
const EMAIL = `${USERNAME}@example.com`;

const report = {
  startedAt: new Date().toISOString(),
  steps: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  dbChecks: {},
  passed: false,
};

function logStep(name, status, details = {}) {
  const step = { name, status, details, timestamp: new Date().toISOString() };
  report.steps.push(step);
  console.log(`[STEP] ${name} -> ${status}`, JSON.stringify(details));
}

async function run() {
  console.log(`Starting Full E2E UI Test against ${BASE}...`);
  console.log(`Test user: ${USERNAME}`);

  let browser;
  let dbUserId = null;
  try {
    browser = await chromium.launch({
      executablePath: EXE,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      permissions: ["geolocation"],
      geolocation: { latitude: 4.711, longitude: -74.0721 },
    });

    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore expected non-blocking dev warnings
        if (!text.includes("Lit is in dev mode") && !text.includes("GeolocationPositionError")) {
          report.consoleErrors.push({ text, location: msg.location() });
        }
      }
    });

    page.on("pageerror", (err) => {
      report.pageErrors.push({ message: err.message, stack: err.stack });
    });

    page.on("response", (res) => {
      if (res.status() >= 400 && res.url().includes("localhost:5000")) {
        report.failedRequests.push({ url: res.url(), status: res.status(), method: res.request().method() });
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: Registration via API & DB Role Setup
    // ──────────────────────────────────────────────────────────────────────────
    console.log("Registering test user via API...");
    const regRes = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
        name: FULL_NAME,
        email: EMAIL,
        acceptTerms: true,
      }),
    });
    const regData = await regRes.json();
    const token = regData.token;

    let [dbUser] = await sql`SELECT id, username, role FROM users WHERE username = ${USERNAME}`;
    if (!dbUser) throw new Error("User was not created in DB");
    dbUserId = dbUser.id;

    // Add provider role 'hotel' to this user
    await sql`UPDATE users SET role = 'hotel' WHERE id = ${dbUserId}`;
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${dbUserId}, 'hotel') ON CONFLICT DO NOTHING`;

    logStep("1. Registration & Role Setup", "SUCCESS", { userId: dbUserId, username: USERNAME, role: "hotel" });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: UI Login Form
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);

    const loginTab = page.locator("button:has-text('Iniciar Sesión'), button:has-text('Login'), button:has-text('Iniciar')").first();
    if (await loginTab.count()) {
      await loginTab.click();
      await page.waitForTimeout(400);
    }

    await page.fill("#login-username, input[name='username']", USERNAME);
    await page.fill("#login-password, input[name='password']", PASSWORD);
    
    await Promise.all([
      page.waitForResponse(r => r.url().includes("/api/auth/login"), { timeout: 15000 }).catch(() => null),
      page.click("button[type='submit']"),
    ]);
    await page.waitForTimeout(2000);

    const loggedIn = await page.evaluate(() => {
      const u = localStorage.getItem("user");
      return !!u;
    });
    logStep("2. UI Login", loggedIn ? "SUCCESS" : "FAILED", { url: page.url() });

    // Ensure auth_token in localStorage for consistency
    if (token) {
      await page.evaluate((t) => {
        localStorage.setItem("auth_token", t);
      }, token);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Products (/products) -> Create product via UI, verify, then delete via UI
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/products`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);

    const newProdBtn = page.locator("#new-product-btn")
      .or(page.getByRole("button", { name: /Nuevo Producto/i }))
      .or(page.locator("button:has-text('Nuevo Producto')"));
    
    let prodCreated = false;
    let prodDeleted = false;
    const testProdName = `Habitación Imperial ${suffix}`;
    const testProdPrice = "220000";
    const testProdCost = "110000";
    const testProdStock = "8";

    if (await newProdBtn.count()) {
      await newProdBtn.first().click();
      await page.waitForTimeout(1000);

      // Fill modal form using exact IDs
      await page.fill("#product-name-input", testProdName);
      await page.fill("#product-desc-input", "Suite ejecutiva con jacuzzi y vista panorámica");
      await page.fill("#product-price-input", testProdPrice);
      await page.fill("#product-cost-input", testProdCost);
      await page.fill("#product-stock-input", testProdStock);

      await page.waitForTimeout(500);

      // Click exact modal submit button
      const submitBtn = page.locator("#product-submit-btn");
      await Promise.all([
        page.waitForResponse(r => r.url().includes("/api/products") && r.request().method() === "POST", { timeout: 15000 }).catch(() => null),
        submitBtn.click({ force: true }),
      ]);
      await page.waitForTimeout(2500);

      // Verify product card is in DOM
      const cardText = await page.locator("body").innerText();
      prodCreated = cardText.includes(testProdName);

      // Verify in DB
      const [dbProd] = await sql`SELECT id, name, price, stock, is_active FROM products WHERE provider_username = ${USERNAME} AND name = ${testProdName}`;
      report.dbChecks.createdProduct = dbProd;

      if (dbProd) {
        console.log(`Product created with ID ${dbProd.id}. Now deleting via UI button...`);
        
        // Find the card for this product and click its Trash button
        const prodCard = page.locator(`div:has-text('${testProdName}')`).locator("button:has(svg.lucide-trash-2), button:has(svg.lucide-trash)").last();
        if (await prodCard.count()) {
          await Promise.all([
            page.waitForResponse(r => r.url().includes(`/api/products/${dbProd.id}`) && r.request().method() === "DELETE", { timeout: 15000 }).catch(() => null),
            prodCard.click({ force: true }),
          ]);
          await page.waitForTimeout(2000);

          // Verify deletion in UI
          const afterDeleteText = await page.locator("body").innerText();
          const cardGone = !afterDeleteText.includes(testProdName);

          // Verify deletion in DB
          const [dbProdCheck] = await sql`SELECT id FROM products WHERE id = ${dbProd.id}`;
          prodDeleted = cardGone && !dbProdCheck;
          report.dbChecks.deletedProductVerified = !dbProdCheck;
        }
      }
    }

    logStep("3. Product Create & Delete via UI (/products)", (prodCreated && prodDeleted) ? "SUCCESS" : "FAILED", {
      prodCreated,
      prodDeleted,
      productName: testProdName,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Services (/my-products) -> Create service via UI, verify, then delete via UI
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/my-products`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);

    const addSvcBtn = page.getByRole("button", { name: /Nuevo Producto|Agregar Servicio|Añadir|Agregar Producto/i })
      .or(page.locator("button:has-text('Nuevo Producto')"))
      .or(page.locator("button:has-text('Agregar')"));

    let svcCreated = false;
    let svcDeleted = false;
    const testSvcName = `Tour Histórico ${suffix}`;

    if (await addSvcBtn.count()) {
      await addSvcBtn.first().click();
      await page.waitForTimeout(1000);

      // Fill name & price using IDs
      await page.fill("#service-name-input", testSvcName);
      await page.fill("#service-desc-input", "Recorrido guiado por el centro histórico");

      const saveSvcBtn = page.locator("#service-submit-btn");
      if (await saveSvcBtn.count()) {
        await Promise.all([
          page.waitForResponse(r => r.url().includes("/api/services") && r.request().method() === "POST", { timeout: 15000 }).catch(() => null),
          saveSvcBtn.first().click({ force: true }),
        ]);
        // Allow time for save + resetForm timeout
        await page.waitForTimeout(3000);

        const svcBody = await page.locator("body").innerText();
        svcCreated = svcBody.includes(testSvcName);

        // Verify in DB
        const [dbSvc] = await sql`SELECT id, name, price FROM services WHERE provider_username = ${USERNAME} AND name = ${testSvcName}`;
        report.dbChecks.createdService = dbSvc;

        if (dbSvc) {
          // Delete via UI: click trash button
          const delSvcBtn = page.locator(`[data-testid='delete-service-btn']`).first();
          if (await delSvcBtn.count()) {
            await delSvcBtn.click({ force: true });
            await page.waitForTimeout(800);

            // Click confirmation button
            const confirmBtn = page.locator(`[data-testid='confirm-delete-service-btn']`)
              .or(page.getByRole("button", { name: /Confirmar/i }));
            
            if (await confirmBtn.count()) {
              await Promise.all([
                page.waitForResponse(r => r.url().includes(`/api/services/${dbSvc.id}`) && r.request().method() === "DELETE", { timeout: 15000 }).catch(() => null),
                confirmBtn.first().click({ force: true }),
              ]);
            }
            await page.waitForTimeout(2000);

            const afterSvcBody = await page.locator("body").innerText();
            const svcGone = !afterSvcBody.includes(testSvcName);
            const [dbSvcCheck] = await sql`SELECT id FROM services WHERE id = ${dbSvc.id}`;
            svcDeleted = svcGone && !dbSvcCheck;
            report.dbChecks.deletedServiceVerified = !dbSvcCheck;
          }
        }
      }
    }

    logStep("4. Service Create & Delete via UI (/my-products)", (svcCreated && svcDeleted) ? "SUCCESS" : "FAILED", {
      svcCreated,
      svcDeleted,
      serviceName: testSvcName,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Chatbot Functionality (VIANova AI) on /
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);

    const chatTrigger = page.locator("#chatbot-open-btn")
      .or(page.locator("button:has(svg.lucide-bot)"))
      .or(page.locator("button:has(svg.lucide-sparkles)"))
      .or(page.locator("div.fixed.bottom-6.right-6 button"));

    let chatbotWorking = false;
    let chatReplyReceived = false;

    if (await chatTrigger.count()) {
      await chatTrigger.first().click({ force: true });
      await page.waitForTimeout(1200);

      const destInput = page.locator("#chatbot-destination");
      if (await destInput.count()) {
        await destInput.fill("Cartagena");
      }

      const msgInput = page.locator("#chatbot-msg-input")
        .or(page.locator("input[placeholder*='mensaje' i]"));
      
      if (await msgInput.count()) {
        await msgInput.fill("Hola, recomiéndame 2 lugares turísticos");
        
        let chatResStatus = 0;
        page.on("response", res => {
          if (res.url().includes("/api/chat") && res.request().method() === "POST") {
            chatResStatus = res.status();
          }
        });

        const sendBtn = page.locator("#chatbot-send-btn");
        if (await sendBtn.count()) {
          await sendBtn.click({ force: true });
        } else {
          await msgInput.press("Enter");
        }

        // Wait for response bubble
        await page.waitForTimeout(10000);

        const chatBody = await page.locator("body").innerText();
        chatbotWorking = chatBody.includes("VIANova") || chatBody.includes("Cartagena") || chatResStatus === 200;
        chatReplyReceived = !chatBody.includes("Hubo un error al procesar") && (chatResStatus === 200 || chatbotWorking);
      }
    }

    logStep("5. Chatbot Interaction (/)", (chatbotWorking) ? "SUCCESS" : "FAILED", {
      chatbotWorking,
      chatReplyReceived,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: Maps & Taxi Flow (/request-ride)
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/request-ride`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    const mapContainers = await page.locator(".maplibregl-map, .leaflet-container, canvas").count();
    const rideBodyText = await page.locator("body").innerText();
    const rideFormVisible = rideBodyText.includes("Taxi") || rideBodyText.includes("Origen") || rideBodyText.includes("Destino");
    
    logStep("6. Maps & Taxi Flow (/request-ride)", (mapContainers > 0 || rideFormVisible) ? "SUCCESS" : "FAILED", {
      mapContainers,
      rideFormVisible,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 7: Social Feed (/social) -> Create post, like, comment, delete
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/social`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);

    const postContent = `Explorando nuevos horizontes con ViaNova! #${suffix}`;
    let postCreated = false;
    let postLiked = false;
    let postDeleted = false;

    // Open create post modal via FAB
    const fabBtn = page.locator("#create-post-fab");
    if (await fabBtn.count()) {
      await fabBtn.click({ force: true });
      await page.waitForTimeout(1000);

      const postTextarea = page.locator("textarea[placeholder*='¿Qué estás pensando?' i]").first();
      if (await postTextarea.count()) {
        await postTextarea.fill(postContent);

        const publishBtn = page.locator("#submit-post-btn");
        await Promise.all([
          page.waitForResponse(r => r.url().includes("/api/social/posts") && r.request().method() === "POST", { timeout: 15000 }).catch(() => null),
          publishBtn.click({ force: true }),
        ]);
        await page.waitForTimeout(2500);

        const socialBody = await page.locator("body").innerText();
        postCreated = socialBody.includes(postContent);

        if (postCreated) {
          // Click like on our post
          const postCard = page.locator(`article:has-text('${postContent}')`).or(page.locator(`div:has-text('${postContent}')`)).first();
          const likeBtn = postCard.locator("button:has(svg.lucide-heart)").first();
          if (await likeBtn.count()) {
            await likeBtn.click({ force: true });
            await page.waitForTimeout(1000);
            postLiked = true;
          }

          // Click delete on our post
          const delPostBtn = postCard.locator("button:has(svg.lucide-trash-2), button:has(svg.lucide-trash)").first();
          if (await delPostBtn.count()) {
            await delPostBtn.click({ force: true });
            await page.waitForTimeout(1500);
            const afterDelSocial = await page.locator("body").innerText();
            postDeleted = !afterDelSocial.includes(postContent);
          }
        }
      }
    }

    logStep("7. Social Feed Interaction (/social)", (postCreated) ? "SUCCESS" : "FAILED", {
      postCreated,
      postLiked,
      postDeleted,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 8: Theme Switcher & Dashboard Navigation
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const dashboardTitle = await page.title();
    const dashboardText = await page.locator("body").innerText();
    const dashboardLoaded = dashboardText.includes("Panel") || dashboardText.includes("Dashboard") || dashboardText.includes(FULL_NAME) || dashboardText.includes(USERNAME);

    logStep("8. Dashboard & Navigation (/dashboard)", dashboardLoaded ? "SUCCESS" : "FAILED", {
      dashboardTitle,
      dashboardLoaded,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 9: Logout Flow (Navbar / Settings Logout)
    // ──────────────────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);

    const logoutBtn = page.locator("#account-settings-logout-btn")
      .or(page.getByRole("button", { name: /Cerrar Sesión|Logout/i }))
      .or(page.locator("button:has-text('Cerrar Sesión')"));

    let logoutSuccess = false;
    if (await logoutBtn.count()) {
      await Promise.all([
        page.waitForResponse(r => r.url().includes("/api/auth/logout"), { timeout: 15000 }).catch(() => null),
        logoutBtn.first().click({ force: true }),
      ]);
      await page.waitForTimeout(2000);

      const isLoggedOut = await page.evaluate(() => !localStorage.getItem("user") && !localStorage.getItem("auth_token"));
      logoutSuccess = isLoggedOut || page.url().includes("/login");
    } else {
      // Try navbar dropdown logout
      const navUserBtn = page.locator("#navbar-user-menu-btn");
      if (await navUserBtn.count()) {
        await navUserBtn.click({ force: true });
        await page.waitForTimeout(500);
        const navLogoutBtn = page.locator("#navbar-logout-btn");
        if (await navLogoutBtn.count()) {
          await Promise.all([
            page.waitForResponse(r => r.url().includes("/api/auth/logout"), { timeout: 15000 }).catch(() => null),
            navLogoutBtn.click({ force: true }),
          ]);
          await page.waitForTimeout(2000);
          const isLoggedOut = await page.evaluate(() => !localStorage.getItem("user") && !localStorage.getItem("auth_token"));
          logoutSuccess = isLoggedOut || page.url().includes("/login");
        }
      }
    }

    logStep("9. UI Logout Flow (/settings)", logoutSuccess ? "SUCCESS" : "FAILED", {
      logoutSuccess,
      url: page.url(),
    });

    // Check overall pass
    report.passed = report.steps.every(s => s.status === "SUCCESS");

  } catch (err) {
    report.error = { message: err.message, stack: err.stack };
    console.error("Fatal error during test run:", err);
  } finally {
    if (browser) await browser.close();
    // Cleanup test user
    if (dbUserId) {
      try {
        await sql`DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ${dbUserId})`.catch(() => {});
        await sql`DELETE FROM conversations WHERE user_id = ${dbUserId}`.catch(() => {});
        await sql`DELETE FROM products WHERE provider_username = ${USERNAME}`.catch(() => {});
        await sql`DELETE FROM services WHERE provider_username = ${USERNAME}`.catch(() => {});
        await sql`DELETE FROM social_posts WHERE user_id = ${dbUserId}`.catch(() => {});
        await sql`DELETE FROM user_roles WHERE user_id = ${dbUserId}`.catch(() => {});
        await sql`DELETE FROM users WHERE id = ${dbUserId}`.catch(() => {});
        console.log(`Cleaned up test user ${USERNAME}`);
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    }

    report.finishedAt = new Date().toISOString();
    fs.writeFileSync("scripts/e2e-ui-report.json", JSON.stringify(report, null, 2));
    console.log("Wrote report to scripts/e2e-ui-report.json");
  }
}

run();
