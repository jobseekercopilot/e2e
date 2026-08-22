import { expect, test } from '@playwright/test';
import { DemoDirector } from '../support/demo-director';

test('focus target resolves to an Angular component host', async ({ page }) => {
  const director = new DemoDirector({ enabled: true, focusPaddingPx: 20 });
  await page.setContent(`
    <app-job-card data-demo-focus="app-job-card" data-demo-focus-id="hero-job" style="display:block; margin: 120px; width: 320px; height: 180px; border-radius: 12px">
      <button>Generate CV & Cover Letter</button>
    </app-job-card>
  `);

  await director.spotlight(page.getByRole('button', { name: /generate/i }));

  const targetHasClass = await page.locator('[data-demo-focus-id="hero-job"]').evaluate(element => element.classList.contains('promo-demo-spotlight-target'));
  expect(targetHasClass).toBe(true);
});

test('button-only focus is rejected when component metadata is missing', async ({ page }) => {
  const director = new DemoDirector({ enabled: true });
  await page.setContent('<button style="margin: 120px">Generate</button>');

  await expect(director.spotlight(page.getByRole('button', { name: 'Generate' })))
    .rejects
    .toThrow('Demo focus component could not be resolved.');
});

test('mask opening matches the component rectangle with fixed padding', async ({ page }) => {
  const director = new DemoDirector({ enabled: true, focusPaddingPx: 22 });
  await page.setContent(`
    <app-generated-documents data-demo-focus="generated-documents" data-demo-focus-id="hero-generated-documents"
      style="display:block; margin-left: 180px; margin-top: 140px; width: 360px; height: 160px; border-radius: 10px"></app-generated-documents>
  `);

  await director.spotlightComponent(page, 'hero-generated-documents');

  const geometry = await page.evaluate(() => {
    const target = document.querySelector('[data-demo-focus-id="hero-generated-documents"]') as HTMLElement;
    const hole = document.querySelector('.promo-mask-hole') as SVGRectElement;
    const rect = target.getBoundingClientRect();
    return {
      expectedX: rect.left - 22,
      expectedY: rect.top - 22,
      expectedWidth: rect.width + 44,
      expectedHeight: rect.height + 44,
      actualX: Number(hole.getAttribute('x')),
      actualY: Number(hole.getAttribute('y')),
      actualWidth: Number(hole.getAttribute('width')),
      actualHeight: Number(hole.getAttribute('height'))
    };
  });

  expect(geometry.actualX).toBeCloseTo(geometry.expectedX, 0);
  expect(geometry.actualY).toBeCloseTo(geometry.expectedY, 0);
  expect(geometry.actualWidth).toBeCloseTo(geometry.expectedWidth, 0);
  expect(geometry.actualHeight).toBeCloseTo(geometry.expectedHeight, 0);
});

test('related CDK-style overlay is included in focus geometry', async ({ page }) => {
  const director = new DemoDirector({ enabled: true, focusPaddingPx: 16 });
  await page.setContent(`
    <app-my-applications data-demo-focus="application-card" data-demo-focus-id="application-hero" data-demo-focus-group="application-status-hero"
      style="display:block; position:absolute; left: 80px; top: 100px; width: 260px; height: 120px; border-radius: 10px">
      <button aria-controls="status-menu">Status</button>
    </app-my-applications>
    <div class="cdk-overlay-container">
      <div id="status-menu" data-demo-focus-group="application-status-hero" role="menu"
        style="position:absolute; left: 420px; top: 150px; width: 220px; height: 140px">Offer</div>
    </div>
  `);

  await director.spotlightComponent(page, 'application-hero');

  const right = await page.evaluate(() => {
    const hole = document.querySelector('.promo-mask-hole') as SVGRectElement;
    return Number(hole.getAttribute('x')) + Number(hole.getAttribute('width'));
  });
  expect(right).toBeGreaterThanOrEqual(656);
});

test('ResizeObserver updates focus geometry and cleanup removes observers', async ({ page }) => {
  const director = new DemoDirector({ enabled: true, focusPaddingPx: 18 });
  await page.setContent(`
    <app-documents-workspace data-demo-focus="documents-workspace" data-demo-focus-id="documents-workspace"
      style="display:block; margin: 120px; width: 260px; height: 120px"></app-documents-workspace>
  `);

  await director.spotlightComponent(page, 'documents-workspace');
  const firstWidth = await page.evaluate(() => Number(document.querySelector('.promo-mask-hole')?.getAttribute('width')));
  await page.locator('[data-demo-focus-id="documents-workspace"]').evaluate((element: HTMLElement) => {
    element.style.width = '420px';
  });

  await expect.poll(() => page.evaluate(() => Number(document.querySelector('.promo-mask-hole')?.getAttribute('width'))))
    .toBeGreaterThan(firstWidth + 120);

  await director.clear(page);
  await expect.poll(() => page.evaluate(() => window.__promoDemoFocusCleanup)).toBeUndefined();
  await expect(page.locator('#promo-demo-focus-overlay')).toHaveCount(0, { timeout: 1000 });
});
