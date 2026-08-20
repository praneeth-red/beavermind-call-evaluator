import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  label: "kickoff-01" | "kickoff-02" | "coaching-01" | "coaching-02";
  callType: "kickoff" | "coaching";
};

const fixtures: Fixture[] = [
  { label: "kickoff-01", callType: "kickoff" },
  { label: "kickoff-02", callType: "kickoff" },
  { label: "coaching-01", callType: "coaching" },
  { label: "coaching-02", callType: "coaching" },
];

async function removeTestStore() {
  const path = process.env.EVALUATOR_TEST_STORE;
  if (!path) throw new Error("EVALUATOR_TEST_STORE is not configured");
  await unlink(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

test.beforeAll(removeTestStore);
test.afterAll(removeTestStore);

async function submit(page: Page, fixture: Fixture) {
  const transcript = await readFile(
    join(process.cwd(), "fixtures", "transcripts", `${fixture.label}.txt`),
    "utf8",
  );
  await page.goto("/");
  await page.getByRole("radio", {
    name: fixture.callType === "kickoff" ? /kick-off/i : /coaching/i,
  }).check();
  await page.getByLabel("Transcript").fill(transcript);
  await page.getByRole("button", { name: "Evaluate call" }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  return page.url();
}

async function expectCompletedReport(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Twelve scored dimensions" }),
  ).toBeVisible();
  await expect(page.locator(".dimension-list details")).toHaveCount(12);
}

test("kickoff-01 completes from the pinned fixture, survives refresh, and downloads PDF", async ({
  page,
}) => {
  const runUrl = await submit(page, fixtures[0]);
  await page.reload();
  await expect(page).toHaveURL(runUrl);
  await expectCompletedReport(page);

  const dimensions = page.locator(".dimension-list details");
  for (const summary of await dimensions.locator("summary").all()) await summary.click();
  expect(
    await dimensions.evaluateAll((items) =>
      items.every((item) => item.hasAttribute("open")),
    ),
  ).toBe(true);

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

test("kickoff-02 completes from the pinned fixture with all 12 canonical dimensions", async ({
  page,
}) => {
  await submit(page, fixtures[1]);
  await expectCompletedReport(page);
  await expect(page.locator(".dimension-list details").first()).toContainText(
    "Pre-Call Preparation",
  );
  await expect(page.locator(".dimension-list details").last()).toContainText(
    "Post-Call Execution",
  );
});

test("coaching-01 completes after its tab closes and keeps D10 at zero", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const submissionPage = await context.newPage();
  const runUrl = await submit(submissionPage, fixtures[2]);
  await submissionPage.close();

  const reportPage = await context.newPage();
  await reportPage.goto(runUrl);
  await expectCompletedReport(reportPage);
  await expect(reportPage.locator(".dimension-list details").nth(9)).toContainText(
    "0 / 5",
  );
  await expect(reportPage.getByText("Next call was not booked live.")).toBeVisible();
  await context.close();
});

test("coaching-02 completes from the pinned 64,801-byte fixture with its traps on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submit(page, fixtures[3]);
  await expectCompletedReport(page);
  const dimensions = page.locator(".dimension-list details");
  await expect(dimensions.nth(1)).toContainText("N/A / 0");
  await expect(dimensions.nth(3)).toContainText("N/A / 0");
  await expect(dimensions.nth(9)).toContainText("5 / 5");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
