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

const transcriptField = (page: Page) => page.locator('textarea[name="transcript"]');

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
  await transcriptField(page).fill(transcript);
  await page.getByRole("button", { name: "Evaluate call" }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]{36}$/);
  return page.url();
}

async function expectRunUrl(page: Page) {
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
  const transcript = await readFile(
    join(process.cwd(), "fixtures", "transcripts", "kickoff-01.txt"),
    "utf8",
  );
  await page.goto("/");
  const textarea = transcriptField(page);
  await page.getByLabel("Load example transcript").selectOption("kickoff-01");
  await expect(textarea).toHaveValue(transcript);
  await expect(page.getByRole("radio", { name: /kick-off/i })).toBeChecked();
  await expect(textarea).not.toHaveAttribute("maxlength");
  expect(await textarea.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(190);
  const runUrl = await expectRunUrl(page);
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
  const path = join(process.cwd(), "fixtures", "transcripts", "kickoff-02.txt");
  const transcript = await readFile(path, "utf8");
  await page.goto("/");
  await page.getByLabel("Upload .txt file").setInputFiles(path);
  await expect(transcriptField(page)).toHaveValue(transcript);
  await expectRunUrl(page);
  await expectCompletedReport(page);
  await expect(page.locator(".dimension-list details").first()).toContainText(
    "Pre-Call Preparation",
  );
  await expect(page.locator(".dimension-list details").last()).toContainText(
    "Post-Call Execution",
  );
});

test("dropping a transcript loads its text and shows the source file", async ({
  page,
}) => {
  const transcript = await readFile(
    join(process.cwd(), "fixtures", "transcripts", "kickoff-01.txt"),
    "utf8",
  );
  await page.goto("/");
  const dropzone = page.locator(".file-dropzone");
  const dataTransfer = await page.evaluateHandle((contents) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], "kickoff-01.txt", { type: "text/plain" }));
    return transfer;
  }, transcript);

  await dropzone.dispatchEvent("dragenter", { dataTransfer });
  await expect(dropzone).toHaveAttribute("data-dragging", "true");
  await dropzone.dispatchEvent("drop", { dataTransfer });

  await expect(transcriptField(page)).toHaveValue(transcript);
  await expect(dropzone).toHaveAttribute("data-dragging", "false");
  await expect(page.getByText("kickoff-01.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("33.8 KB", { exact: true })).toBeVisible();
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
