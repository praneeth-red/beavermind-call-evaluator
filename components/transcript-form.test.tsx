import {
  Children,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../app/actions", () => ({
  submitTranscript: vi.fn(),
}));

import * as formComponents from "./transcript-form";

const { CallTypeChoices } = formComponents;
const ExampleChoices = (formComponents as typeof formComponents & {
  ExampleChoices?: (props: {
    onSelect: (value: string | null) => void;
    selected?: string | null;
  }) => ReactElement;
}).ExampleChoices;

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
  it("reports null when the selected call type is clicked again", () => {
    const selections: Array<string | null> = [];
    const choices = CallTypeChoices({
      value: "coaching",
      onChange: (value) => selections.push(value),
    });
    const choiceButtons = buttons(choices);

    expect(choiceButtons.map(({ props }) => props["aria-pressed"])).toEqual([
      false,
      true,
    ]);
    for (const button of choiceButtons) button.props.onClick?.({} as never);

    expect(selections).toEqual(["kickoff", null]);
  });
});

describe("ExampleChoices", () => {
  it("reports null when the selected example is clicked again", () => {
    expect(ExampleChoices).toBeTypeOf("function");
    if (!ExampleChoices) return;

    const selections: Array<string | null> = [];
    const choices = ExampleChoices({
      onSelect: (value) => selections.push(value),
      selected: "kickoff-01",
    });
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
      null,
      "kickoff-02",
      "coaching-01",
      "coaching-02",
    ]);
  });
});
