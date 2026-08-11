import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, type Download, type Page } from '@playwright/test';
import { e2eConfig } from './config';
import { demoCursor } from './demo-cursor';

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

  const buffer = await fs.readFile(filePath);
  const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
  const preview = await page.context().newPage();
  await demoCursor.install(preview);
  await preview.setViewportSize(page.viewportSize() ?? { width: 1920, height: 1080 });
  await preview.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { margin: 0; background: #f8fafc; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          header { height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 28px; border-bottom: 1px solid #dbe3ef; background: white; box-sizing: border-box; }
          strong { color: #2563eb; }
          iframe { display: block; width: 100vw; height: calc(100vh - 64px); border: 0; background: white; }
        </style>
      </head>
      <body>
        <header><strong>Document preview</strong><span>${escapeHtml(title)}</span></header>
        <iframe title="${escapeHtml(title)}" src="${dataUrl}"></iframe>
      </body>
    </html>
  `);
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

  const buffer = await fs.readFile(filePath);
  const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { margin: 0; background: #e2e8f0; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          header { height: 72px; display: flex; align-items: center; gap: 14px; padding: 0 32px; border-bottom: 1px solid #cbd5e1; background: white; box-sizing: border-box; }
          strong { color: #2563eb; font-size: 18px; }
          span { color: #334155; font-weight: 650; }
          iframe { display: block; width: 100vw; height: calc(100vh - 72px); border: 0; background: white; }
        </style>
      </head>
      <body>
        <header><strong>Generated document preview</strong><span>${escapeHtml(title)}</span></header>
        <iframe title="${escapeHtml(title)}" src="${dataUrl}"></iframe>
      </body>
    </html>
  `);
  await page.waitForTimeout(durationMs);
  await page.goto(returnUrl);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
