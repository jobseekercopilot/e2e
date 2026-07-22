import { type Locator, type Page } from '@playwright/test';
import { e2eConfig } from './config';

const OVERLAY_ID = 'promo-demo-focus-overlay';
const MASK_ID = 'promo-demo-focus-mask';
const SPOTLIGHT_CLASS = 'promo-demo-spotlight-target';
const COMPONENT_FOCUS_SELECTOR = '[data-demo-focus]';

export interface DemoDirectorOptions {
  enabled?: boolean;
  focusPaddingPx?: number;
}

export class DemoDirector {
  readonly enabled: boolean;
  readonly focusPaddingPx: number;

  constructor(options: DemoDirectorOptions = {}) {
    this.enabled = options.enabled ?? e2eConfig.demoRecording;
    this.focusPaddingPx = options.focusPaddingPx ?? 22;
  }

  async pauseBefore(page: Page, durationMs = e2eConfig.demoBufferMs): Promise<void> {
    if (!this.enabled) return;
    await page.waitForTimeout(durationMs);
  }

  async pauseAfter(page: Page, durationMs = e2eConfig.demoBufferMs): Promise<void> {
    if (!this.enabled) return;
    await page.waitForTimeout(durationMs);
  }

  async spotlight(locator: Locator): Promise<void> {
    if (!this.enabled) return;
    const page = locator.page();
    await locator.evaluate((element, payload) => {
      const requested = element as HTMLElement;
      const target = requested.matches(payload.componentSelector)
        ? requested
        : requested.closest(payload.componentSelector) as HTMLElement | null;

      if (!target) {
        throw new Error('Demo focus component could not be resolved.');
      }
      const focusTarget: HTMLElement = target;

      window.__promoDemoFocusCleanup?.();
      document.querySelectorAll(`.${payload.spotlightClass}`)
        .forEach(node => node.classList.remove(payload.spotlightClass));

      if (!document.querySelector('style[data-promo-demo-director="true"]')) {
        const style = document.createElement('style');
        style.dataset.promoDemoDirector = 'true';
        style.textContent = `
          #${payload.overlayId} {
            position: fixed;
            inset: 0;
            z-index: 2147483000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 320ms ease;
          }
          #${payload.overlayId}.promo-demo-focus-visible { opacity: 1; }
          #${payload.overlayId} svg {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            overflow: visible;
          }
          #${payload.overlayId} .promo-focus-scrim {
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.08);
            backdrop-filter: blur(2px) brightness(0.94) saturate(0.94);
          }
          #${payload.overlayId} .promo-focus-edge {
            fill: transparent;
            stroke: rgba(15, 23, 42, 0.22);
            stroke-width: 1.25;
            filter: drop-shadow(0 16px 34px rgba(15, 23, 42, 0.14));
            transition:
              x 320ms cubic-bezier(0.22, 1, 0.36, 1),
              y 320ms cubic-bezier(0.22, 1, 0.36, 1),
              width 320ms cubic-bezier(0.22, 1, 0.36, 1),
              height 320ms cubic-bezier(0.22, 1, 0.36, 1),
              stroke 260ms ease;
          }
          #${payload.overlayId} .promo-focus-edge-success {
            stroke: rgba(22, 163, 74, 0.78);
            stroke-width: 2;
            filter: drop-shadow(0 18px 34px rgba(22, 101, 52, 0.18));
          }
          .${payload.spotlightClass} {
            position: relative;
          }
        `;
        document.head.appendChild(style);
      }

      const overlay = document.createElement('div');
      overlay.id = payload.overlayId;
      overlay.innerHTML = `
        <svg aria-hidden="true">
          <defs>
            <mask id="${payload.maskId}" maskUnits="userSpaceOnUse">
              <rect class="promo-mask-fill" x="0" y="0" width="100%" height="100%" fill="white"></rect>
              <rect class="promo-mask-hole" fill="black"></rect>
            </mask>
          </defs>
          <foreignObject x="0" y="0" width="100%" height="100%" mask="url(#${payload.maskId})">
            <div xmlns="http://www.w3.org/1999/xhtml" class="promo-focus-scrim"></div>
          </foreignObject>
          <rect class="promo-focus-edge"></rect>
        </svg>
      `;
      document.documentElement.appendChild(overlay);
      focusTarget.classList.add(payload.spotlightClass);

      const fill = overlay.querySelector('.promo-mask-fill') as SVGRectElement;
      const hole = overlay.querySelector('.promo-mask-hole') as SVGRectElement;
      const edge = overlay.querySelector('.promo-focus-edge') as SVGRectElement;
      const resizeObserver = new ResizeObserver(() => applyBounds());
      const mutationObserver = new MutationObserver(() => {
        observeRelatedElements();
        applyBounds();
      });
      const observed = new Set<Element>();

      const isVisible = (node: Element): node is HTMLElement => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0
          && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0';
      };
      const relatedElements = (): HTMLElement[] => {
        const elements = new Set<HTMLElement>([focusTarget]);
        const group = focusTarget.dataset.demoFocusGroup;
        if (group) {
          document.querySelectorAll(`[data-demo-focus-group="${CSS.escape(group)}"]`)
            .forEach(node => {
              if (node !== focusTarget && isVisible(node)) elements.add(node);
            });
        }
        focusTarget.querySelectorAll('[aria-controls], [aria-owns]').forEach(owner => {
          for (const attr of ['aria-controls', 'aria-owns']) {
            const ids = (owner.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean);
            ids.forEach(id => {
              const controlled = document.getElementById(id);
              if (controlled && isVisible(controlled)) elements.add(controlled);
            });
          }
        });
        return Array.from(elements).filter(isVisible);
      };
      const observeRelatedElements = (): void => {
        relatedElements().forEach(node => {
          if (observed.has(node)) return;
          resizeObserver.observe(node);
          observed.add(node);
        });
      };
      const boundsFor = (elements: HTMLElement[]): { left: number; top: number; right: number; bottom: number } => {
        const rects = elements.map(node => node.getBoundingClientRect());
        const left = Math.min(...rects.map(rect => rect.left));
        const top = Math.min(...rects.map(rect => rect.top));
        const right = Math.max(...rects.map(rect => rect.right));
        const bottom = Math.max(...rects.map(rect => rect.bottom));
        const pad = payload.focusPaddingPx;
        return {
          left: Math.max(0, left - pad),
          top: Math.max(0, top - pad),
          right: Math.min(window.innerWidth, right + pad),
          bottom: Math.min(window.innerHeight, bottom + pad)
        };
      };
      function applyBounds(): void {
        if (!document.documentElement.contains(focusTarget) || !document.documentElement.contains(overlay)) return;
        const elements = relatedElements();
        if (elements.length === 0) return;
        const bounds = boundsFor(elements);
        const width = Math.max(1, bounds.right - bounds.left);
        const height = Math.max(1, bounds.bottom - bounds.top);
        const radius = Math.min(18, Math.max(8, Number(window.getComputedStyle(focusTarget).borderRadius.replace('px', '')) || 12));
        fill.setAttribute('width', String(window.innerWidth));
        fill.setAttribute('height', String(window.innerHeight));
        for (const rect of [hole, edge]) {
          rect.setAttribute('x', bounds.left.toFixed(2));
          rect.setAttribute('y', bounds.top.toFixed(2));
          rect.setAttribute('width', width.toFixed(2));
          rect.setAttribute('height', height.toFixed(2));
          rect.setAttribute('rx', String(radius));
          rect.setAttribute('ry', String(radius));
        }
        const success = !!focusTarget.querySelector('.generated-downloads, .generation-message, .status-offer, .status-accepted');
        edge.classList.toggle('promo-focus-edge-success', success);
      }

      const onGeometryChange = (): void => {
        observeRelatedElements();
        applyBounds();
      };
      observeRelatedElements();
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-expanded', 'data-demo-focus-group']
      });
      window.addEventListener('resize', onGeometryChange);
      window.addEventListener('scroll', onGeometryChange, true);
      document.addEventListener('transitionend', onGeometryChange, true);

