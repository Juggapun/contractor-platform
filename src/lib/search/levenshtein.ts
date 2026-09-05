/**
 * Search Intelligence MVP (Issue #40) — plain Levenshtein edit distance.
 * Hand-rolled rather than a new dependency (the issue explicitly asks
 * to avoid adding a heavy one for this MVP): it's a few dozen lines,
 * well-understood, and matches the exact shape of the typo examples in
 * the issue (ต่อเดิม/ต่อเติ่ม/ต่อเต้ม are each a single
 * insertion/substitution away from ต่อเติม — one edit, not several).
 *
 * Works on JS string indices (UTF-16 code units), not grapheme
 * clusters. That's fine here: every Thai character this app's own
 * catalog/synonym data uses (base consonants, vowels, tone marks) is a
 * single code unit with no surrogate pairs, so code-unit distance and
 * "number of visually-typed keystrokes different" coincide for this
 * data. Not claimed to be correct for text requiring full Unicode
 * grapheme segmentation (e.g. some emoji) — not a case this module is
 * ever fed.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prevRow = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const currRow = [i];
    for (let j = 1; j <= lb; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      // Non-null assertions below: j/i-1 are always within
      // [0, lb]/[0, la] by the loop bounds above, so these indices are
      // always populated — noUncheckedIndexedAccess just can't see that
      // invariant from a plain numeric for-loop.
      currRow[j] = Math.min(
        currRow[j - 1]! + 1, // insertion
        prevRow[j]! + 1, // deletion
        prevRow[j - 1]! + substitutionCost // substitution
      );
    }
    prevRow = currRow;
  }
  return prevRow[lb]!;
}
