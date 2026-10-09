'use strict';
/**
 * Judges a pull request into main. Runs in CI from main's checkout
 * (`.github/workflows/pull-request.yml`); the pull request's files are read
 * as data from HEAD_REF with git, never from the working tree.
 *
 * Accepted: new regular files of one crawl time, each a crawl or a part
 * named after it, that the validator of `validate.js` passes within
 * STORE_MAX_AGE_DAYS - a crawl also against the COMPARE_DEPTH newest
 * crawls on the target branch:
 *
 *   snapshots/<time>.json               a crawl of the cards
 *   items/type-<id>/<time>.json         a part of items: one item type
 *   items/ids/<time>-<list>.json        a part of items: a list of item IDs
 *
 * At most MAX_FILES files, at most ID_LISTS_PER_CONTRIBUTION lists of item
 * IDs, and no more than ID_LISTS_PER_HOUR lists of one crawl time with
 * those on the target branch.
 *
 * Or a build of the game data, on its own: files of GAME_DATA_FILES under
 * gamedata/, added or modified, meta.json among them. The build at the
 * head commit - its changed files and those it keeps, every one of
 * GAME_DATA_FILES - has to pass `check()` of `validate-gamedata.js`
 * against the counts of the build it replaces (the target branch's, else
 * the published one at PUBLISHED_REF), `checkMeta()` against its lists, be
 * built no more than BUILD_SKEW_MS ahead of now and after the build it
 * replaces - a build time of that build in the future does not count.
 *
 * Everything else is refused: a modified, deleted or renamed file outside
 * a build, another path, a symbolic link, an executable file, a submodule,
 * a file above MAX_FILE_BYTES, a file the validator throws on.
 *
 * Every line it prints is one line of text: a control character a
 * contribution names is printed as \uXXXX, and the workflow commands
 * (::error::, ::warning) carry their data escaped as GitHub's runner reads
 * it.
 *
 *   BASE_REF       the archive the contribution is compared to (default origin/main)
 *   HEAD_REF       the pull request's head commit (default HEAD)
 *   PUBLISHED_REF  the published game data (default origin/gamedata)
 */

const { execFileSync } = require('child_process');
const {
  validateSnapshot, knownOf, cardCountOf, validateItemSnapshot, itemCountOf, isItemPath, STORE_MAX_AGE_DAYS,
  crawledAtOf, crawledAtOfItemPath,
} = require('./validate.js');
const { check: checkGameData, checkMeta: checkGameDataMeta, GAME_DATA_CLOCK_SKEW_MS } = require('./validate-gamedata.js');

/** The files of a build of the game data; every build carries all of them. */
const GAME_DATA_FILES = ['cards', 'items', 'mobs', 'drops', 'spawns', 'recipes', 'pets', 'meta'];
const GAME_DATA_DIR = 'gamedata/';

/** How far in the future a build time may lie. */
const BUILD_SKEW_MS = GAME_DATA_CLOCK_SKEW_MS ?? 86_400_000;

/** The newest crawls on the target branch a new crawl is compared to. */
const COMPARE_DEPTH = 10;

/** The largest file read. */
const MAX_FILE_BYTES = 16 * 1024 * 1024;

/** The most files a pull request changes: an hour's crawl, its item types and its list fit with room to spare. */
const MAX_FILES = 32;

/** The most lists of item IDs one contribution adds. */
const ID_LISTS_PER_CONTRIBUTION = 1;

/** The most lists of item IDs of one crawl time the store holds. */
const ID_LISTS_PER_HOUR = 4;

/** git's mode of a regular file without the executable bit. */
const REGULAR_FILE = '100644';

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 4 * MAX_FILE_BYTES });

/** Text on one output line: every control character as \uXXXX. */
const oneLine = (text) => String(text).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,
  (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/** A workflow command's data, escaped as GitHub's runner reads it. */
const commandData = (text) => oneLine(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
/** A workflow command's property value. */
const commandProperty = (text) => commandData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');
const say = (text) => { console.log(oneLine(text)); };

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
  for (const w of result.warnings.slice(0, 5)) console.log(`::warning file=${commandProperty(file)}::${commandData(w)}`);
  return result.ok;
}

/** The crawl time a crawl's or a part's path names; null for any other path. */
const crawlTimeOf = (file) => (file.startsWith('snapshots/') ? crawledAtOf(file.slice('snapshots/'.length)) : crawledAtOfItemPath(file));
const isIdList = (file) => file.startsWith('items/ids/') && isItemPath(file);

function main() {
  const base = process.env.BASE_REF || 'origin/main';
  const head = process.env.HEAD_REF || 'HEAD';

  const changed = changedFiles(base, head);
  if (!changed.length) {
    complain('The pull request changes nothing.');
    return report();
  }
  if (changed.length > MAX_FILES) {
    complain(`The pull request changes ${changed.length} files; a contribution changes at most ${MAX_FILES}.`);
    return report();
  }
  if (changed.some(({ file }) => file.startsWith(GAME_DATA_DIR))) return gameDataBuild(base, head, changed);

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

  // One crawl time, and few lists of item IDs.
  const times = new Set([...crawls, ...parts].map(({ file }) => crawlTimeOf(file)).filter(Boolean));
  if (times.size > 1) {
    complain(`The pull request adds files of ${times.size} crawl times (${[...times].sort().slice(0, 3).join(', ')}${times.size > 3 ? ', ...' : ''}); a contribution adds those of one.`);
  }
  const lists = parts.filter(({ file }) => isIdList(file));
  if (lists.length > ID_LISTS_PER_CONTRIBUTION) {
    complain(`The pull request adds ${lists.length} lists of item IDs; a contribution adds at most ${ID_LISTS_PER_CONTRIBUTION}.`);
  }
  for (const time of times) {
    const held = existing.filter((p) => isIdList(p) && crawledAtOfItemPath(p) === time).length;
    const added = lists.filter(({ file }) => crawledAtOfItemPath(file) === time && !exists.has(file)).length;
    if (added && held + added > ID_LISTS_PER_HOUR) {
      complain(`${time}: the store holds ${held} lists of item IDs of this crawl time; ${added} more pass the limit of ${ID_LISTS_PER_HOUR}.`);
    }
  }
  if (problems.length) return report();

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
      say(`  ${entry.file}: ${cardCountOf(read.data)} cards, ${read.data.offerCount} offers - fine`);
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
      say(`  ${entry.file}: ${itemCountOf(read.data)} items, ${read.data.offerCount} offers - fine`);
    }
  }
  return report(crawls.length + parts.length);
}

