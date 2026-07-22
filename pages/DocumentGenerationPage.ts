import { expect, type Page } from '@playwright/test';
import { saveDemoDownload, type SavedDemoDownload } from '../support/demo-downloads';
import { demoCursor } from '../support/demo-cursor';
import { BasePage } from './base.page';

export class DocumentGenerationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async generateApplicationDocuments(): Promise<'pending' | 'clicked'> {
    // TODO backend/frontend: provide deterministic DEMO_MODE generation that does not spend real AI credits.
    if (!process.env.ALLOW_AI_GENERATION || process.env.ALLOW_AI_GENERATION.toLowerCase() !== 'true') {
      return 'pending';
    }

    const button = this.byTestId('generate-cv-button')
      .or(this.byTestId('generate-documents-button'))
      .or(this.page.getByRole('button', { name: /generate cv & cover letter|generate cv/i }));

    if (!(await button.first().isVisible().catch(() => false))) {
      return 'pending';
    }

    await this.spotlight(button.first());
    await this.pauseBeforeFeature();
    await this.clickFramed(button.first());
    await this.page.waitForTimeout(1300);
    return 'clicked';
  }

  async generateCv(): Promise<'pending' | 'clicked'> {
    return this.generateApplicationDocuments();
  }

  async generateCoverLetter(): Promise<'pending' | 'clicked'> {
    return this.generateApplicationDocuments();
  }

  async waitForApplicationDocumentSuccess(): Promise<void> {
    await expect(this.page.getByText(/CV and Cover Letter generated successfully|Download DOCX|Download PDF/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(this.documentGroup('CV').getByRole('button', { name: /Download PDF|Download DOCX/i }).first()).toBeVisible();
    await expect(this.documentGroup('Cover Letter').getByRole('button', { name: /Download PDF|Download DOCX/i }).first()).toBeVisible();
    await this.intentionalScrollNearCenter(this.documentGroup('CV').first());
    await this.spotlight(this.documentGroup('CV').first());
    await demoCursor.moveTo(this.documentGroup('CV').first());
    await this.page.waitForTimeout(450);
    await this.intentionalScrollNearCenter(this.documentGroup('Cover Letter').first());
    await this.spotlight(this.documentGroup('Cover Letter').first());
    await demoCursor.moveTo(this.documentGroup('Cover Letter').first());
    await this.page.waitForTimeout(450);
    await demoCursor.park(this.page);
    await this.pauseAfterFeature();
    await this.clearSpotlight();
  }

  async waitForCvSuccess(): Promise<void> {
    await this.waitForApplicationDocumentSuccess();
  }

  async waitForCoverLetterSuccess(): Promise<void> {
    await this.waitForApplicationDocumentSuccess();
  }

  async downloadGeneratedDocuments(): Promise<SavedDemoDownload[]> {
    const cv = await this.downloadDocument('CV', 'alex-taylor-tailored-cv');
    await this.page.waitForTimeout(500);
    const coverLetter = await this.downloadDocument('Cover Letter', 'alex-taylor-cover-letter');
    await demoCursor.park(this.page);
    return [cv, coverLetter];
  }

  private async downloadDocument(kind: 'CV' | 'Cover Letter', filename: string): Promise<SavedDemoDownload> {
    const button = await this.downloadButton(kind);
    const downloadPromise = this.page.waitForEvent('download');
    await this.clickFramed(button);
    const download = await downloadPromise;
    const saved = await saveDemoDownload(download, filename);
    await demoCursor.showDownloadComplete(this.page, saved.filename);
    return saved;
  }

  private async downloadButton(kind: 'CV' | 'Cover Letter') {
    const group = this.documentGroup(kind);
    const pdf = group.getByRole('button', { name: /Download PDF/i }).first();
    const docx = group.getByRole('button', { name: /Download DOCX/i }).first();
    if (await pdf.isEnabled().catch(() => false)) {
      return pdf;
    }
    return docx;
  }

  private documentGroup(kind: 'CV' | 'Cover Letter') {
    return this.page.getByRole('heading', { name: new RegExp(`^${kind}$`, 'i') })
      .locator('xpath=ancestor::div[1]');
  }
}
