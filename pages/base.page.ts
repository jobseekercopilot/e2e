import { expect, type Locator, type Page } from '@playwright/test';
import { e2eConfig } from '../support/config';
import { demoCursor } from '../support/demo-cursor';
import { demoDirector } from '../support/demo-director';

export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  protected byTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  protected async fillByLabel(label: string | RegExp, value: string): Promise<void> {
    await this.humanFill(this.page.getByLabel(label), value);
  }

  protected async clickByRole(name: string | RegExp): Promise<void> {
    await this.clickCentered(this.page.getByRole('button', { name }));
  }

  protected async expectVisibleByRole(role: Parameters<Page['getByRole']>[0], name: string | RegExp): Promise<void> {
    await expect(this.page.getByRole(role, { name })).toBeVisible();
  }

  protected async clickCentered(locator: Locator): Promise<void> {
    await this.scrollNearCenter(locator);
    await this.clickInPlace(locator);
  }

  protected async clickFramed(locator: Locator): Promise<void> {
    await this.intentionalScrollNearCenter(locator);
    await this.clickInPlace(locator);
  }

  protected async clickInPlace(locator: Locator): Promise<void> {
    await demoCursor.click(locator);
  }

  protected async domClick(locator: Locator): Promise<void> {
    if (e2eConfig.demoRecording) {
      await this.clickCentered(locator);
      return;
    }
    await locator.evaluate((element: HTMLElement) => element.click());
  }

  protected async humanFill(locator: Locator, value: string): Promise<void> {
    await this.scrollNearCenter(locator);
    await this.humanFillInPlace(locator, value);
  }

  protected async humanFillInPlace(locator: Locator, value: string): Promise<void> {
    await demoCursor.click(locator);
    await locator.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await locator.press('Backspace');
    await locator.pressSequentially(value, { delay: e2eConfig.typingDelayMs });
  }

  protected async humanFillFramed(locator: Locator, value: string): Promise<void> {
    await this.intentionalScrollNearCenter(locator);
    await this.humanFillInPlace(locator, value);
  }

  protected async humanTypeInPlace(locator: Locator, value: string): Promise<void> {
    await demoCursor.click(locator);
    await locator.pressSequentially(value, { delay: e2eConfig.typingDelayMs });
  }

  protected async humanTypeFramed(locator: Locator, value: string): Promise<void> {
    await this.intentionalScrollNearCenter(locator);
    await this.humanTypeInPlace(locator, value);
  }

  protected async fillCentered(locator: Locator, value: string): Promise<void> {
    await this.scrollNearCenter(locator);
    await this.fillInPlace(locator, value);
  }

  protected async fillFramed(locator: Locator, value: string): Promise<void> {
    await this.intentionalScrollNearCenter(locator);
    await this.fillInPlace(locator, value);
  }

  protected async fillInPlace(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
  }

  protected async selectCentered(locator: Locator, value: string | { label: string }): Promise<void> {
    await this.scrollNearCenter(locator);
    await this.selectInPlace(locator, value);
  }

  protected async selectFramed(locator: Locator, value: string | { label: string }): Promise<void> {
    await this.intentionalScrollNearCenter(locator);
    await this.selectInPlace(locator, value);
  }

  protected async spotlight(locator: Locator): Promise<void> {
    await demoDirector.spotlight(locator);
  }

  protected async clearSpotlight(): Promise<void> {
    await demoDirector.clear(this.page);
  }

  protected async pauseBeforeFeature(): Promise<void> {
    await demoDirector.pauseBefore(this.page);
  }

  protected async pauseAfterFeature(): Promise<void> {
    await demoDirector.pauseAfter(this.page);
  }

  protected async selectInPlace(locator: Locator, value: string | { label: string }): Promise<void> {
    await demoCursor.click(locator);
    await locator.selectOption(value);
  }

  protected async scrollNearCenter(locator: Locator): Promise<void> {
    if (e2eConfig.demoRecording) {
      await this.assertComfortablyVisible(locator, 'Demo recording target is outside the viewport. Use an intentional scroll step or choose a visible target.');
      return;
    }
    await this.intentionalScrollNearCenter(locator);
  }

  protected async intentionalScrollNearCenter(locator: Locator): Promise<void> {
    const targetPoint = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const startY = window.scrollY;
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const visibleTop = 112;
      const visibleBottom = window.innerHeight - 112;
      const isComfortablyVisible = rect.top >= visibleTop && rect.bottom <= visibleBottom;
      const targetY = Math.min(
        Math.max(0, isComfortablyVisible ? startY : startY + rect.top + rect.height / 2 - window.innerHeight / 2),
        maxScrollY
      );
      const finalTop = rect.top + startY - targetY;
      return {
        x: Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16),
        y: Math.min(Math.max(finalTop + rect.height / 2, 16), window.innerHeight - 16)
      };
    });

    await Promise.all([
      locator.evaluate((element, durationMs) => new Promise<void>((resolve) => {
        const rect = element.getBoundingClientRect();
        const startY = window.scrollY;
        const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const visibleTop = 112;
        const visibleBottom = window.innerHeight - 112;
        const isComfortablyVisible = rect.top >= visibleTop && rect.bottom <= visibleBottom;
        const targetY = Math.min(
          Math.max(0, isComfortablyVisible ? startY : startY + rect.top + rect.height / 2 - window.innerHeight / 2),
          maxScrollY
        );
        const deltaY = targetY - startY;
        if (Math.abs(deltaY) < 2) {
          resolve();
          return;
        }
        const startTime = performance.now();

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
      }), e2eConfig.demoScrollMs),
      demoCursor.moveToPoint(this.page, targetPoint, e2eConfig.demoScrollMs)
    ]);
    await this.page.waitForTimeout(120);
  }

  protected async scrollNearTop(locator: Locator, topOffsetPx = 96): Promise<void> {
    if (e2eConfig.demoRecording) {
      await this.assertComfortablyVisible(locator, 'Demo recording target is outside the viewport. Use an intentional scroll step or choose a visible target.', topOffsetPx);
      return;
    }
    await this.intentionalScrollNearTop(locator, topOffsetPx);
  }

  protected async intentionalScrollNearTop(locator: Locator, topOffsetPx = 96): Promise<void> {
    const targetPoint = await locator.evaluate((element, topOffset) => {
      const rect = element.getBoundingClientRect();
      const startY = window.scrollY;
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const visibleTop = topOffset;
      const visibleBottom = window.innerHeight - 112;
      const isComfortablyVisible = rect.top >= visibleTop && rect.bottom <= visibleBottom;
      const targetY = Math.min(Math.max(0, isComfortablyVisible ? startY : startY + rect.top - topOffset), maxScrollY);
      const finalTop = rect.top + startY - targetY;
      return {
        x: Math.min(Math.max(rect.left + Math.min(Math.max(rect.width * 0.86, 24), Math.max(rect.width - 24, 24)), 16), window.innerWidth - 16),
        y: Math.min(Math.max(finalTop + Math.min(Math.max(rect.height * 0.22, 24), Math.max(rect.height - 24, 24)), 16), window.innerHeight - 16)
      };
    }, topOffsetPx);

    await Promise.all([
      locator.evaluate((element, payload) => new Promise<void>((resolve) => {
        const rect = element.getBoundingClientRect();
        const startY = window.scrollY;
        const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const visibleTop = payload.topOffset;
        const visibleBottom = window.innerHeight - 112;
        const isComfortablyVisible = rect.top >= visibleTop && rect.bottom <= visibleBottom;
        const targetY = Math.min(Math.max(0, isComfortablyVisible ? startY : startY + rect.top - payload.topOffset), maxScrollY);
        const deltaY = targetY - startY;
        if (Math.abs(deltaY) < 2) {
          resolve();
          return;
        }
        const startTime = performance.now();

        const easeInOut = (progress: number): number => (
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2
        );

        const step = (now: number): void => {
          const progress = Math.min((now - startTime) / payload.durationMs, 1);
          window.scrollTo(0, startY + deltaY * easeInOut(progress));

          if (progress < 1) {
            window.requestAnimationFrame(step);
          } else {
            resolve();
          }
        };

        window.requestAnimationFrame(step);
      }), { durationMs: e2eConfig.demoScrollMs, topOffset: topOffsetPx }),
      demoCursor.moveToPoint(this.page, targetPoint, e2eConfig.demoScrollMs)
    ]);
    await this.page.waitForTimeout(120);
  }

  protected async assertComfortablyVisible(locator: Locator, message: string, topOffsetPx = 112): Promise<void> {
    const visible = await locator.evaluate((element, payload) => {
      const rect = element.getBoundingClientRect();
      const visibleTop = payload.topOffsetPx;
      const visibleBottom = window.innerHeight - 112;
      return rect.top >= visibleTop
        && rect.bottom <= visibleBottom
        && rect.left >= 0
        && rect.right <= window.innerWidth
        && rect.width > 0
        && rect.height > 0;
    }, { topOffsetPx });

    if (!visible) {
      throw new Error(message);
    }
  }

  protected async scrollToPageBottom(): Promise<void> {
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 720 };
    await Promise.all([
      this.page.evaluate((durationMs) => new Promise<void>((resolve) => {
        const startY = window.scrollY;
        const targetY = document.documentElement.scrollHeight - window.innerHeight;
        const deltaY = targetY - startY;
        const startTime = performance.now();

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
      }), e2eConfig.demoScrollMs),
      demoCursor.moveToPoint(this.page, { x: viewport.width - 96, y: viewport.height - 112 }, e2eConfig.demoScrollMs)
    ]);
    await this.page.waitForTimeout(120);
  }
}
