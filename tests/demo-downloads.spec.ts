import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applicationDocumentFixtures } from '../support/application-document-fixtures';
import { renderDownloadedPdfPreview } from '../support/demo-downloads';

test('renders actual PDF pages into the recordable browser surface', async ({ page }) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jsc-demo-preview-test-'));
  try {
    const fixture = applicationDocumentFixtures().substantialMultiPagePdf;
    const pdfPath = path.join(directory, fixture.name);
    await fs.writeFile(pdfPath, fixture.bytes);

    const pageCount = await renderDownloadedPdfPreview(
      page,
      pdfPath,
      'Synthetic tailored CV'
    );

    expect(pageCount).toBe(2);
    await expect(page.getByText('Generated document preview')).toBeVisible();
    await expect(page.locator('article.document-page')).toHaveCount(2);
    await expect(page.locator('article.document-page').first().locator('img'))
      .toHaveAttribute('src', /^data:image\/png;base64,/);
    expect(await page.locator('article.document-page').first().locator('img').evaluate(
      image => (image as HTMLImageElement).naturalWidth
    )).toBeGreaterThan(500);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
