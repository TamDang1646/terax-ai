import { describe, expect, it } from "vitest";
import {
  encodeTerminalPaste,
  encodeTerminalSubmission,
  normalizeTerminalInput,
  normalizeTerminalPaste,
} from "./terminalInputEncoding";

// The decomposed (NFD) fixtures below look identical to the composed (NFC) ones
// in an editor. The case that uses them asserts they are still decomposed, so a
// tool that normalizes this file fails loudly instead of quietly reducing that
// case to a comparison of two identical strings.
const DECOMPOSED_E_CIRCUMFLEX_ACUTE = "ế";
const DECOMPOSED_E_ACUTE = "é";
const COMPOSED_E_CIRCUMFLEX_ACUTE = "ế";
const COMPOSED_E_ACUTE = "é";

describe("terminal input encoding", () => {
  it("normalizes every line ending to terminal carriage returns", () => {
    expect(normalizeTerminalPaste("a\r\nb\nc\rd")).toBe("a\rb\rc\rd");
  });

  it("only brackets multiline submissions when the mode is enabled", () => {
    expect(encodeTerminalSubmission("one\ntwo", false)).toBe("one\rtwo\r");
    expect(encodeTerminalSubmission("one\ntwo", true)).toBe(
      "\x1b[200~one\rtwo\x1b[201~\r",
    );
    expect(encodeTerminalSubmission("one", true)).toBe("one\r");
  });

  it("neutralizes escape bytes inside bracketed paste payloads", () => {
    expect(encodeTerminalPaste("a\x1b[201~b", true)).toBe(
      "\x1b[200~a␛[201~b\x1b[201~",
    );
  });
  it("applies the same escape protection to single-line command submissions", () => {
    const command = "echo a\x1b[201~b";
    expect(encodeTerminalSubmission(command, true)).toBe(
      `${encodeTerminalPaste(command, true)}\r`,
    );
  });

  // The command bar can hold pasted text that never passed the input
  // controller, so submission has to compose it as well.
  it("composes submitted commands to NFC before they reach the PTY", () => {
    expect(
      DECOMPOSED_E_CIRCUMFLEX_ACUTE.normalize("NFC"),
      "fixture must stay decomposed",
    ).not.toBe(DECOMPOSED_E_CIRCUMFLEX_ACUTE);
    expect(DECOMPOSED_E_CIRCUMFLEX_ACUTE).not.toBe(COMPOSED_E_CIRCUMFLEX_ACUTE);
    expect(encodeTerminalSubmission(DECOMPOSED_E_CIRCUMFLEX_ACUTE, false)).toBe(
      `${COMPOSED_E_CIRCUMFLEX_ACUTE}\r`,
    );
    expect(encodeTerminalSubmission(DECOMPOSED_E_CIRCUMFLEX_ACUTE, true)).toBe(
      `${COMPOSED_E_CIRCUMFLEX_ACUTE}\r`,
    );
    expect(
      encodeTerminalSubmission(
        `${DECOMPOSED_E_CIRCUMFLEX_ACUTE}${DECOMPOSED_E_ACUTE}`,
        false,
      ),
    ).toBe(`${COMPOSED_E_CIRCUMFLEX_ACUTE}${COMPOSED_E_ACUTE}\r`);
  });

  // Composing these would turn a character the user typed or pasted into a
  // different ASCII character, and the first two are shell metacharacters.
  it("never composes a code point into an ASCII shell metacharacter", () => {
    const protectedCodePoints = [0x037e, 0x1fef, 0x212a];
    for (const codePoint of protectedCodePoints) {
      const character = String.fromCodePoint(codePoint);
      expect(
        character.normalize("NFC"),
        "must be an ASCII-collapsing point",
      ).not.toBe(character);
      expect(normalizeTerminalInput(character)).toBe(character);
    }

    const greekQuestionMark = String.fromCodePoint(0x037e);
    const decomposedEAcute = String.fromCharCode(0x65, 0x301);
    expect(
      normalizeTerminalInput(`${decomposedEAcute}${greekQuestionMark}`),
    ).toBe(`${COMPOSED_E_ACUTE}${greekQuestionMark}`);
    expect(
      normalizeTerminalInput(
        `echo ${decomposedEAcute}${greekQuestionMark} rm -rf`,
      ),
    ).toBe(`echo ${COMPOSED_E_ACUTE}${greekQuestionMark} rm -rf`);
  });
});
