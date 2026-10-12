import type { TerminalCursor } from "@/modules/terminal/backend/contracts";
import type { Rgb } from "@/modules/terminal/ghostty/core/packedCells";
import {
  rgbToCss,
  type TerminalFontMetrics,
} from "@/modules/terminal/ghostty/gpu/terminalVisuals";

export type TerminalPreeditInputOptions = {
  readonly input: HTMLTextAreaElement;
  readonly metrics: () => TerminalFontMetrics;
  readonly cursor: () => TerminalCursor;
  readonly foreground: () => Rgb;
  readonly cellSize: () => { readonly width: number; readonly height: number };
  readonly cols: () => number;
};

/**
 * Every property this helper writes, and therefore every one it restores. They
 * are set individually rather than through `style.cssText` for two reasons:
 * `position`, `resize` and `pointer-events` belong to the surface and to the
 * native-selection helper that also drives this textarea, so writing the whole
 * attribute would overwrite state this helper does not own; and `setProperty`
 * discards a value it cannot parse, so a font family carrying a `;` cannot
 * introduce a declaration.
 */
const OWNED_PROPERTIES = [
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
] as const;

/**
 * The terminal keeps a 1x1, fully transparent textarea for keyboard capture, so
 * an input method draws the text being composed into an element nobody can see.
 * While a composition is open this moves that textarea onto the cursor cell and
 * reveals it, which lets the webview render the marked text itself, with its own
 * underline, and anchor its candidate window to a caret that is where the user
 * is actually typing.
 *
 * The text is left to the webview on purpose. Rebuilding it in the renderer
 * would mean teaching the terminal core about input methods, which it has no
 * access to: composition events only ever reach the DOM.
 */
export class TerminalPreeditInput {
  private readonly original = new Map<string, string>();
  private active = false;

  constructor(private readonly options: TerminalPreeditInputOptions) {
    // Captured here rather than on first use: at this point the surface has
    // just written its own base style and nothing else has touched the element.
    for (const property of OWNED_PROPERTIES) {
      this.original.set(
        property,
        options.input.style.getPropertyValue(property),
      );
    }
  }

  show(): void {
    const { input, metrics, cursor, foreground, cellSize, cols } = this.options;
    const cell = cellSize();
    if (cell.width <= 0 || cell.height <= 0) return;
    const at = cursor();
    const font = metrics().font;
    const remaining = Math.max(1, cols() - at.x);
    const style = input.style;

    style.setProperty("left", `${at.x * cell.width}px`);
    style.setProperty("top", `${at.y * cell.height}px`);
    style.setProperty("width", `${remaining * cell.width}px`);
    style.setProperty("height", `${cell.height}px`);
    style.setProperty("opacity", "1");
    // No z-index: the textarea is already positioned, and the canvas is not, so
    // it paints above without one. Leaving the property alone keeps this helper
    // out of the stacking context the native-selection helper also uses.
    style.setProperty("font-family", font.family);
    style.setProperty("font-size", `${font.size}px`);
    style.setProperty("font-weight", font.weight);
    style.setProperty("line-height", `${cell.height}px`);
    style.setProperty("letter-spacing", `${font.letterSpacing}px`);
    style.setProperty("color", rgbToCss(foreground()));
    // The terminal already draws its own cursor at this cell; a second one
    // inside the textarea would sit on top of it.
    style.setProperty("caret-color", "transparent");
    style.setProperty("background-color", "transparent");
    style.setProperty("border", "0");
    style.setProperty("outline", "none");
    style.setProperty("padding", "0");
    style.setProperty("margin", "0");
    style.setProperty("white-space", "pre");
    style.setProperty("overflow", "hidden");

    this.active = true;
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    const style = this.options.input.style;
    for (const property of OWNED_PROPERTIES) {
      // Removing a declaration leaves the browser default in place, and the
      // default for opacity is 1, which would park a visible textarea over the
      // terminal. Every other owned property is asserted by the surface's base
      // style, but this one fails visibly, so it keeps an explicit fallback.
      const original =
        this.original.get(property) || (property === "opacity" ? "0" : "");
      if (original) style.setProperty(property, original);
      else style.removeProperty(property);
    }
  }
}
