'use strict';
/**
 * Builds the files GitHub Pages serves from the archive into build/:
 *
 *   index.json   every counted crawl of the cards (path, time, card and
 *                offer count), the crawls left out with the reason, and
 *                under `items` every part of items the validator passes
 *                (path, time, item and offer count, bytes, schema)
 *   series.json  every card's min, median, mean, max and count per counted crawl
 *   latest.json  the newest counted crawl as stored
 */

const fs = require('fs');
const path = require('path');
const {
  byCard, cardCountOf, dedupeSnapshots, isSnapshotShape, MIN_GAP_MS, SNAPSHOT_SCHEMA,
  isItemPath, itemCountOf, validateItemSnapshot, ITEM_SNAPSHOT_SCHEMA,
} = require('./validate.js');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'snapshots');
const ITEMS = path.join(ROOT, 'items');
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

/**
 * Every part of items validateItemSnapshot() passes under its path, by
 * crawl time: `items/type-7/…`, `items/ids/…`. Each is listed, none
 * counted out as the crawls are.
 */
function allParts() {
  const out = [];
  let skipped = 0;
  let folders;
  try { folders = fs.readdirSync(ITEMS, { withFileTypes: true }); } catch { return { parts: out, skipped }; }
  for (const folder of folders.filter((f) => f.isDirectory())) {
    for (const entry of fs.readdirSync(path.join(ITEMS, folder.name), { withFileTypes: true })) {
      const rel = `items/${folder.name}/${entry.name}`;
      if (!entry.isFile() || !isItemPath(rel)) continue;
      const full = path.join(ITEMS, folder.name, entry.name);
      let data;
      try { data = JSON.parse(fs.readFileSync(full, 'utf-8')); } catch {
        console.log(`  skipped (unreadable): ${rel}`);
        continue;
      }
      if (!validateItemSnapshot(data, { path: rel, now: Number.POSITIVE_INFINITY }).ok) {
        skipped += 1;
        continue;
      }
      out.push({
        path: rel, crawledAt: data.crawledAt,
        itemCount: itemCountOf(data), offerCount: data.offerCount,
        bytes: fs.statSync(full).size, schemaVersion: data.schemaVersion,
      });
    }
  }
  out.sort((a, b) => a.crawledAt.localeCompare(b.crawledAt) || a.path.localeCompare(b.path));
  return { parts: out, skipped };
}

function main() {
  const files = allFiles();
  const crawls = [];
  let otherSchema = 0;
  const cards = new Map();
  let newest = null;

  for (const rel of files) {
    const full = path.join(ROOT, ...rel.split('/'));
    let data;
    try { data = JSON.parse(fs.readFileSync(full, 'utf-8')); } catch {
      console.log(`  skipped (unreadable): ${rel}`);
      continue;
    }
    if (!isSnapshotShape(data)) {
      otherSchema += 1;
      continue;
    }

    crawls.push({
      path: rel, crawledAt: data.crawledAt,
      cardCount: cardCountOf(data), offerCount: data.offerCount ?? null,
      bytes: fs.statSync(full).size, withOffers: true,
      complete: data.complete ?? null,
      schemaVersion: data.schemaVersion ?? null,
    });

  }

  crawls.sort((a, b) => a.crawledAt.localeCompare(b.crawledAt));
  if (otherSchema) console.log(`  ${otherSchema} file(s) not of schema ${SNAPSHOT_SCHEMA}, not listed`);

  // --- The counted crawls: dedupeSnapshots(), as Arcana reads them --------
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

  // Each point's first field is its crawl's index in `kept`.
  kept.forEach((crawl, i) => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, ...crawl.path.split('/')), 'utf-8'));
    for (const card of byCard(data).cards) {
      if (!Number.isInteger(card.itemId)) continue;
      if (!cards.has(card.itemId)) cards.set(card.itemId, []);
      cards.get(card.itemId).push([i, card.min, card.median, card.mean, card.max, card.count]);
    }
  });

  const items = allParts();
  if (items.skipped) console.log(`  ${items.skipped} part(s) refused by the validator of item schema ${ITEM_SNAPSHOT_SCHEMA}, not listed`);

  fs.mkdirSync(TARGET, { recursive: true });
  const builtAt = new Date().toISOString();
  const write = (name, content) => {
    const file = path.join(TARGET, name);
    fs.writeFileSync(file, JSON.stringify(content), 'utf-8');
    return fs.statSync(file).size;
  };

  const sizes = {
    // The counted crawls, the crawls left out with the reason, every part.
    'index.json': write('index.json', {
      schemaVersion: SNAPSHOT_SCHEMA, itemSchemaVersion: ITEM_SNAPSHOT_SCHEMA, builtAt, crawls: kept, skipped, items: items.parts,
    }),
    'series.json': write('series.json', {
      schemaVersion: SNAPSHOT_SCHEMA, builtAt,
      fields: ['crawl', 'min', 'median', 'mean', 'max', 'count'],
      crawls: kept.map((c) => c.crawledAt),
      cards: Object.fromEntries([...cards].sort((a, b) => a[0] - b[0])),
    }),
    'latest.json': write('latest.json', { schemaVersion: SNAPSHOT_SCHEMA, builtAt, snapshot: newest }),
  };

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`${kept.length} crawls counted of ${crawls.length}, ${cards.size} cards, ${items.parts.length} parts of items`);
  for (const [name, size] of Object.entries(sizes)) console.log(`  ${name}: ${kb(size)}`);
  if (!crawls.length) {
    console.log('No snapshot in the archive yet - the files stay empty.');
  }
}

main();
