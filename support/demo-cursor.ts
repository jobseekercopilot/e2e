import { expect, type Locator, type Page } from '@playwright/test';
import { e2eConfig } from './config';

const CURSOR_ID = 'promo-demo-cursor';
const TOAST_ID = 'promo-demo-download-toast';
const INITIAL_POINT_BINDING = '__promoDemoCursorInitialPoint';

export interface DemoCursorOptions {
  enabled?: boolean;
  color?: string;
  outlineColor?: string;
  sizePx?: number;
}

interface CursorPoint {
  x: number;
  y: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

export class PromotionalCursor {
  readonly enabled: boolean;
  readonly color: string;
  readonly outlineColor: string;
  readonly sizePx: number;
  private positions = new WeakMap<Page, CursorPoint>();
  private bindings = new WeakSet<Page>();
  private initScripts = new WeakSet<Page>();
  private listeners = new WeakSet<Page>();

  constructor(options: DemoCursorOptions = {}) {
    this.enabled = options.enabled ?? e2eConfig.demoRecording;
    this.color = options.color ?? '#111827';
    this.outlineColor = options.outlineColor ?? '#f8fafc';
    this.sizePx = options.sizePx ?? 28;
  }

  async install(page: Page): Promise<void> {
    if (!this.enabled) return;

    await this.ensureBinding(page);
    if (!this.initScripts.has(page)) {
      await page.addInitScript(this.installationScript());
      this.initScripts.add(page);
    }
    if (!this.listeners.has(page)) {
      page.on('domcontentloaded', () => {
        void this.restore(page).catch(() => undefined);
      });
      this.listeners.add(page);
    }

    await this.restore(page);
  }

  async restore(page: Page): Promise<void> {
    if (!this.enabled) return;

    await this.ensureBinding(page);
    await page.evaluate(this.installationScript()).catch(() => undefined);
    const point = await this.clampedControllerPoint(page);
    await page.evaluate((cursorPoint) => {
      window.__promoDemoCursor?.restore(cursorPoint.x, cursorPoint.y);
    }, point).catch(() => undefined);
    this.positions.set(page, point);
  }

  async remove(page: Page): Promise<void> {
    if (!this.enabled) return;
    await page.evaluate(({ cursorId, toastId }) => {
      document.getElementById(cursorId)?.remove();
      document.getElementById(toastId)?.remove();
      delete window.__promoDemoCursor;
    }, { cursorId: CURSOR_ID, toastId: TOAST_ID }).catch(() => undefined);
  }

  async moveTo(locator: Locator, options: { durationMs?: number } = {}): Promise<void> {
    if (!this.enabled) return;
    const page = locator.page();
    await this.ensureReady(page);
    const target = await this.clickPointFor(locator);
    await this.movePoint(page, target, options.durationMs);
  }

  async moveToPoint(page: Page, target: CursorPoint, durationMs?: number): Promise<void> {
    if (!this.enabled) return;
    await this.ensureReady(page);
    await this.assertPointInViewport(page, target, 'Demo cursor target point is outside the viewport.');
    await this.movePoint(page, target, durationMs);
  }

  async click(locator: Locator): Promise<void> {
    const page = locator.page();
    if (!this.enabled) {
      await locator.click();
      return;
    }

    await this.ensureReady(page);
    const point = await this.clickPointFor(locator);
    await this.movePoint(page, point);
    await page.waitForTimeout(90);
    await this.clickPoint(page, point);
  }

  async clickPoint(page: Page, point: CursorPoint): Promise<void> {
    if (!this.enabled) {
      await page.mouse.click(point.x, point.y);
      return;
    }

    await this.ensureReady(page);
    await this.assertPointInViewport(page, point, 'Demo cursor click point is outside the viewport.');
    const current = await this.currentPosition(page);
    if (Math.hypot(point.x - current.x, point.y - current.y) > 0.5) {
      await this.movePoint(page, point);
    }

    await page.mouse.down();
    await page.evaluate(({ x, y }) => {
      window.__promoDemoCursor?.click(x, y);
    }, point).catch(() => undefined);
    await page.mouse.up();
    this.positions.set(page, point);
    await page.waitForTimeout(240);
  }

