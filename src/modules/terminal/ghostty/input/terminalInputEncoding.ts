export function normalizeTerminalPaste(text: string): string {
  return text.replace(/\r\n|\r|\n/g, "\r");
}

/**
 * The only three code points whose NFC form is ASCII: U+037E becomes ";",
 * U+1FEF becomes a backtick, U+212A becomes "K". Composing them would rewrite a
 * character the user typed or pasted into a different ASCII character, and the
 * first two are shell metacharacters. They pass through untouched.
 */
const ASCII_COLLAPSING = new RegExp(
  `([${String.fromCharCode(0x037e, 0x1fef, 0x212a)}])`,
);

/**
 * Terminal input is sent composed (NFC) so one glyph occupies one code point.
 * macOS delivers accented input decomposed (NFD), and sending that form reaches
 * full-screen programs as two or three code points, which breaks their column
 * arithmetic. ASCII is unaffected: normalizing it is the identity.
 */
export function normalizeTerminalInput(text: string): string {
  if (!ASCII_COLLAPSING.test(text)) return text.normalize("NFC");
  return text
    .split(ASCII_COLLAPSING)
    .map((part, index) => (index % 2 === 0 ? part.normalize("NFC") : part))
    .join("");
}

export function encodeTerminalPaste(
  text: string,
  bracketedPaste: boolean,
): string {
  const normalized = normalizeTerminalPaste(text);
  if (!bracketedPaste) return normalized;
  return `\x1b[200~${normalized.split("\x1b").join("␛")}\x1b[201~`;
}

export function encodeTerminalSubmission(
  text: string,
  bracketedPaste: boolean,
): string {
  // The shared command bar submits whatever its editor holds, which can be
  // pasted text that never passed through the input controller. Composing here
  // keeps every command that reaches the PTY in the same form.
  const normalized = normalizeTerminalPaste(normalizeTerminalInput(text));
  const payload =
    normalized.includes("\r") || normalized.includes("\x1b")
      ? encodeTerminalPaste(normalized, bracketedPaste)
      : normalized;
  return `${payload}\r`;
}
