import {
  Children,
  createElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../app/actions", () => ({
  submitTranscript: vi.fn(),
}));

import * as formComponents from "./transcript-form";

const { CallTypeChoices } = formComponents;
const ExampleChoices = (formComponents as typeof formComponents & {
  ExampleChoices?: (props: { onSelect: (value: string) => void }) => ReactElement;
}).ExampleChoices;

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

function buttons(node: ReactNode): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[] {
  const matches: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(child)) return;
    if (child.type === "button") {
      matches.push(child as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>);
    }
    matches.push(...buttons(child.props.children as ReactNode));
  });

  return matches;
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

describe("ExampleChoices", () => {
  it("dispatches each exact example value from one direct button click", () => {
    expect(ExampleChoices).toBeTypeOf("function");
    if (!ExampleChoices) return;

    const selections: string[] = [];
    const choices = ExampleChoices({ onSelect: (value) => selections.push(value) });
    const choiceButtons = buttons(choices);

    expect(choiceButtons).toHaveLength(4);
    expect(choiceButtons.map(({ props }) => props.value)).toEqual([
      "kickoff-01",
      "kickoff-02",
      "coaching-01",
      "coaching-02",
    ]);
    expect(choiceButtons.every(({ props }) => props.type === "button")).toBe(true);

    for (const button of choiceButtons) button.props.onClick?.({} as never);

    expect(selections).toEqual([
      "kickoff-01",
      "kickoff-02",
      "coaching-01",
      "coaching-02",
    ]);
  });
});
