const markdownSpecialChars = new Set([
  "_",
  "*",
  "[",
  "]",
  "(",
  ")",
  "~",
  "`",
  ">",
  "#",
  "+",
  "-",
  "=",
  "|",
  "{",
  "}",
  ".",
  "!",
]);

export function escapeMarkdown(text: string): string {
  let output = "";
  for (const char of text) {
    output += markdownSpecialChars.has(char) ? `\\${char}` : char;
  }
  return output;
}

export function formatUserMention(
  telegramId: string,
  fallbackName: string,
): string {
  return `[${escapeMarkdown(fallbackName)}](tg://user?id=${telegramId})`;
}

export function normalizeDiscountCode(input: string): string {
  return input.trim().toUpperCase();
}
