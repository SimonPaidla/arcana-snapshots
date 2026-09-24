'use strict';
/**
 * Checks a pull request before it is merged.
 *
 * Runs in CI. Whatever passes here lands in the shared data; there is no
 * second instance. The check is therefore written defensively: anything
 * not explicitly allowed is rejected.
 *
 * Exactly one thing is allowed: one or more NEW files directly under
 * snapshots/, named after their timestamp.
 *
 * Snapshots are anonymous - nothing records who sent one, and with a
 * single GitHub account behind all the tokens the platform could not tell
 * them apart anyway. That makes these checks the only line of defence:
 * a bad file cannot be traced back and removed afterwards.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { validateSnapshot, knownOf, cardCountOf } = require('./validate.js');

// How many earlier runs are read for the plausibility check. Reading all of
// them would be a quarter of a gigabyte after a year.
const COMPARE_DEPTH = 10;

// A timestamp older than this belongs to the existing archive and is
// seeded by hand, not through a pull request.
const MAX_AGE_DAYS = 30;

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8' }).trim();

const problems = [];
const complain = (t) => { problems.push(t); };

function changedFiles(base, head) {
  const raw = git('diff', '--name-status', '--no-renames', `${base}...${head}`);
  return raw.split('\n').filter(Boolean).map((line) => {
    const [status, file] = line.split('\t');
    return { status, file };
  });
}

/** Every snapshot path that already exists on the target branch. */
function existingPaths(base) {
  const raw = git('ls-tree', '-r', '--name-only', base);
  return raw.split('\n').filter((f) => f.startsWith('snapshots/') && f.endsWith('.json'));
}

function main() {
  const base = process.env.BASE_REF || 'origin/main';
  const head = process.env.HEAD_REF || 'HEAD';

  const changed = changedFiles(base, head);
  if (!changed.length) {
    complain('The pull request changes nothing.');
    return report();
  }

  // --- Additions only, and only inside the snapshot folder --------------
  const accepted = [];
  for (const { status, file } of changed) {
    if (status !== 'A') {
      const what = status === 'M' ? 'is modified'
        : status === 'D' ? 'is deleted' : `has status ${status}`;
      complain(`\`${file}\`: ${what}. A contribution only adds new files.`);
      continue;
    }
    const parts = file.split('/');
    if (parts.length !== 2 || parts[0] !== 'snapshots' || !file.endsWith('.json')) {
      complain(`\`${file}\` is not directly under \`snapshots/\` as a .json file.`);
      continue;
    }
    accepted.push({ file, name: parts[1] });
  }
  if (!accepted.length) return report();

  // --- Comparison material from the target branch -----------------------
  const existing = new Set(existingPaths(base));
  const known = [];
  // A file of another schema is no comparison material. The fingerprint
  // refuses a run identical to one already here: it carries nothing new
  // and skews every figure that counts crawls.
  for (const p of [...existing].sort().slice(-COMPARE_DEPTH)) {
    try {
      const entry = knownOf(JSON.parse(git('show', `${base}:${p}`)));
      if (entry) known.push(entry);
    } catch { /* an unreadable older file must not stall the check */ }
  }
  known.sort((a, b) => String(a.crawledAt).localeCompare(String(b.crawledAt)));

  // --- Each file on its own --------------------------------------------
  for (const entry of accepted.sort((a, b) => a.name.localeCompare(b.name))) {
    if (existing.has(entry.file)) {
      complain(`\`${entry.file}\` already exists.`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(process.cwd(), entry.file), 'utf-8'));
    } catch (err) {
      complain(`\`${entry.file}\`: not readable JSON (${err.message}).`);
      continue;
    }

    const result = validateSnapshot(data, {
      fileName: entry.name,
      known,
      maxAgeDays: MAX_AGE_DAYS,
    });
    for (const e of result.errors) complain(`\`${entry.file}\`: ${e}`);
    for (const w of result.warnings.slice(0, 5)) {
      console.log(`::warning file=${entry.file}::${w}`);
    }
    if (result.ok) {
      console.log(`  ${entry.file}: ${cardCountOf(data)} cards, `
        + `${data.offerCount} offers - fine`);
      // A file that passed counts as comparison material for the next one.
      known.push(knownOf(data));
    }
  }
  return report(accepted.length);
}

function report(count = 0) {
  if (!problems.length) {
    console.log(`\nChecked ${count} ${count === 1 ? 'file' : 'files'}, nothing to report.`);
    return 0;
  }
  console.log('\nThis contribution is not accepted:\n');
  for (const p of problems) console.log(`  - ${p}`);
  for (const p of problems) console.log(`::error::${p}`);
  return 1;
}

process.exit(main());