  async currentPosition(page: Page): Promise<CursorPoint> {
    if (!this.enabled) return this.defaultPoint(page);
    const known = this.positions.get(page);
    if (known) return this.clampPoint(page, known);

    const browserPoint = await page.evaluate(() => window.__promoDemoCursor?.point()).catch(() => undefined);
    if (browserPoint && Number.isFinite(browserPoint.x) && Number.isFinite(browserPoint.y)) {
      const clamped = await this.clampPoint(page, browserPoint);
      this.positions.set(page, clamped);
      return clamped;
    }

    const fallback = this.defaultPoint(page);
    this.positions.set(page, fallback);
    return fallback;
  }

  async park(page: Page): Promise<void> {
    if (!this.enabled) return;
    const viewport = this.viewport(page);
    await this.movePoint(page, { x: viewport.width - 84, y: viewport.height - 84 }, 420);
  }

  async hide(page: Page): Promise<void> {
    if (!this.enabled) return;
    await this.ensureReady(page);
    await page.evaluate(() => window.__promoDemoCursor?.hide()).catch(() => undefined);
  }

  async show(page: Page): Promise<void> {
    if (!this.enabled) return;
    await this.ensureReady(page);
    await page.evaluate(() => window.__promoDemoCursor?.show()).catch(() => undefined);
  }

  async showDownloadComplete(page: Page, filename: string): Promise<void> {
    if (!this.enabled) return;
    await this.ensureReady(page);
    await page.evaluate((name) => window.__promoDemoCursor?.download(name), filename).catch(() => undefined);
    await page.waitForTimeout(1250);
  }

  private async ensureReady(page: Page): Promise<void> {
    await this.install(page);
    await page.evaluate(() => !!window.__promoDemoCursor?.point()).catch(() => false);
  }

  private async ensureBinding(page: Page): Promise<void> {
    if (this.bindings.has(page)) return;
    await page.exposeFunction(INITIAL_POINT_BINDING, () => {
      const point = this.positions.get(page) ?? this.defaultPoint(page);
      return this.clampPointSync(page, point);
    });
    this.bindings.add(page);
  }

  private async clickPointFor(locator: Locator): Promise<CursorPoint> {
    const page = locator.page();
    await expect(locator).toBeVisible({ timeout: 10_000 });
    const box = await locator.boundingBox();
    if (!box) throw new Error('Cannot move demo cursor to an element without a bounding box.');

    const viewport = this.viewport(page);
    const isFullyVisible = box.x >= 0
      && box.y >= 0
      && box.x + box.width <= viewport.width
      && box.y + box.height <= viewport.height;
    if (!isFullyVisible) {
      throw new Error('Demo recording target is outside the viewport. Frame the component before clicking instead of auto-scrolling it under the cursor.');
    }

    const insetX = Math.min(Math.max(box.width * 0.5, 8), Math.max(box.width - 8, 8));
    const insetY = Math.min(Math.max(box.height * 0.5, 8), Math.max(box.height - 8, 8));
    return {
      x: box.x + insetX,
      y: box.y + insetY
    };
  }

  private async movePoint(page: Page, target: CursorPoint, durationMs?: number): Promise<void> {
    const start = await this.currentPosition(page);
    const end = await this.clampPoint(page, target);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 0.5) {
      this.positions.set(page, end);
      await page.evaluate((point) => window.__promoDemoCursor?.restore(point.x, point.y), end).catch(() => undefined);
      return;
    }

    const duration = durationMs ?? this.durationFor(distance);
    const steps = Math.max(6, Math.min(44, Math.ceil(duration / 16)));
    const interval = duration / steps;

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const point = {
        x: start.x + (end.x - start.x) * eased,
        y: start.y + (end.y - start.y) * eased
      };
      await page.mouse.move(point.x, point.y);
      this.positions.set(page, point);
      if (index < steps) {
        await page.waitForTimeout(interval);
      }
    }

