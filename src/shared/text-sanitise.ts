const ESC = "\x1B";

function removeAnsiSequences(str: string): string {
  let result = str;
  result = result.replace(new RegExp(`${ESC}\\[[0-9;]*[a-zA-Z]`, "g"), "");
  result = result.replace(new RegExp(`${ESC}\\].*?\\x07`, "g"), "");
  result = result.replace(new RegExp(`${ESC}[^\\[\\x00-\\x1F]`, "g"), "");
  return result;
}

function removeControlCharacters(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code !== 0x7f)
    ) {
      result += str[i];
    }
  }
  return result;
}

export function sanitizeTerminalText(text: string): string {
  let cleaned = removeAnsiSequences(text);
  cleaned = removeControlCharacters(cleaned);
  cleaned = cleaned
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

export function sanitizeName(name: string, maxLength = 20): string {
  let cleaned = sanitizeTerminalText(name);
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength - 1) + "~";
  }
  return cleaned.length > 0 ? cleaned : "UNKNOWN";
}
