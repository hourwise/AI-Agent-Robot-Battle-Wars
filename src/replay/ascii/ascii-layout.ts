export const DEFAULT_MAX_WIDTH = 80;
export const ARENA_WIDTH = 52;
export const PORTRAIT_WIDTH = 40;
export const SEPARATOR = "=".repeat(50);
export const RESULT_SEPARATOR = "#".repeat(50);

export const FACING_ARROWS: Record<string, string> = {
  north: "^",
  south: "v",
  east: ">",
  west: "<",
};

export const CONDITION_MARKERS: Record<string, string> = {
  immobilised: "X",
  overturned: "!",
  overheated: "~",
  stunned: "*",
};

export const COMPONENT_PREFIXES: Record<string, string> = {
  mobility: "M-",
  weapon: "W-",
  utility: "U-",
};

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

export function sanitizeName(name: string, maxLength = 20): string {
  let cleaned = removeAnsiSequences(name);
  cleaned = removeControlCharacters(cleaned);
  cleaned = cleaned
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength - 1) + "~";
  }

  return cleaned.length > 0 ? cleaned : "UNKNOWN";
}

export function formatArmourLine(armour: {
  front: number;
  left: number;
  right: number;
  rear: number;
  top: number;
}): string {
  return `F${armour.front} L${armour.left} R${armour.right} RE${armour.rear} T${armour.top}`;
}

export function formatConditionList(conditions: readonly string[]): string {
  if (conditions.length === 0) return "none";
  return conditions.join(", ");
}

export function formatComponentStatus(components: {
  mobilityDisabled: boolean;
  weaponDisabled: boolean;
  utilityDisabled: boolean;
}): string {
  const parts: string[] = [];
  if (components.mobilityDisabled) parts.push("mobility disabled");
  if (components.weaponDisabled) parts.push("weapon disabled");
  if (components.utilityDisabled) parts.push("utility disabled");
  return parts.length > 0 ? parts.join(", ") : "all functional";
}

export function truncateLine(line: string, maxWidth: number): string {
  if (line.length <= maxWidth) return line;
  return line.slice(0, maxWidth - 1) + "~";
}

export function padCenter(text: string, width: number): string {
  if (text.length >= width) return text;
  const totalPad = width - text.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

export function padRight(text: string, width: number): string {
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
}

export function padLeft(text: string, width: number): string {
  if (text.length >= width) return text;
  return " ".repeat(width - text.length) + text;
}
