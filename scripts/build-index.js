'use strict';
/**
 * Builds the files the app actually fetches out of the archive.
 *
 * Archive format and serving format are not the same thing. The archive is
 * one file per crawl, immutable; someone installing the app fresh does not
 * want to fetch a thousand of those. What is produced:
 *
 *   index.json   What exists. The app compares it against its own copy and
 *                fetches only the gap.
 *   series.json  All metrics of all crawls, without individual offers.
 *                Covers history, movers and the usual price level in full
 *                and is about a sixth of the size.
 *   latest.json  The newest run, with individual offers. Outlier
 *                detection needs those.
 *
 * The individual files stay reachable through the repository itself; only
 * someone needing offers from the past fetches them one by one.
 *
 * Output goes to build/ - the Pages step uploads from there, and none of
 * it is committed. What has to be protected is the archive: a snapshot
 * reaches main only through a pull request that scripts/check-pr.js has
 * accepted, and that check refuses every path outside snapshots/*.json -
 * including the workflow files themselves. Derived data needs none of
 * that protection, because it can be rebuilt from the archive at any
 * time; game data is written to main by an action for the same reason.
 */

const fs = require('fs');
const path = require('path');
const { dedupeSnapshots, MIN_GAP_MS } = require('./validate.js');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'snapshots');
const TARGET = path.join(ROOT, 'build');

/**
 * Every snapshot, flat under snapshots/.
 *
 * Sorting by name is sorting by time: the file name starts with the
 * timestamp.
 */
function allFiles() {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(SOURCE, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) out.push(`snapshots/${entry.name}`);
  }
  return out.sort();
}

function main() {
  const files = allFiles();
  const crawls = [];
  const cards = new Map();
  let newest = null;

  for (const rel of files) {
    const full = path.join(ROOT, ...rel.split('/'));
    let data;
    try { data = JSON.parse(fs.readFileSync(full, 'utf-8')); } catch {
      console.log(`  skipped (unreadable): ${rel}`);
      continue;
    }
    if (!data.crawledAt || !Array.isArray(data.cards)) {
      console.log(`  skipped (not a snapshot): ${rel}`);
      continue;
    }
    const withOffers = data.cards.some((c) => Array.isArray(c.offers));

    crawls.push({
      path: rel, crawledAt: data.crawledAt,
      cardCount: data.cards.length, offerCount: data.offerCount ?? null,
      bytes: fs.statSync(full).size, withOffers,
      complete: data.complete ?? null,
      schemaVersion: data.schemaVersion ?? null,
    });

    // `newest` is picked from the counted runs further down, not here -
    // an uncounted twin must not become what everybody downloads.
  }

  crawls.sort((a, b) => a.crawledAt.localeCompare(b.crawledAt));

  // --- One market moment, one observation -------------------------------
  // The archive keeps every file; what is published counts each look at
  // the market once. A run filed twice gives that moment several votes,
  // and the figures that count crawls follow it: measured on the real
  // archive, three identical runs moved the usual price on 222 of 370
  // cards, worst case from 299,999 to 999,999.
  //
  // The same rule the app applies when reading, from the same module, so
  // the two cannot drift apart.
  const loaded = crawls.map((c) => ({
    ...JSON.parse(fs.readFileSync(path.join(ROOT, ...c.path.split('/')), 'utf-8')),
    __entry: c,
  }));
  const counted = new Set(dedupeSnapshots(loaded).map((s) => s.__entry.path));
  const skipped = crawls.filter((c) => !counted.has(c.path)).map((c) => ({
    path: c.path, crawledAt: c.crawledAt,
    reason: `not counted: within ${MIN_GAP_MS / 60000} minutes of another run, `
      + 'or identical to it',
  }));
  if (skipped.length) {
    console.log(`  ${skipped.length} run(s) not counted:`);
    for (const s of skipped) console.log(`    ${s.path}`);
  }
  const kept = crawls.filter((c) => counted.has(c.path));
  for (const s of loaded) {
    if (!counted.has(s.__entry.path)) continue;
    if (!newest || s.crawledAt > newest.crawledAt) newest = s;
  }
  if (newest) delete newest.__entry;

  // The series only now, in sorted order - the index in every point refers
  // to kept[i].
  kept.forEach((crawl, i) => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, ...crawl.path.split('/')), 'utf-8'));
    for (const card of data.cards) {
      if (!Number.isInteger(card.itemId)) continue;
      if (!cards.has(card.itemId)) cards.set(card.itemId, []);
      // Compact as an array, not an object: across hundreds of cards and
      // thousands of crawls the field names would be most of the file.
      // Order: crawl, min, median, mean, max, count.
      cards.get(card.itemId).push([i, card.min, card.median, card.mean, card.max, card.count]);
    }
  });

  fs.mkdirSync(TARGET, { recursive: true });
  const builtAt = new Date().toISOString();
  const write = (name, content) => {
    const file = path.join(TARGET, name);
    fs.writeFileSync(file, JSON.stringify(content), 'utf-8');
    return fs.statSync(file).size;
  };

  const sizes = {
    // Only the counted runs: the app fetches what this lists, and a run
    // that changes no figure is not worth a download. What was left out
    // is named rather than silently dropped.
    'index.json': write('index.json', { schemaVersion: 4, builtAt, crawls: kept, skipped }),
    'series.json': write('series.json', {
      schemaVersion: 4, builtAt,
      fields: ['crawl', 'min', 'median', 'mean', 'max', 'count'],
      crawls: kept.map((c) => c.crawledAt),
      cards: Object.fromEntries([...cards].sort((a, b) => a[0] - b[0])),
    }),
    'latest.json': write('latest.json', { schemaVersion: 4, builtAt, snapshot: newest }),
  };

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`${kept.length} crawls counted of ${crawls.length}, ${cards.size} cards`);
  for (const [name, size] of Object.entries(sizes)) console.log(`  ${name}: ${kb(size)}`);
  if (!crawls.length) {
    console.log('No snapshot in the archive yet - the files stay empty.');
  }
}

main();
