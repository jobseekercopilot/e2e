import { expect, test } from '@playwright/test';
import { PromotionalCursor } from '../support/demo-cursor';

test('installs the promotional cursor overlay when enabled', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent('<button>Generate Documents</button>');

  await cursor.install(page);

  await expect(page.locator('#promo-demo-cursor')).toBeVisible();
  await expect(page.locator('#promo-demo-cursor .promo-cursor-pointer')).toBeVisible();
  await expect(page.locator('#promo-demo-cursor .promo-cursor-pointer')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
});

test('moves the visible cursor to a target element', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent('<button style="margin: 160px 0 0 220px; width: 180px; height: 48px">Download PDF</button>');
  const button = page.getByRole('button', { name: 'Download PDF' });

  await cursor.install(page);
  await cursor.moveTo(button, { durationMs: 80 });

  const transform = await page.locator('#promo-demo-cursor').evaluate((element) => getComputedStyle(element).transform);
  expect(transform).not.toContain('96');
});

test('visual cursor follows real mousemove events', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent('<main style="min-height: 400px"></main>');

  await cursor.install(page);
  await page.mouse.move(321, 222);

  await expect.poll(() => page.evaluate(() => window.__promoDemoCursor?.point())).toEqual({ x: 321, y: 222 });
});

test('real mouse and visual cursor use identical coordinates', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent(`
    <button style="margin: 140px 0 0 240px; width: 180px; height: 48px">Download PDF</button>
    <script>
      window.mouseMoves = [];
      window.addEventListener('mousemove', event => window.mouseMoves.push({ x: event.clientX, y: event.clientY }));
    </script>
  `);

  await cursor.install(page);
  await cursor.moveTo(page.getByRole('button', { name: 'Download PDF' }), { durationMs: 90 });

  const browserPoint = await page.evaluate(() => window.__promoDemoCursor?.point());
  const lastMouseMove = await page.evaluate(() => window.mouseMoves.at(-1));
  expect(browserPoint).toEqual(lastMouseMove);
});

test('animates clicks without blocking the underlying action', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent(`
    <button style="margin: 120px; width: 160px; height: 48px" onclick="window.clicked = true">Download PDF</button>
  `);

  await cursor.install(page);
  await cursor.click(page.getByRole('button', { name: 'Download PDF' }));

  await expect.poll(() => page.evaluate(() => window.clicked)).toBe(true);
  await expect(page.locator('.promo-cursor-ring')).toHaveCount(0, { timeout: 1000 });
});

test('does not teleport after click', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent(`
    <button style="margin: 110px 0 0 180px; width: 140px; height: 44px" onclick="window.clicked = true">First</button>
    <button style="margin: 260px 0 0 420px; width: 140px; height: 44px">Second</button>
  `);

  await cursor.install(page);
  await cursor.click(page.getByRole('button', { name: 'First' }));
  const afterClick = await cursor.currentPosition(page);
  await cursor.moveTo(page.getByRole('button', { name: 'Second' }), { durationMs: 90 });

  expect(afterClick.x).toBeGreaterThan(180);
  expect(afterClick.y).toBeGreaterThan(110);
  expect(afterClick).not.toEqual({ x: 96, y: 96 });
});

test('keeps the translated cursor wrapper anchored during click animation', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent('<main style="min-height: 400px"></main>');

  await cursor.install(page);
  await cursor.moveToPoint(page, { x: 300, y: 220 }, 40);

  const before = await page.locator('#promo-demo-cursor').evaluate((element) => ({
    scale: getComputedStyle(element).getPropertyValue('scale'),
    transform: getComputedStyle(element).transform
  }));

  await page.evaluate(() => window.__promoDemoCursor?.click(300, 220));
  await page.waitForTimeout(20);

  const during = await page.locator('#promo-demo-cursor').evaluate((element) => ({
    scale: getComputedStyle(element).getPropertyValue('scale'),
    transform: getComputedStyle(element).transform,
    pointerTransform: getComputedStyle(element.querySelector('.promo-cursor-pointer') as HTMLElement).transform
  }));

  expect(during.transform).toBe(before.transform);
  expect(during.scale.trim()).not.toBe('0.9');
  expect(during.pointerTransform).not.toBe('none');
});

test('uses normal locator clicks when disabled', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: false });
  await page.setContent('<button onclick="window.clicked = true">Download PDF</button>');

  await cursor.install(page);
  await cursor.click(page.getByRole('button', { name: 'Download PDF' }));

  await expect(page.locator('#promo-demo-cursor')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.clicked)).toBe(true);
});

test('reinjects the cursor after navigation', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent('<button>First page</button>');
  await cursor.install(page);
  await cursor.moveToPoint(page, { x: 340, y: 210 }, 40);

  await page.goto('data:text/html,<button style="margin:80px">Second page</button>');
  await cursor.moveTo(page.getByRole('button', { name: 'Second page' }), { durationMs: 80 });

  await expect(page.locator('#promo-demo-cursor')).toBeVisible();
  const point = await cursor.currentPosition(page);
  expect(point).not.toEqual({ x: 96, y: 96 });
});

test('fails instead of auto-scrolling off-screen recording targets', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent('<button style="margin-top: 1600px">Hidden Download</button>');
  await cursor.install(page);

  await expect(cursor.click(page.getByRole('button', { name: 'Hidden Download' })))
    .rejects
    .toThrow(/outside the viewport/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('raises the promotional cursor inside an active modal overlay', async ({ page }) => {
  const cursor = new PromotionalCursor({ enabled: true });
  await page.setContent(`
    <div class="cdk-overlay-container">
      <div id="active-overlay" class="cdk-overlay-popover" popover="manual">
        <div class="cdk-overlay-backdrop"></div>
        <section id="experience-evidence-dialog">Experience and achievements</section>
      </div>
    </div>
  `);
  await page.locator('#active-overlay').evaluate(element => (element as HTMLElement).showPopover());
  const dialog = page.locator('#experience-evidence-dialog');

  await cursor.install(page);
  await cursor.raiseAboveOverlay(dialog);

  await expect(page.locator('.cdk-overlay-popover:popover-open > #promo-demo-cursor')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__promoDemoCursor?.point()))
    .toEqual(await cursor.currentPosition(page));

  await page.locator('#active-overlay').evaluate(element => (element as HTMLElement).hidePopover());
  await cursor.restore(page);

  await expect(page.locator('html > #promo-demo-cursor')).toBeVisible();
});

declare global {
  interface Window {
    clicked?: boolean;
    mouseMoves: { x: number; y: number }[];
  }
}
