import type { ExportReport } from "../src/data-access-layer/host/types";

export interface RenderOptions {
  port: number;
  board: string;
  timeoutMs?: number;
}

/** Drive the built SPA in headless Chromium. Playwright is an optional peer. */
export async function renderHeadless(options: RenderOptions): Promise<ExportReport> {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Headless render needs Playwright. Install it in this project: `npm i -D playwright && npx playwright install chromium`.",
    );
  }
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(
      `http://127.0.0.1:${options.port}/render?board=${encodeURIComponent(options.board)}`,
    );
    await page.waitForFunction(() => window.__STORE_STUDIO_RENDER_DONE__ === true, {
      timeout: options.timeoutMs ?? 120_000,
    });
    const result = await page.evaluate<{
      error: string | undefined;
      report: ExportReport | undefined;
    }>(() => ({
      error: window.__STORE_STUDIO_RENDER_ERROR__,
      report: window.__STORE_STUDIO_RENDER_RESULT__ as ExportReport | undefined,
    }));
    if (result.error !== undefined) throw new Error(result.error);
    if (result.report === undefined) throw new Error("The renderer did not return a report");
    return result.report;
  } finally {
    await browser.close();
  }
}
