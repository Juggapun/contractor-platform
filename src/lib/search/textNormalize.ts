/**
 * Search Intelligence MVP (Issue #40) — shared text normalization for
 * comparing a raw typed query against category names/synonym keys.
 * Trims and collapses internal whitespace only; deliberately does NOT
 * lowercase or strip characters, since the comparison set here is Thai
 * text with no case concept and every real category name/synonym key is
 * already written without extra internal whitespace.
 */
export function normalizeSearchText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}