/** A file of `ref` as JSON; null when `ref` or the file is missing or it does not parse. */
function jsonAt(ref, file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:${file}`], {
      encoding: 'utf-8', maxBuffer: MAX_FILE_BYTES, stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    return null;
  }
}

/** Whether the head commit holds `file`. */
function holds(head, file) {
  return git('ls-tree', '--name-only', head, '--', file).trim() === file;
}

/**
 * A build of the game data: nothing but files of GAME_DATA_FILES under
 * gamedata/, added or modified, meta.json among them. The build at the
 * head commit is judged as a whole: every file of GAME_DATA_FILES there,
 * `check()` against the counts of the build it replaces, `checkMeta()`
 * against its lists, and its build time no more than BUILD_SKEW_MS ahead
 * of now and after that of the build it replaces.
 */
function gameDataBuild(base, head, changed) {
  for (const { status, file } of changed) {
    const name = file.startsWith(GAME_DATA_DIR) && file.endsWith('.json')
      ? file.slice(GAME_DATA_DIR.length, -'.json'.length) : null;
    if (name === null || !GAME_DATA_FILES.includes(name)) {
      complain(`\`${file}\`: a build of the game data changes nothing but its files under \`${GAME_DATA_DIR}\`.`);
    } else if (status !== 'A' && status !== 'M') {
      complain(`\`${file}\`: ${status === 'D' ? 'is deleted' : `has status ${status}`}. A build adds or modifies its files.`);
    }
  }
  if (!changed.some(({ file }) => file === `${GAME_DATA_DIR}meta.json`)) {
    complain(`\`${GAME_DATA_DIR}meta.json\` is unchanged: every build carries its own.`);
  }
  if (problems.length) return report();

  const lists = {};
  let meta = null;
  for (const name of GAME_DATA_FILES) {
    const file = `${GAME_DATA_DIR}${name}.json`;
    if (!holds(head, file)) {
      complain(`\`${file}\` is missing: a build carries ${GAME_DATA_FILES.map((n) => `${n}.json`).join(', ')}.`);
      continue;
    }
    const read = readJson(head, file);
    if (!read) continue;
    if (name === 'meta') meta = read.data;
    else lists[name] = read.data;
  }
  if (problems.length) return report();

  // The build it replaces: the one on the target branch, else the published one.
  const now = Date.now();
  const before = [jsonAt(base, `${GAME_DATA_DIR}meta.json`), jsonAt(process.env.PUBLISHED_REF || 'origin/gamedata', 'meta.json')]
    .filter((m) => m && typeof m === 'object');
  const previous = before.find((m) => m.counts)?.counts ?? null;
  // A build time of an earlier build in the future does not hold the next one back.
  const builtBefore = before.map((m) => String(m.builtAt ?? ''))
    .filter((t) => !(Date.parse(t) > now + BUILD_SKEW_MS)).sort().at(-1) ?? '';

  const fine = [
    judged(GAME_DATA_DIR, validated(GAME_DATA_DIR, () => checkGameData(lists, { previous }))),
    judged(`${GAME_DATA_DIR}meta.json`, validated(`${GAME_DATA_DIR}meta.json`, () => ({ warnings: [], ...checkGameDataMeta(meta, lists, { now }) }))),
  ].every(Boolean);
  if (fine && Date.parse(meta.builtAt) > now + BUILD_SKEW_MS) {
    complain(`\`${GAME_DATA_DIR}meta.json\`: built at ${meta.builtAt}, more than ${BUILD_SKEW_MS / 3_600_000} hours ahead of now.`);
  } else if (fine && !(String(meta.builtAt) > builtBefore)) {
    complain(`\`${GAME_DATA_DIR}meta.json\`: built at ${meta.builtAt}, not after the build it replaces (${builtBefore}).`);
  }
  if (fine) {
    say(`  ${GAME_DATA_DIR}: ${Object.entries(lists).map(([k, v]) => `${v.length} ${k}`).join(', ')}`
      + (previous ? ' - against the counts of the build it replaces' : ' - no build to compare with'));
  }
  return report(changed.length);
}

/** Prints the verdict; the exit code. */
function report(count = 0) {
  console.log('');
  if (!problems.length) {
    say(`Checked ${count} ${count === 1 ? 'file' : 'files'}, nothing to report.`);
    return 0;
  }
  console.log('This contribution is not accepted:');
  console.log('');
  for (const p of problems) say(`  - ${p}`);
  for (const p of problems) console.log(`::error::${commandData(p)}`);
  return 1;
}

process.exit(main());
