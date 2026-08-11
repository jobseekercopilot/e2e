import { expect, test } from '@playwright/test';
import { ApplicationTrackerPage } from '../pages/ApplicationTrackerPage';

const applicationMarkup = `
  <base href="http://application.test/" />
  <section data-testid="applications-workspace">
    <button type="button" onclick="fetch('/api/jobs/applications')">
      Refresh
    </button>
    <article class="application-card" data-testid="application-card">
      <h3>Software Developer</h3>
      <div class="application-meta"><span>Example Ltd</span></div>
      <span class="status-badge status-applied">Applied</span>
      <details>
        <summary>View Application</summary>
        <button type="button" onclick="fetch(
          '/api/jobs/applications/test-application/status',
          {method: 'PATCH'}
        ).then(() => {
          const card = this.closest('article');
          const badge = card.querySelector('.status-badge');
          badge.className = 'status-badge status-interview';
          badge.textContent = 'Interview';
        })
        ">Mark Interview</button>
      </details>
    </article>
  </section>
`;

test('application status action and persisted refresh are mandatory evidence', async ({
  page
}) => {
  await page.route('**/api/jobs/applications', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/jobs/applications/*/status', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.setContent(applicationMarkup);
  const tracker = new ApplicationTrackerPage(page);

  await tracker.moveApplicationToInterview();
  await tracker.focusApplicationWithStatus(/Interview/i);
  await tracker.expectLastChangedStatusAfterRefresh('interview');

  await expect(page.locator('.status-interview')).toHaveText('Interview');
});

test('missing seeded status fails instead of falling back to another card', async ({
  page
}) => {
  await page.setContent(`
    <article class="application-card" data-testid="application-card">
      <h3>Software Developer</h3>
      <div class="application-meta"><span>Example Ltd</span></div>
      <span class="status-badge status-offer">Offer</span>
    </article>
  `);
  const tracker = new ApplicationTrackerPage(page);

  await expect(tracker.moveApplicationToInterview()).rejects.toThrow(
    'No visible application matched an allowed current status'
  );
});

test('missing lifecycle action fails instead of returning a promotional success', async ({
  page
}) => {
  await page.setContent(`
    <article class="application-card" data-testid="application-card">
      <h3>Software Developer</h3>
      <div class="application-meta"><span>Example Ltd</span></div>
      <span class="status-badge status-applied">Applied</span>
      <details><summary>View Application</summary></details>
    </article>
  `);
  const tracker = new ApplicationTrackerPage(page);

  await expect(tracker.moveApplicationToInterview()).rejects.toThrow(
    'Application action /Interview/i is missing'
  );
});
