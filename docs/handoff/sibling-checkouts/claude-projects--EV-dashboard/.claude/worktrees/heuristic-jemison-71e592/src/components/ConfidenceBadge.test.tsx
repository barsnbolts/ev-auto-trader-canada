// Snapshot + behavior tests for ConfidenceBadge (A13).
// If the badge's DOM output changes unintentionally, the snapshot diff surfaces it.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ConfidenceBadge } from "./ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders High with full label and green styling", () => {
    const { container, getByText } = render(<ConfidenceBadge level="High" />);
    expect(getByText("High")).toBeInTheDocument();
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders Medium with full label and amber styling", () => {
    const { container, getByText } = render(<ConfidenceBadge level="Medium" />);
    expect(getByText("Medium")).toBeInTheDocument();
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders Low with full label and red styling", () => {
    const { container, getByText } = render(<ConfidenceBadge level="Low" />);
    expect(getByText("Low")).toBeInTheDocument();
    expect(container.firstChild).toMatchSnapshot();
  });

  it("compact mode renders single-letter label", () => {
    const { getByText } = render(<ConfidenceBadge level="High" compact />);
    expect(getByText("H")).toBeInTheDocument();
  });

  it("has a title attribute naming the confidence level", () => {
    const { container } = render(<ConfidenceBadge level="Medium" />);
    const el = container.querySelector("span");
    expect(el).toHaveAttribute("title", expect.stringContaining("Medium"));
  });
});
