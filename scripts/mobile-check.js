const { chromium } = require('playwright-core');
const path = require('node:path');

const OUT = path.join(__dirname, '..', '.verification');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  page.on('console', message => {
    if (message.type() === 'error') console.log('[console.error]', message.text());
  });
  page.on('pageerror', error => console.log('[pageerror]', error.message));

  await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [];
    const vw = window.innerWidth;
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > vw + 1) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' && rect.right <= vw + 1) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          id: el.id,
          cls: String(el.className).slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        });
      }
    }
    return {
      innerWidth: vw,
      scrollWidth: doc.scrollWidth,
      bodyWidth: document.body.getBoundingClientRect().width,
      offenders: offenders.slice(0, 15)
    };
  });
  console.log(JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: path.join(OUT, 'phone-home.png') });
  console.log('saved phone-home.png');
  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});