import { chromium } from 'playwright';

const BASE = 'http://localhost:8081';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
});
const page = await context.newPage();
page.setDefaultTimeout(120000);

const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 300)}`));
page.on('requestfailed', (r) =>
  logs.push(`[reqfail] ${r.url().slice(0, 150)} ${r.failure()?.errorText}`)
);
page.on('framenavigated', (f) => logs.push(`[navigated] ${f.url()}`));

await page.goto(`${BASE}/seed`, { waitUntil: 'domcontentloaded' });
for (const t of [10000, 20000, 35000]) {
  await page.waitForTimeout(t === 10000 ? 10000 : t - (t === 20000 ? 10000 : 20000));
  const state = await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    keys: Object.keys(localStorage),
    hasRoot: !!document.getElementById('root'),
    rootKids: document.getElementById('root')?.children.length ?? 0,
  }));
  console.log(`\n--- after ${t / 1000}s ---`);
  console.log(JSON.stringify(state));
  console.log('body text:', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));
}
console.log('\n=== LOGS (last 30) ===');
console.log(logs.slice(-30).join('\n'));
await browser.close();
