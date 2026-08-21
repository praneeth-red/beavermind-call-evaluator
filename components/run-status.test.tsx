import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { RunStatus } from "./run-status";

describe("RunStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the shape of the final report while an evaluation is processing", () => {
    const html = renderToStaticMarkup(
      createElement(RunStatus, {
        id: "9f6fd561-7d5d-45bf-a1c9-88ecb891db5e",
        initialStatus: "processing",
        publicError: null,
      }),
    );

    expect(html).toContain("Reviewing transcript evidence");
    expect(html).toContain("One change");
    expect(html).toContain("Coach brief");
    expect(html).toContain("Twelve scored dimensions");
    expect(html.match(/class="skeleton-dimension"/g)).toHaveLength(12);
    expect(html.indexOf("Red flags")).toBeGreaterThan(
      html.indexOf("Twelve scored dimensions"),
    );
  });
});
