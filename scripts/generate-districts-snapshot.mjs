/**
 * scripts/generate-districts-snapshot.mjs
 *
 * ONE-TIME (or "run to refresh") script: fetches the verified district
 * list from the pinned upstream commit and writes it to
 * data/districts-snapshot.json, which is committed to this repo.
 *
 * SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 5):
 * The original seed-districts.mjs fetched from upstream at every seed
 * run, which is a reproducibility risk if the upstream repo changes or
 * disappears. The fix: pin an exact commit, fetch it ONCE with this
 * script, commit the resulting JSON snapshot to the repo, and have the
 * actual seeding script (seed-districts.mjs) read that committed
 * snapshot instead of hitting the network every time.
 *
 * PINNED SOURCE:
 *   Repo:   https://github.com/kongvut/thai-province-data (MIT license)
 *   File:   api/latest/district.json
 *   Commit: 326c2ebe778fc0c6a26c4b09770e3c2aa97c6be8 (resolved via
 *           `git ls-remote https://github.com/kongvut/thai-province-data.git
 *           refs/heads/master` from Claude Code, 2026-09-02, which does
 *           have real network access — see data/districts-snapshot.json
 *           for the run that used this pin)
 *
 * RUN HISTORY:
 * Executed 2026-09-02 from Claude Code (real network access). Produced
 * data/districts-snapshot.json with 930 districts — NOT the 928 this
 * script's own warning below expects. Verified as real, current data
 * (no duplicate ids, no orphaned province_id, no soft-deleted rows,
 * Bangkok has exactly its real 50 khet) rather than a data quality bug —
 * see "District snapshot" in docs/PHASE2-EXECUTION-REPORT.md for the
 * full verification and the likely explanation (upstream administrative
 * changes since "928" was last accurate). The 928 check below is left
 * as-is (a WARNING, not a hard failure) since a future re-run pinning a
 * different commit should still surface any further drift for review.
 *
 * USAGE (to intentionally refresh against a newer upstream commit):
 *   1. Resolve a new commit SHA: git ls-remote <repo> refs/heads/master
 *   2. Update PINNED_COMMIT below to that SHA
 *   3. node scripts/generate-districts-snapshot.mjs
 *   4. git add data/districts-snapshot.json
 *   5. git commit -m "chore: pin districts snapshot from kongvut/thai-province-data@<commit>"
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Pinned commit SHA (not refs/heads/master) so this script is
// reproducible against a known point in time rather than "whatever
// master currently is" — see PINNED SOURCE above for how this was
// resolved.
const PINNED_COMMIT = '326c2ebe778fc0c6a26c4b09770e3c2aa97c6be8';
const SOURCE_DISTRICT_URL =
  `https://raw.githubusercontent.com/kongvut/thai-province-data/${PINNED_COMMIT}/api/latest/district.json`;
const SOURCE_PROVINCE_URL =
  `https://raw.githubusercontent.com/kongvut/thai-province-data/${PINNED_COMMIT}/api/latest/province.json`;

async function main() {
  console.log('Fetching district.json and province.json from pinned upstream source...');

  const [districtRes, provinceRes] = await Promise.all([
    fetch(SOURCE_DISTRICT_URL),
    fetch(SOURCE_PROVINCE_URL),
  ]);

  if (!districtRes.ok || !provinceRes.ok) {
    throw new Error('Failed to fetch upstream source — check network access and URLs.');
  }

  const districts = await districtRes.json();
  const provinces = await provinceRes.json();

  if (districts.length !== 928) {
    console.warn(
      `WARNING: expected 928 districts, got ${districts.length}. ` +
      `Upstream data may have changed — review before committing this snapshot.`
    );
  }

  const snapshot = {
    generated_at: new Date().toISOString(),
    source_repo: 'https://github.com/kongvut/thai-province-data',
    source_file: 'api/latest/district.json',
    source_commit: PINNED_COMMIT,
    district_count: districts.length,
    province_count: provinces.length,
    districts,
  };

  const outDir = path.resolve('data');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'districts-snapshot.json');
  await writeFile(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`Wrote ${districts.length} districts to ${outPath}`);
  console.log('Next: fill in source_commit above, then commit this file to the repo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