    await page.mouse.move(end.x, end.y);
    this.positions.set(page, end);
  }

  private durationFor(distance: number): number {
    if (distance < 140) return 280;
    if (distance < 520) return Math.min(520, Math.max(350, distance * 0.78));
    return Math.min(750, Math.max(550, distance * 0.48));
  }

  private async clampedControllerPoint(page: Page): Promise<CursorPoint> {
    return this.clampPoint(page, this.positions.get(page) ?? this.defaultPoint(page));
  }

  private async clampPoint(page: Page, point: CursorPoint): Promise<CursorPoint> {
    return this.clampPointSync(page, point);
  }

  private clampPointSync(page: Page, point: CursorPoint): CursorPoint {
    const viewport = this.viewport(page);
    return {
      x: Math.min(Math.max(point.x, 12), viewport.width - 12),
      y: Math.min(Math.max(point.y, 12), viewport.height - 12)
    };
  }

  private async assertPointInViewport(page: Page, point: CursorPoint, message: string): Promise<void> {
    const viewport = this.viewport(page);
    if (point.x < 0 || point.y < 0 || point.x > viewport.width || point.y > viewport.height) {
      throw new Error(message);
    }
  }

  private defaultPoint(page: Page): CursorPoint {
    const viewport = this.viewport(page);
    return {
      x: Math.round(viewport.width * 0.16),
      y: Math.round(viewport.height * 0.18)
    };
  }

  private viewport(page: Page): ViewportSize {
    return page.viewportSize() ?? { width: 1280, height: 720 };
  }

  private installationScript(): string {
    return `
      (() => {
        const cursorId = ${JSON.stringify(CURSOR_ID)};
        const toastId = ${JSON.stringify(TOAST_ID)};
        const bindingName = ${JSON.stringify(INITIAL_POINT_BINDING)};
        const color = ${JSON.stringify(this.color)};
        const outlineColor = ${JSON.stringify(this.outlineColor)};
        const size = ${JSON.stringify(this.sizePx)};
        const tipX = Math.round(size * 0.18);
        const tipY = Math.round(size * 0.12);

        if (window.__promoDemoCursor && document.getElementById(cursorId)) return;

        const fallbackPoint = () => ({
          x: Math.round(window.innerWidth * 0.16),
          y: Math.round(window.innerHeight * 0.18)
        });
        const clamp = (point) => ({
          x: Math.min(Math.max(Number(point?.x) || fallbackPoint().x, 12), Math.max(12, window.innerWidth - 12)),
          y: Math.min(Math.max(Number(point?.y) || fallbackPoint().y, 12), Math.max(12, window.innerHeight - 12))
        });
        const transformFor = (point) => \`translate3d(\${point.x - tipX}px, \${point.y - tipY}px, 0)\`;
        const readInitialPoint = () => {
          const provider = window[bindingName];
          if (typeof provider === 'function') {
            return Promise.resolve(provider()).then(clamp, () => clamp(fallbackPoint()));
          }
          return Promise.resolve(clamp(fallbackPoint()));
        };

        const boot = (initialPoint) => {
          if (!document.documentElement) {
            window.addEventListener('DOMContentLoaded', () => boot(initialPoint), { once: true });
            return;
          }

          let currentPoint = clamp(initialPoint);

          if (!document.querySelector('style[data-promo-cursor="true"]')) {
            const style = document.createElement('style');
            style.dataset.promoCursor = 'true';
            style.textContent = \`
          #\${cursorId} {
            position: fixed;
            left: 0;
            top: 0;
            width: \${size}px;
            height: \${size}px;
            transform: \${transformFor(currentPoint)};
            z-index: 2147483647;
            pointer-events: none;
            opacity: 1;
            transition: opacity 140ms ease;
            filter: drop-shadow(0 9px 16px rgba(15, 23, 42, 0.24));
            will-change: transform;
          }
          #\${cursorId}.promo-cursor-hidden { opacity: 0; }
          #\${cursorId} .promo-cursor-pointer {
            position: absolute;
            inset: 0;
            background: \${color};
            clip-path: polygon(15% 6%, 15% 88%, 38% 68%, 52% 96%, 66% 89%, 52% 62%, 84% 62%);
            transform-origin: \${tipX}px \${tipY}px;
            transition: transform 120ms ease;
            filter:
              drop-shadow(1px 0 0 \${outlineColor})
              drop-shadow(-1px 0 0 \${outlineColor})
              drop-shadow(0 1px 0 \${outlineColor})
              drop-shadow(0 -1px 0 \${outlineColor})
              drop-shadow(0 2px 5px rgba(15, 23, 42, 0.28));
          }
          #\${cursorId}.promo-cursor-clicking .promo-cursor-pointer { transform: scale(0.9); }
          .promo-cursor-ring {
            position: fixed;
            width: 18px;
            height: 18px;
            margin: -9px 0 0 -9px;
            border: 2px solid \${color};
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
            border-radius: 999px;
            z-index: 2147483646;
            pointer-events: none;
            animation: promo-cursor-ring 360ms ease-out forwards;
          }
          @keyframes promo-cursor-ring {
            from { opacity: 0.6; transform: scale(0.6); }
            to { opacity: 0; transform: scale(2.8); }
          }
          #\${toastId} {
            position: fixed;
            right: 28px;
            bottom: 28px;
            z-index: 2147483647;
            pointer-events: none;
            border-radius: 8px;
            border: 1px solid rgba(15, 23, 42, 0.18);
            background: rgba(255, 255, 255, 0.96);
            color: #0f172a;
            box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
            padding: 12px 14px;
            min-width: 260px;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 180ms ease, transform 180ms ease;
            font: 500 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          #\${toastId}.promo-toast-visible { opacity: 1; transform: translateY(0); }
          #\${toastId} strong { display: block; color: #16a34a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }
          #\${toastId} span { display: block; margin-top: 2px; overflow-wrap: anywhere; }
        \`;
            document.head.appendChild(style);
          }

          const cursor = document.getElementById(cursorId) || document.createElement('div');
          cursor.id = cursorId;
          cursor.setAttribute('aria-hidden', 'true');
          cursor.innerHTML = '<div class="promo-cursor-pointer"></div>';
          cursor.style.transform = transformFor(currentPoint);
          if (!cursor.parentElement) document.documentElement.appendChild(cursor);

          const toast = document.getElementById(toastId) || document.createElement('div');
          toast.id = toastId;
          toast.setAttribute('aria-live', 'polite');
          if (!toast.parentElement) document.documentElement.appendChild(toast);

          const setPoint = (x, y) => {
            currentPoint = clamp({ x, y });
            cursor.style.transform = transformFor(currentPoint);
          };
          const followMouse = (event) => {
            if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
              setPoint(event.clientX, event.clientY);
            }
          };

          window.addEventListener('mousemove', followMouse, { passive: true });
          window.addEventListener('pointermove', followMouse, { passive: true });

          window.__promoDemoCursor = {
            restore(x, y) {
              setPoint(x, y);
              cursor.classList.remove('promo-cursor-hidden');
            },
            point() {
              return currentPoint;
            },
            click(x, y) {
              setPoint(x, y);
              cursor.classList.add('promo-cursor-clicking');
              window.setTimeout(() => cursor.classList.remove('promo-cursor-clicking'), 180);
              const ring = document.createElement('div');
              ring.className = 'promo-cursor-ring';
              ring.style.left = \`\${x}px\`;
              ring.style.top = \`\${y}px\`;
              document.documentElement.appendChild(ring);
              window.setTimeout(() => ring.remove(), 420);
            },
            hide() {
              cursor.classList.add('promo-cursor-hidden');
            },
            show() {
              cursor.classList.remove('promo-cursor-hidden');
            },
            download(filename) {
              toast.innerHTML = '<strong>Downloaded</strong><span></span>';
              toast.querySelector('span').textContent = filename;
              toast.classList.add('promo-toast-visible');
              window.setTimeout(() => toast.classList.remove('promo-toast-visible'), 1400);
            }
          };
        };

        readInitialPoint().then(boot);
      })();
    `;
  }
}

declare global {
  interface Window {
    __promoDemoCursor?: {
      restore: (x: number, y: number) => void;
      point: () => CursorPoint;
      click: (x: number, y: number) => void;
      hide: () => void;
      show: () => void;
      download: (filename: string) => void;
    };
  }
}

export const demoCursor = new PromotionalCursor();
