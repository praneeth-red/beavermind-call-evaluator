import {
  Children,
  createElement,
  isValidElement,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../app/actions", () => ({
  submitTranscript: vi.fn(),
}));

import { CallTypeChoices } from "./transcript-form";

function radioInputs(node: ReactNode): ReactElement<InputHTMLAttributes<HTMLInputElement>>[] {
  const inputs: ReactElement<InputHTMLAttributes<HTMLInputElement>>[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<InputHTMLAttributes<HTMLInputElement>>(child)) return;
    if (child.type === "input" && child.props.type === "radio") {
      inputs.push(child as ReactElement<InputHTMLAttributes<HTMLInputElement>>);
    }
    inputs.push(...radioInputs(child.props.children as ReactNode));
  });

  return inputs;
}

describe("CallTypeChoices", () => {
  it("renders the selected call type and reports either legal selection", () => {
    const selections: string[] = [];
    const choices = CallTypeChoices({
      value: "coaching",
      onChange: (value) => selections.push(value),
    });
    const html = renderToStaticMarkup(choices);
    const kickoffMarkup = html.match(/<input[^>]+value="kickoff"[^>]*>/)?.[0];
    const coachingMarkup = html.match(/<input[^>]+value="coaching"[^>]*>/)?.[0];

    expect(kickoffMarkup).not.toContain("checked");
    expect(coachingMarkup).toContain("checked");

    const inputs = radioInputs(choices);
    inputs.find(({ props }) => props.value === "kickoff")?.props.onChange?.(
      {} as never,
    );
    inputs.find(({ props }) => props.value === "coaching")?.props.onChange?.(
      {} as never,
    );

    expect(selections).toEqual(["kickoff", "coaching"]);
  });
});
