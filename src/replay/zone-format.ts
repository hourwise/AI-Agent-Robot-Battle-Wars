/**
 * Human-readable zone formatting shared by text replay and ASCII moment
 * narration. Works for both the legacy five-zone values ("north_edge" →
 * "North Edge") and the 3×3 grid values ("north_west" → "North West").
 */
export function formatZoneName(zone: string): string {
  return zone
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