      window.__promoDemoFocusCleanup = () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        window.removeEventListener('resize', onGeometryChange);
        window.removeEventListener('scroll', onGeometryChange, true);
        document.removeEventListener('transitionend', onGeometryChange, true);
        focusTarget.classList.remove(payload.spotlightClass);
        overlay.classList.remove('promo-demo-focus-visible');
        window.setTimeout(() => overlay.remove(), 260);
        delete window.__promoDemoFocusCleanup;
      };

      applyBounds();
      window.requestAnimationFrame(() => overlay.classList.add('promo-demo-focus-visible'));
    }, {
      overlayId: OVERLAY_ID,
      maskId: MASK_ID,
      spotlightClass: SPOTLIGHT_CLASS,
      componentSelector: COMPONENT_FOCUS_SELECTOR,
      focusPaddingPx: this.focusPaddingPx
    });
    await page.waitForTimeout(420);
  }

  async spotlightComponent(page: Page, focusId: string): Promise<void> {
    if (!this.enabled) return;
    await this.spotlight(page.locator(`[data-demo-focus-id="${focusId}"]`).first());
  }

  async clear(page: Page): Promise<void> {
    if (!this.enabled) return;
    await page.evaluate((payload) => {
      window.__promoDemoFocusCleanup?.();
      document.querySelectorAll(`.${payload.spotlightClass}`)
        .forEach(node => node.classList.remove(payload.spotlightClass));
      const overlay = document.getElementById(payload.overlayId);
      if (overlay) {
        overlay.classList.remove('promo-demo-focus-visible');
        window.setTimeout(() => overlay.remove(), 260);
      }
    }, { overlayId: OVERLAY_ID, spotlightClass: SPOTLIGHT_CLASS }).catch(() => undefined);
    await page.waitForTimeout(320);
  }
}

declare global {
  interface Window {
    __promoDemoFocusCleanup?: () => void;
  }
}

export const demoDirector = new DemoDirector();
