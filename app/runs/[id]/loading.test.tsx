import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LoadingRun from "./loading";

describe("run loading state", () => {
  it("immediately renders the report skeleton before run data arrives", () => {
    const html = renderToStaticMarkup(createElement(LoadingRun));

    expect(html).toContain("Opening the evaluation");
    expect(html).toContain("One change");
    expect(html).toContain("Coach brief");
    expect(html).toContain("Twelve scored dimensions");
    expect(html.match(/class="skeleton-dimension"/g)).toHaveLength(12);
    expect(html.indexOf("Red flags")).toBeGreaterThan(
      html.indexOf("Twelve scored dimensions"),
    );
  });
});
