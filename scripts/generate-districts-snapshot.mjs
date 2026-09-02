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
 *   Commit: <FILL IN — run `git ls-remote` or check the repo's commit
 *            history for the exact commit SHA in use at the time this
 *            script is run, and paste it here so future re-runs of this
 *            script are auditable against what changed upstream>
 *
 * IMPORTANT — WHY THIS SCRIPT HAS NOT BEEN RUN YET:
 * This script must be run somewhere with real internet access (this
 * PHASE 2 development sandbox has none). It has NOT been executed as
 * part of PHASE 2 — data/districts-snapshot.json does not exist in this
 * deliverable yet. Running it (ideally from Claude Code, which does have
 * network access) and committing the resulting file is a required step
 * before seed-districts.mjs can be run for real. This is flagged
 * explicitly rather than applied silently — see the PHASE 2 security
 * review report.
 *
 * USAGE (once network access is available):
 *   node scripts/generate-districts-snapshot.mjs
 *   git add data/districts-snapshot.json
 *   git commit -m "chore: pin districts snapshot from kongvut/thai-province-data@<commit>"
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// TODO: replace 'refs/heads/master' with a pinned commit SHA once this
// script is actually run, so re-runs are reproducible against a known
// point in time rather than "whatever master currently is".
const SOURCE_DISTRICT_URL =
  'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/district.json';
const SOURCE_PROVINCE_URL =
  'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province.json';

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
    source_commit: 'TODO — fill in the commit SHA used for this fetch',
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
