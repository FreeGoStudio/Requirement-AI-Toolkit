import express from 'express';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireThat } from './errors.mjs';

// Runs without a platform login in an ephemeral origin. Candidate JavaScript gets
// no approval credentials and cannot request the platform or production endpoints.
export async function verifyBrowser(build, { executablePath } = {}) {
  const app = express(); app.use('/fixed/build/', express.static(build.archive));
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const blocked = [], errors = [];
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      blocked.push(url.split('?')[0]); return route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const bundle = JSON.parse(await readFile(join(build.archive, 'requirements', `${build.requirement_id}.json`), 'utf8'));
    await page.goto(`${origin}/fixed/build/index.html`, { waitUntil: 'networkidle' });
    const checks = [], canvas = page.frameLocator('#canvas');
    for (const scene of bundle.scenarios.scenarios) {
      await page.locator('#scenarios').selectOption(scene.id);
      for (const scope of bundle.manifest.review_scope) {
        await page.locator('#scopes button').filter({ hasText: `${scope.app} ${scope.route}` }).click();
        await canvas.locator(`[data-prototype-route="${scope.route}"] main`).waitFor({ state: 'visible', timeout: 15000 });
        for (const region of scope.regions || []) await canvas.locator(`[data-prototype-id="${region}"]`).waitFor({ state: 'visible', timeout: 10000 });
        checks.push({ scenario: scene.id, scope: scope.id, rendered: true });
      }
    }
    await page.reload({ waitUntil: 'networkidle' });
    await canvas.locator('main').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 390, height: 844 });
    requireThat(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'MOBILE_OVERFLOW', '评审入口窄屏横向溢出');
    requireThat(!errors.length && !blocked.length, 'BROWSER_FAILED', `浏览器错误或外部请求：${[...errors,...blocked].join('; ')}`);
    return { passed: true, build_id: build.id, artifact_sha256: build.artifact_sha256,
      checked_at: new Date().toISOString(), browser: browser.version(), checks, deep_path: true, refresh: true,
      note: '页面、场景、区域、刷新与网络检查；业务表达仍须人工逐项验收' };
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
