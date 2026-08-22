import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, type Download, type Locator, type Page } from '@playwright/test';
import { e2eConfig } from './config';
import { demoCursor } from './demo-cursor';

const execFileAsync = promisify(execFile);

export interface SavedDemoDownload {
  path: string;
  filename: string;
  size: number;
}

export function demoDownloadDirectory(): string {
  return path.isAbsolute(e2eConfig.demoDownloadDir)
    ? e2eConfig.demoDownloadDir
    : path.resolve(__dirname, '..', '..', '..', e2eConfig.demoDownloadDir);
}

export async function saveDemoDownload(download: Download, preferredBaseName: string): Promise<SavedDemoDownload> {
  const suggested = download.suggestedFilename();
  const extension = path.extname(suggested) || '.pdf';
  const filename = `${preferredBaseName}${extension}`.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const outputDir = demoDownloadDirectory();
  const outputPath = path.join(outputDir, filename);

  await fs.mkdir(outputDir, { recursive: true });
  await download.saveAs(outputPath);
  const stat = await fs.stat(outputPath);
  expect(stat.size).toBeGreaterThan(0);

  return {
    path: outputPath,
    filename,
    size: stat.size
  };
}

export async function previewDownloadedPdf(page: Page, filePath: string, title: string, durationMs: number): Promise<void> {
  if (path.extname(filePath).toLowerCase() !== '.pdf') return;

  const preview = await page.context().newPage();
  await demoCursor.install(preview);
  await preview.setViewportSize(page.viewportSize() ?? { width: 1920, height: 1080 });
  await renderDownloadedPdfPreview(preview, filePath, title);
  await preview.waitForTimeout(Math.min(durationMs, 1600));
  const viewport = preview.viewportSize() ?? { width: 1920, height: 1080 };
  await Promise.all([
    preview.evaluate(() => new Promise<void>((resolve) => {
      const startY = window.scrollY;
      const targetY = Math.min(document.documentElement.scrollHeight - window.innerHeight, startY + 420);
      const deltaY = targetY - startY;
      const startTime = performance.now();
      const durationMs = 620;
      const easeInOut = (progress: number): number => (
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2
      );
      const step = (now: number): void => {
        const progress = Math.min((now - startTime) / durationMs, 1);
        window.scrollTo(0, startY + deltaY * easeInOut(progress));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      window.requestAnimationFrame(step);
    })),
    demoCursor.moveToPoint(preview, { x: viewport.width - 94, y: viewport.height - 96 }, 620)
  ]);
  await preview.waitForTimeout(Math.max(durationMs - 1600, 900));
  await preview.close();
}

export async function previewDownloadedPdfInPlace(
  page: Page,
  filePath: string,
  title: string,
  durationMs: number,
  returnUrl = '/dashboard'
): Promise<void> {
  if (path.extname(filePath).toLowerCase() !== '.pdf') return;

  const pageCount = await renderDownloadedPdfPreview(page, filePath, title);
  await demoCursor.restore(page);
  await page.waitForTimeout(Math.min(durationMs, 1800));
  if (pageCount > 1) {
    const secondPage = page.locator('article.document-page').nth(1);
    await Promise.all([
      smoothScrollTo(page, secondPage),
      demoCursor.park(page)
    ]);
  }
  await page.waitForTimeout(Math.max(durationMs - 1800, 1500));
  await page.goto(returnUrl);
}

export async function renderDownloadedPdfPreview(
  page: Page,
  filePath: string,
  title: string
): Promise<number> {
  const pageImages = await rasterizePdf(filePath);
  const pages = pageImages.map((dataUrl, index) => `
    <article class="document-page" aria-label="Page ${index + 1} of ${pageImages.length}">
      <div class="page-label">Page ${index + 1} of ${pageImages.length}</div>
      <img src="${dataUrl}" alt="Rendered ${escapeHtml(title)}, page ${index + 1}" />
    </article>
  `).join('');
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          html { scroll-behavior: auto; }
          body { margin: 0; background: #dfe7f1; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          header { position: sticky; top: 0; z-index: 2; height: 72px; display: flex; align-items: center; gap: 14px; padding: 0 32px; border-bottom: 1px solid #cbd5e1; background: rgba(255,255,255,.98); box-shadow: 0 4px 18px rgba(15,23,42,.08); }
          header strong { color: #2563eb; font-size: 18px; }
          header span { color: #334155; font-weight: 650; }
          main { display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 28px 32px 52px; }
          .document-page { position: relative; width: min(760px, calc(100vw - 120px)); background: white; box-shadow: 0 12px 42px rgba(15,23,42,.18); }
          .document-page img { display: block; width: 100%; height: auto; }
          .page-label { position: absolute; right: 14px; top: 14px; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.78); color: white; font-size: 12px; font-weight: 700; }
        </style>
      </head>
      <body>
        <header><strong>Generated document preview</strong><span>${escapeHtml(title)}</span></header>
        <main>${pages}</main>
      </body>
    </html>
  `);
  await expect(page.locator('article.document-page')).toHaveCount(pageImages.length);
  await expect(page.locator('article.document-page').first().locator('img')).toBeVisible();
  return pageImages.length;
}

async function rasterizePdf(filePath: string): Promise<string[]> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'jsc-demo-pdf-preview-'));
  try {
    const outputPrefix = path.join(temporaryDirectory, 'page');
    await execFileAsync('pdftoppm', [
      '-png', '-r', '120', '-f', '1', '-l', '2', filePath, outputPrefix
    ], { maxBuffer: 16 * 1024 * 1024 });
    const rendered = (await fs.readdir(temporaryDirectory))
      .filter(name => /^page-\d+\.png$/.test(name))
      .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
    if (rendered.length === 0) {
      throw new Error('The generated PDF produced no visible preview pages.');
    }
    return await Promise.all(rendered.map(async name => {
      const image = await fs.readFile(path.join(temporaryDirectory, name));
      if (image.length < 1024) throw new Error(`Rendered PDF page ${name} was unexpectedly small.`);
      return `data:image/png;base64,${image.toString('base64')}`;
    }));
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function smoothScrollTo(page: Page, locator: Locator): Promise<void> {
  await locator.evaluate((element) => new Promise<void>((resolve) => {
    const startY = window.scrollY;
    const targetY = Math.max(0, element.getBoundingClientRect().top + startY - 104);
    const deltaY = targetY - startY;
    const startTime = performance.now();
    const durationMs = 820;
    const step = (now: number): void => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      window.scrollTo(0, startY + deltaY * eased);
      if (progress < 1) window.requestAnimationFrame(step);
      else resolve();
    };
    window.requestAnimationFrame(step);
  }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
