import { chromium } from 'playwright';

const BASE = 'http://localhost:8081';
const OUT = '/out';
const VIEWPORT = { width: 375, height: 812 };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
});
// The app's SyncProvider navigates to /settings on mount when no server
// URL is configured (useSync buildClient → null). Point it at a dead port
// so sync fails silently instead of hijacking the screenshot route.
await context.addInitScript(() => {
  try {
    localStorage.setItem('pawly.serverUrl', 'http://127.0.0.1:65534');
  } catch {
    // storage unavailable
  }
});
const page = await context.newPage();
page.setDefaultTimeout(240000);
page.setDefaultNavigationTimeout(300000);

const shots = [];

// Waits until an element matching `text` is attached and at least one
// match has a non-zero bounding box (i.e. actually rendered on screen —
// the app renders hidden SSR/hydration duplicates of some screens), then
// settles so mount transitions / fonts finish.
async function waitForScreen(label, text) {
  const locator = page.getByText(text);
  try {
    await locator.first().waitFor({ state: 'attached', timeout: 240000 });
    const started = Date.now();
    while (Date.now() - started < 240000) {
      const sizes = await locator
        .evaluateAll((ns) =>
          ns.map((n) => {
            const r = n.getBoundingClientRect();
            return r.width * r.height;
          })
        )
        .catch(() => []);
      if (sizes.some((s) => s > 0)) {
        await page.waitForTimeout(3000);
        return;
      }
      await page.waitForTimeout(1500);
    }
    throw new Error('no rendered match found');
  } catch (e) {
    throw new Error(`screen not ready: ${label} (${e.message})`);
  }
}

async function shot(label, path, waitText) {
  console.log(`capture: ${label} → ${path}`);
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await waitForScreen(label, waitText);
  const file = `${OUT}/${label}.png`;
  await page.screenshot({ path: file, animations: 'disabled' });
  shots.push(file);
  console.log(`  wrote ${file}`);
}

async function verifyShot(file, label) {
  const { access, stat } = await import('node:fs/promises');
  const st = await stat(file);
  console.log(`  ${label}: ${st.size} bytes`);
  if (st.size < 15000) {
    console.warn(`  WARN: ${label} looks suspiciously small — may be blank`);
  }
}

try {
  // 1. Fresh install — the empty home state (no pets yet).
  console.log('capture: 00-home-empty');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await waitForScreen('home-empty', 'Tambahkan hewan pertamamu');
  await page.screenshot({ path: `${OUT}/00-home-empty.png`, animations: 'disabled' });
  shots.push(`${OUT}/00-home-empty.png`);

  // 2. Seed the demo data (status text is hardcoded English).
  console.log('capture: seed');
  await page.goto(`${BASE}/seed`, { waitUntil: 'domcontentloaded' });
  await waitForScreen('seed', 'Sample data ready');
  await page.screenshot({ path: `${OUT}/10-seed.png`, animations: 'disabled' });
  shots.push(`${OUT}/10-seed.png`);

  // 3. Home with data.
  await shot('01-home', '/', 'Miko');

  // 4. Tabs.
  await shot('02-journal', '/journal', 'Breakfast');
  await shot('03-health', '/health', 'Rabies');
  await shot('04-memories', '/memories', 'Favorit');

  // 5. Forms.
  await shot('05-entry-form', '/entry-form', 'Jenis');
  await shot('06-pet-form', '/pet-form', 'Detail hewan');
  await shot('07-reminder-form', '/reminder-form', 'Pengingat');

  // 6. Settings and the vet prep report.
  await shot('08-settings', '/settings', 'Alamat server');
  await shot('09-vet-report', '/vet-report', /Laporan persiapan dokter/);

  console.log(`\nDONE — ${shots.length} screenshots:`);
  for (const s of shots) {
    await verifyShot(s, s.split('/').pop());
  }
} finally {
  await browser.close();
}
