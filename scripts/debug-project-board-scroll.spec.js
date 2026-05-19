const { test } = require('@playwright/test');

async function collectMetrics(page, selector) {
  return page.evaluate((targetSelector) => {
    const el = document.querySelector(targetSelector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    return {
      selector: targetSelector,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
      width: rect.width,
      height: rect.height,
    };
  }, selector);
}

test('debug project board scroll compared with finance calendar', async ({ page }) => {
  await page.goto('http://127.0.0.1:2199/#project', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /看板视图/ }).click().catch(() => {});
  await page.waitForTimeout(1200);

  const projectShell = '.project-board-scroll-shell';
  const projectMetricsBefore = await collectMetrics(page, projectShell);
  console.log('project-before', JSON.stringify(projectMetricsBefore, null, 2));

  if (projectMetricsBefore) {
    await page.locator(projectShell).evaluate((el) => { el.scrollLeft = 320; });
    await page.waitForTimeout(150);
    const projectMetricsAfter = await collectMetrics(page, projectShell);
    console.log('project-after', JSON.stringify(projectMetricsAfter, null, 2));
  }

  await page.goto('http://127.0.0.1:2199/#finance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const financeShell = '[data-expense-ledger-calendar-scroll="true"]';
  const financeMetricsBefore = await collectMetrics(page, financeShell);
  console.log('finance-before', JSON.stringify(financeMetricsBefore, null, 2));

  if (financeMetricsBefore) {
    await page.locator(financeShell).evaluate((el) => { el.scrollLeft = 320; });
    await page.waitForTimeout(150);
    const financeMetricsAfter = await collectMetrics(page, financeShell);
    console.log('finance-after', JSON.stringify(financeMetricsAfter, null, 2));
  }
});
