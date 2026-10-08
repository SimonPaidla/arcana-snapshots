'use strict';
/**
 * Judges a pull request into main. Runs in CI from main's checkout
 * (`.github/workflows/pull-request.yml`); the pull request's files are read
 * as data from HEAD_REF with git, never from the working tree.
 *
 * Accepted: new regular files, each a crawl or a part named after its
 * crawl time, that the validator of `validate.js` passes within
 * STORE_MAX_AGE_DAYS - a crawl also against the COMPARE_DEPTH newest
 * crawls on the target branch.
 *
 *   snapshots/<time>.json               a crawl of the cards
 *   items/type-<id>/<time>.json         a part of items: one item type
 *   items/ids/<time>-<list>.json        a part of items: a list of item IDs
 *
 * Everything else is refused: a modified, deleted or renamed file, another
 * path, a symbolic link, an executable file, a submodule, a file above
 * MAX_FILE_BYTES, a file the validator throws on.
 *
 *   BASE_REF  the archive the contribution is compared to (default origin/main)
 *   HEAD_REF  the pull request's head commit (default HEAD)
 */

const { execFileSync } = require('child_process');
const {
  validateSnapshot, knownOf, cardCountOf, validateItemSnapshot, itemCountOf, isItemPath, STORE_MAX_AGE_DAYS,
} = require('./validate.js');

/** The newest crawls on the target branch a new crawl is compared to. */
const COMPARE_DEPTH = 10;

/** The largest file read. */
const MAX_FILE_BYTES = 16 * 1024 * 1024;

/** git's mode of a regular file without the executable bit. */
const REGULAR_FILE = '100644';

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 4 * MAX_FILE_BYTES });

const problems = [];
const complain = (t) => { problems.push(t); };

/** The files the pull request changes against the merge base, with their status letter. */
function changedFiles(base, head) {
  const fields = git('diff', '--name-status', '--no-renames', '-z', `${base}...${head}`).split('\0');
  const changed = [];
  for (let i = 0; i + 1 < fields.length; i += 2) changed.push({ status: fields[i], file: fields[i + 1] });
  return changed;
}

/** Every crawl and part path on the target branch. */
function existingPaths(base) {
  return git('ls-tree', '-r', '-z', '--name-only', base).split('\0')
    .filter((f) => (f.startsWith('snapshots/') || f.startsWith('items/')) && f.endsWith('.json'));
}

/**
 * The newest COMPARE_DEPTH of `files` on the target branch, read with
 * `read` into comparison entries, oldest first. A file `read` does not
 * take (another schema) or that does not parse is left out.
 */
function comparison(base, files, read) {
  const known = [];
  for (const p of [...files].sort().slice(-COMPARE_DEPTH)) {
    try {
      const entry = read(JSON.parse(git('show', `${base}:${p}`)));
      if (entry) known.push(entry);
    } catch { /* left out */ }
  }
  return known.sort((a, b) => String(a.crawledAt).localeCompare(String(b.crawledAt)));
}

/** A file of the head commit as JSON: a regular file of at most MAX_FILE_BYTES, else a complaint and null. */
function readJson(head, file) {
  try {
    const [mode, type] = git('ls-tree', head, '--', file).split(/\s+/);
    if (mode !== REGULAR_FILE || type !== 'blob') {
      complain(`\`${file}\`: not a regular file without the executable bit (mode ${mode}).`);
      return null;
    }
    const size = Number(git('cat-file', '-s', `${head}:${file}`));
    if (size > MAX_FILE_BYTES) {
      complain(`\`${file}\`: ${size} bytes, above the limit of ${MAX_FILE_BYTES}.`);
      return null;
    }
    return { data: JSON.parse(git('show', `${head}:${file}`)) };
  } catch (err) {
    complain(`\`${file}\`: not readable JSON (${err.message.split('\n')[0]}).`);
    return null;
  }
}

/** A validator's verdict; one that throws is a refusal. */
function validated(file, validate) {
  try {
    return validate();
  } catch (err) {
    return { ok: false, errors: [`not judged (${String(err && err.message).split('\n')[0]})`], warnings: [] };
  }
}

/** Records a validator's errors as complaints and its first warnings as annotations; whether it passed. */
function judged(file, result) {
  for (const e of result.errors) complain(`\`${file}\`: ${e}`);
  for (const w of result.warnings.slice(0, 5)) console.log(`::warning file=${file}::${w}`);
  return result.ok;
}

function main() {
  const base = process.env.BASE_REF || 'origin/main';
  const head = process.env.HEAD_REF || 'HEAD';

  const changed = changedFiles(base, head);
  if (!changed.length) {
    complain('The pull request changes nothing.');
    return report();
  }

  // Additions only, each a crawl or a part.
  const crawls = [];
  const parts = [];
  for (const { status, file } of changed) {
    if (status !== 'A') {
      const what = status === 'M' ? 'is modified' : status === 'D' ? 'is deleted' : `has status ${status}`;
      complain(`\`${file}\`: ${what}. A contribution only adds new files.`);
      continue;
    }
    const segments = file.split('/');
    if (segments.length === 2 && segments[0] === 'snapshots' && file.endsWith('.json')) {
      crawls.push({ file, name: segments[1] });
    } else if (isItemPath(file)) {
      parts.push({ file });
    } else {
      complain(`\`${file}\` is neither a crawl directly under \`snapshots/\` nor a part under \`items/\`.`);
    }
  }
  if (!crawls.length && !parts.length) return report();

  const existing = existingPaths(base);
  const exists = new Set(existing);

  // Crawls of the cards, against the newest crawls on the target branch.
  const known = comparison(base, existing.filter((p) => p.startsWith('snapshots/')), knownOf);
  for (const entry of crawls.sort((a, b) => a.name.localeCompare(b.name))) {
    if (exists.has(entry.file)) {
      complain(`\`${entry.file}\` already exists.`);
      continue;
    }
    const read = readJson(head, entry.file);
    if (!read) continue;
    const result = validated(entry.file, () => validateSnapshot(read.data, { fileName: entry.name, known, maxAgeDays: STORE_MAX_AGE_DAYS }));
    if (judged(entry.file, result)) {
      console.log(`  ${entry.file}: ${cardCountOf(read.data)} cards, ${read.data.offerCount} offers - fine`);
      known.push(knownOf(read.data));
    }
  }

  // Parts of items: each path once per hour and folder, judged on its own.
  for (const entry of parts.sort((a, b) => a.file.localeCompare(b.file))) {
    if (exists.has(entry.file)) {
      complain(`\`${entry.file}\` already exists.`);
      continue;
    }
    const read = readJson(head, entry.file);
    if (!read) continue;
    const result = validated(entry.file, () => validateItemSnapshot(read.data, { path: entry.file, maxAgeDays: STORE_MAX_AGE_DAYS }));
    if (judged(entry.file, result)) {
      console.log(`  ${entry.file}: ${itemCountOf(read.data)} items, ${read.data.offerCount} offers - fine`);
    }
  }
  return report(crawls.length + parts.length);
}

/** Prints the verdict; the exit code. */
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
