import { expect, type Page } from '@playwright/test';
import {
  previewDownloadedPdf,
  previewDownloadedPdfInPlace,
  saveDemoDownload,
  type SavedDemoDownload
} from '../support/demo-downloads';
import { demoCursor } from '../support/demo-cursor';
import { BasePage } from './base.page';

export class DocumentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.clickFramed(
      this.byTestId('workspace-tab-documents')
        .or(this.page.getByRole('button', { name: /documents|your cvs and cover letters/i }))
        .first()
    );
    await expect(this.byTestId('documents-workspace').or(this.page.getByRole('heading', { name: /your documents/i })).first()).toBeVisible();
  }

  async waitForDocuments(): Promise<boolean> {
    const documentCard = this.byTestId('document-card').or(this.page.getByText(/CV|Cover Letter|No documents match this view/i).first());
    const visible = await documentCard.first().isVisible().catch(() => false);
    if (visible) {
      await this.intentionalScrollNearCenter(documentCard.first());
    }
    return visible;
  }

  async showFirstDocumentVersionHistory(): Promise<boolean> {
    const card = this.byTestId('document-card').or(this.page.locator('.document-card')).first();
    if (!(await card.isVisible().catch(() => false))) {
      return false;
    }
    await this.intentionalScrollNearCenter(card);
    await this.clickCentered(card.getByRole('button').first());
    const versionHistory = this.byTestId('document-version-history').or(this.page.getByText(/Document Details|Version|Download DOCX|Download PDF/i).first());
    const visible = await versionHistory.first().isVisible().catch(() => false);
    if (visible) {
      await this.intentionalScrollNearCenter(versionHistory.first());
    }
    return visible;
  }

  async previewAndDownloadDocuments(): Promise<SavedDemoDownload[]> {
    const card = this.byTestId('document-card').or(this.page.locator('.document-card')).first();
    if (!(await card.isVisible().catch(() => false))) {
      return [];
    }

    await this.intentionalScrollNearCenter(card);
    if ((await card.getAttribute('class'))?.includes('document-card-expanded') !== true) {
      await this.clickCentered(card.getByRole('button').first());
    }

    await expect(this.page.getByText(/Document Details|Version|Download DOCX|Download PDF/i).first()).toBeVisible();
    await this.page.waitForTimeout(800);

    const saved = await this.downloadExpandedDocument('alex-taylor-document-library-cv');
    await previewDownloadedPdf(this.page, saved.path, saved.filename, 3600);

    const secondCard = this.byTestId('document-card').or(this.page.locator('.document-card')).nth(1);
    if (await secondCard.isVisible().catch(() => false)) {
      await this.intentionalScrollNearCenter(secondCard);
      await this.clickCentered(secondCard.getByRole('button').first());
      await this.page.waitForTimeout(700);
      const second = await this.downloadExpandedDocument('alex-taylor-document-library-cover-letter');
      await previewDownloadedPdf(this.page, second.path, second.filename, 2600);
      await demoCursor.park(this.page);
      return [saved, second];
    }

    await demoCursor.park(this.page);
    return [saved];
  }

  async showShowcaseDocuments(title: string, company: string): Promise<SavedDemoDownload[]> {
    await this.open();
    const families = this.byTestId('document-family-card')
      .filter({ hasText: title })
      .filter({ hasText: company });
    await expect(families).toHaveCount(2, { timeout: 30_000 });

    const saved: SavedDemoDownload[] = [];
    for (const specification of [
      { type: 'CV', filename: 'alex-taylor-tailored-cv', duration: 5_600 },
      { type: 'Cover letter', filename: 'alex-taylor-tailored-cover-letter', duration: 4_800 }
    ]) {
      const family = families.filter({ hasText: specification.type }).first();
      await this.intentionalScrollNearCenter(family);
      await this.spotlight(family);
      await this.pauseAfterFeature();
      await this.clearSpotlight();
      await this.clickFramed(family.locator('button.document-summary'));
      const expanded = family.locator('.document-expanded');
      await expect(expanded.getByText('Complete version history', { exact: true })).toBeVisible();
      await this.intentionalScrollNearCenter(expanded);
      await this.spotlight(expanded);
      await this.pauseAfterFeature();
      const download = await this.downloadExpandedDocument(specification.filename);
      saved.push(download);
      await this.clearSpotlight();
      await previewDownloadedPdfInPlace(
        this.page,
        download.path,
        specification.type === 'CV' ? 'Alex Taylor — tailored CV' : 'Alex Taylor — tailored cover letter',
        specification.duration
      );
      await this.open();
    }
    await demoCursor.park(this.page);
    return saved;
  }

  async expectShowcaseDocumentsPersisted(title: string, company: string): Promise<void> {
    await this.open();
    const families = this.byTestId('document-family-card')
      .filter({hasText: title})
      .filter({hasText: company});
    await expect(families).toHaveCount(2, {timeout: 30_000});
    await expect(families.filter({hasText: 'CV'}).first()).toBeVisible();
    await expect(families.filter({hasText: 'Cover letter'}).first()).toBeVisible();
  }

  private async downloadExpandedDocument(filename: string): Promise<SavedDemoDownload> {
    const expanded = this.page.locator('.document-card-expanded').first();
    const pdf = expanded.getByRole('button', { name: /Download PDF/i }).first();
    const button = await pdf.isEnabled().catch(() => false)
      ? pdf
      : expanded.getByRole('button', { name: /Download DOCX/i }).first();
    const downloadPromise = this.page.waitForEvent('download');
    await this.clickCentered(button);
    const download = await downloadPromise;
    const saved = await saveDemoDownload(download, filename);
    await demoCursor.showDownloadComplete(this.page, saved.filename);
    return saved;
  }
}
