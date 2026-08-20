import { readFile, unlink } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const KICKOFF_TRANSCRIPT = `[Coach]: E2E kickoff evidence
[Client]: Thanks for the kickoff review`;
const COACHING_TRANSCRIPT = `[Coach]: E2E coaching evidence
[Client]: Thanks for the coaching review`;
const FAILURE_TRANSCRIPT = `[Coach]: E2E_FORCE_FAILURE
[Client]: This failure is local test data`;

async function removeTestStore() {
  const path = process.env.EVALUATOR_TEST_STORE;
  if (!path) throw new Error("EVALUATOR_TEST_STORE is not configured");
  await unlink(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

test.beforeAll(removeTestStore);
test.afterAll(removeTestStore);

async function submit(
  page: Page,
  callType: "kickoff" | "coaching",
  transcript: string,
) {
  await page.goto("/");
  await page.getByRole("radio", { name: callType === "kickoff" ? /kick-off/i : /coaching/i }).check();
  await page.getByLabel("Transcript").fill(transcript);
  await page.getByRole("button", { name: "Evaluate call" }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  return page.url();
}

test("a kick-off run survives refresh, exposes evidence, opens 12 dimensions, and downloads PDF", async ({
  page,
}) => {
  const runUrl = await submit(page, "kickoff", KICKOFF_TRANSCRIPT);

  await page.reload();
  await expect(page).toHaveURL(runUrl);
  await expect(page.getByRole("heading", { name: "Twelve scored dimensions" })).toBeVisible();
  await expect(page.getByText("E2E kickoff evidence", { exact: true }).first()).toBeVisible();

  const dimensions = page.locator(".dimension-list details");
  await expect(dimensions).toHaveCount(12);
  for (const summary of await dimensions.locator("summary").all()) await summary.click();
  expect(await dimensions.evaluateAll((items) => items.every((item) => item.hasAttribute("open")))).toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const pdf = await readFile(downloadPath!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(5_000);
});

test("a coaching run completes after its tab closes and remains usable on mobile", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const submissionPage = await context.newPage();
  const runUrl = await submit(submissionPage, "coaching", COACHING_TRANSCRIPT);
  await submissionPage.close();

  await new Promise((resolve) => setTimeout(resolve, 800));
  const reportPage = await context.newPage();
  await reportPage.setViewportSize({ width: 390, height: 844 });
  await reportPage.goto(runUrl);
  await expect(reportPage.getByRole("heading", { name: "Twelve scored dimensions" })).toBeVisible();
  await expect(reportPage.locator(".dimension-list details")).toHaveCount(12);
  await expect(reportPage.locator(".dimension-list details").nth(1)).toContainText("N/A / 0");
  await expect(reportPage.locator(".dimension-list details").nth(3)).toContainText("N/A / 0");
  expect(
    await reportPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await context.close();
});

test("a failed run is terminal, safe, and stays failed after refresh", async ({ page }) => {
  const statusRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/runs/")) statusRequests.push(request.url());
  });
  const runUrl = await submit(page, "kickoff", FAILURE_TRANSCRIPT);

  await expect(page.getByRole("heading", { name: "The report could not be completed." })).toBeVisible();
  await expect(page.getByText("The evaluation could not be completed. Please try again.")).toBeVisible();
  await expect(page.getByText("E2E_FORCE_FAILURE")).toHaveCount(0);
  const terminalRequestCount = statusRequests.length;
  await page.waitForTimeout(2_500);
  expect(statusRequests).toHaveLength(terminalRequestCount);

  await page.reload();
  await expect(page).toHaveURL(runUrl);
  await expect(page.getByRole("heading", { name: "The report could not be completed." })).toBeVisible();
});
