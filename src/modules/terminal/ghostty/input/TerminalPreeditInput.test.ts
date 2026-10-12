import { describe, expect, it } from "vitest";
import { TerminalPreeditInput } from "./TerminalPreeditInput";
import type { TerminalPreeditInputOptions } from "./TerminalPreeditInput";

/** The style the surface writes on the keyboard textarea before anything else. */
const BASE_STYLE: Record<string, string> = {
  position: "absolute",
  left: "0px",
  top: "0px",
  width: "1px",
  height: "1px",
  opacity: "0",
  resize: "none",
  "pointer-events": "none",
};

const METRICS = {
  font: {
    family: "Test Mono, monospace",
    size: 14,
    lineHeight: 1.2,
    letterSpacing: 0,
    weight: "400",
  },
  cellWidth: 10,
  cellHeight: 20,
  baseline: 15,
};

function fakeStyle(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getPropertyValue: (property: string) => values.get(property) ?? "",
    setProperty: (property: string, value: string) => {
      values.set(property, value);
    },
    removeProperty: (property: string) => {
      values.delete(property);
    },
  };
}

function harness(overrides: Partial<TerminalPreeditInputOptions> = {}) {
  const style = fakeStyle(BASE_STYLE);
  const input = { style } as unknown as HTMLTextAreaElement;
  const preedit = new TerminalPreeditInput({
    input,
    metrics: () => METRICS,
    cursor: () => ({
      x: 3,
      y: 2,
      visible: true,
      blinking: true,
      style: "block",
    }),
    foreground: () => [200, 210, 220],
    cellSize: () => ({ width: METRICS.cellWidth, height: METRICS.cellHeight }),
    cols: () => 80,
    ...overrides,
  });
  return { style, preedit };
}

describe("TerminalPreeditInput", () => {
  it("places the composition on the cursor cell and reveals it", () => {
    const { style, preedit } = harness();
    preedit.show();

    expect(style.getPropertyValue("left")).toBe("30px");
    expect(style.getPropertyValue("top")).toBe("40px");
    expect(style.getPropertyValue("width")).toBe("770px");
    expect(style.getPropertyValue("height")).toBe("20px");
    expect(style.getPropertyValue("opacity")).toBe("1");
    expect(style.getPropertyValue("font-family")).toBe("Test Mono, monospace");
    expect(style.getPropertyValue("font-size")).toBe("14px");
    expect(style.getPropertyValue("line-height")).toBe("20px");
    expect(style.getPropertyValue("color")).toBe("rgb(200 210 220)");
    // The terminal draws its own cursor here; a second caret would overlap it.
    expect(style.getPropertyValue("caret-color")).toBe("transparent");
  });

  it("never writes a property it does not own", () => {
    const { style, preedit } = harness();
    const before = new Map(style.values);
    preedit.show();

    for (const property of style.values.keys()) {
      if (before.has(property)) continue;
      expect(
        [
          "left",
          "top",
          "width",
          "height",
          "opacity",
          "font-family",
          "font-size",
          "font-weight",
          "line-height",
          "letter-spacing",
          "color",
          "caret-color",
          "background-color",
          "border",
          "outline",
          "padding",
          "margin",
          "white-space",
          "overflow",
        ],
        `wrote unowned property ${property}`,
      ).toContain(property);
    }
  });

  it("leaves the surface's and the native selection's properties alone", () => {
    const { style, preedit } = harness();
    preedit.show();
    expect(style.getPropertyValue("position")).toBe("absolute");
    expect(style.getPropertyValue("pointer-events")).toBe("none");
    expect(style.getPropertyValue("resize")).toBe("none");
  });

  it("restores every property it owns and nothing else", () => {
    const { style, preedit } = harness();
    preedit.show();
    // Something else drives this element too; ours must not touch it.
    style.setProperty("pointer-events", "auto");
    style.setProperty("z-index", "20");
    preedit.hide();

    for (const property of ["left", "top", "width", "height", "opacity"]) {
      expect(style.getPropertyValue(property), property).toBe(
        BASE_STYLE[property],
      );
    }
    expect(style.getPropertyValue("font-family")).toBe("");
    expect(style.getPropertyValue("caret-color")).toBe("");
    expect(style.getPropertyValue("z-index")).toBe("20");
    // Owned by the native-selection helper, restored by it, not by us.
    expect(style.getPropertyValue("pointer-events")).toBe("auto");
    expect(style.getPropertyValue("position")).toBe("absolute");
  });

  it("survives repeated compositions", () => {
    const { style, preedit } = harness();
    preedit.show();
    preedit.hide();
    preedit.show();
    preedit.hide();
    expect(style.getPropertyValue("opacity")).toBe("0");
    expect(style.getPropertyValue("width")).toBe("1px");
  });

  it("repositions on a later composition at a different cell", () => {
    let column = 3;
    const { style, preedit } = harness({
      cursor: () => ({
        x: column,
        y: 2,
        visible: true,
        blinking: true,
        style: "block",
      }),
    });
    preedit.show();
    expect(style.getPropertyValue("left")).toBe("30px");
    preedit.hide();
    column = 7;
    preedit.show();
    expect(style.getPropertyValue("left")).toBe("70px");
  });

  it("follows the theme rather than the theme it was built with", () => {
    let foreground: readonly [number, number, number] = [10, 10, 10];
    const { style, preedit } = harness({ foreground: () => foreground });
    preedit.show();
    expect(style.getPropertyValue("color")).toBe("rgb(10 10 10)");
    foreground = [240, 240, 240];
    preedit.show();
    expect(style.getPropertyValue("color")).toBe("rgb(240 240 240)");
  });

  // Only covers this helper: a family carrying a separator reaches
  // setProperty as one opaque value and cannot add a property here. The value
  // itself is discarded by the browser's parser, which this fake does not
  // reproduce.
  it("cannot introduce a declaration through the font family", () => {
    const family = "Foo, monospace;position:fixed";
    const { style, preedit } = harness({
      metrics: () => ({ ...METRICS, font: { ...METRICS.font, family } }),
    });
    preedit.show();
    expect(style.getPropertyValue("font-family")).toBe(family);
    expect(style.getPropertyValue("position")).toBe("absolute");
  });

  it("does nothing when the cell has no size yet", () => {
    const { style, preedit } = harness({
      cellSize: () => ({ width: 0, height: 0 }),
    });
    preedit.show();
    expect(style.getPropertyValue("opacity")).toBe("0");
    expect(style.getPropertyValue("left")).toBe("0px");
  });

  it("hides without a prior show without touching the element", () => {
    const { style, preedit } = harness();
    preedit.hide();
    expect(style.getPropertyValue("opacity")).toBe("0");
    expect(style.getPropertyValue("pointer-events")).toBe("none");
  });
});
