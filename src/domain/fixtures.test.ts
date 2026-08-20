import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixture = (...parts: string[]) => join(process.cwd(), "fixtures", ...parts);
const readFixture = (...parts: string[]) => {
  const path = fixture(...parts);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

describe("exercise fixtures", () => {
  it("includes both source rubrics", () => {
    expect(existsSync(fixture("rubrics", "kickoff-call-rubric.md"))).toBe(true);
    expect(existsSync(fixture("rubrics", "coaching-call-rubric.md"))).toBe(true);
  });

  it("defines 12 kickoff dimensions", () => {
    const rubric = readFixture("rubrics", "kickoff-call-rubric.md");
    expect(rubric.match(/^### Dimension \d+\b/gm)).toHaveLength(12);
  });

  it("defines 12 coaching dimensions", () => {
    const rubric = readFixture("rubrics", "coaching-call-rubric.md");
    expect(rubric.match(/^### Dimension \d+\b/gm)).toHaveLength(12);
  });

  it("includes all four source transcripts", () => {
    for (const name of ["kickoff-01.txt", "kickoff-02.txt", "coaching-01.txt", "coaching-02.txt"]) {
      expect(existsSync(fixture("transcripts", name)), name).toBe(true);
    }
  });

  it("keeps every nonblank transcript line in [Speaker]: text form", () => {
    for (const name of ["kickoff-01.txt", "kickoff-02.txt", "coaching-01.txt", "coaching-02.txt"]) {
      const lines = readFixture("transcripts", name).split("\n").filter((line) => line.trim());
      for (const line of lines) {
        expect(line, `${name}: ${line}`).toMatch(/^\[[^\]\r\n]+\]: .+$/);
      }
    }
  });

  it("keeps the long coaching fixture at least 64,000 characters", () => {
    expect(readFixture("transcripts", "coaching-02.txt").length).toBeGreaterThanOrEqual(64_000);
  });
});
