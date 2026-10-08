'use strict';
/**
 * Builds the game data from rAthena into gamedata/: cards, items, mobs,
 * drops, spawns, recipes and pets as JSON lists, and meta.json with the
 * build time, the rAthena commit and each list's count. Writes nothing and exits with 1
 * when validate-gamedata.js refuses the build against the counts of the
 * published one.
 */
const fs = require('fs');
const path = require('path');
const { buildMobData } = require('./mobdata.js');
const { check } = require('./validate-gamedata.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'gamedata');
const CACHE = path.join(ROOT, '.cache-rathena');
const REPOSITORY = process.env.GITHUB_REPOSITORY || 'SimonPaidla/arcana-snapshots';
const PUBLISHED_META = `https://raw.githubusercontent.com/${REPOSITORY}/gamedata/meta.json`;

/** The store `buildMobData` writes to, in memory and empty: no measured rates. */
function memoryStore() {
  const data = new Map();
  return {
    read: (key) => data.get(key) || [],
    write: (key, value) => data.set(key, value),
    all: () => data,
  };
}

/** The rAthena commit the data was built from, when CI can tell us. */
async function upstreamCommit() {
  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch('https://api.github.com/repos/rathena/rathena/commits/master', {
      headers: {
        accept: 'application/vnd.github+json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return { sha: body.sha, committedAt: body.commit?.committer?.date ?? null };
  } catch {
    return null;
  }
}

/**
 * The counts of the published build (PUBLISHED_META); else those of the
 * build in gamedata/; null without either.
 */
async function previousCounts() {
  const countsOf = (meta, where) => {
    const counts = meta.counts || null;
    if (counts) console.log(`Comparing with the counts of ${where}.`);
    return counts;
  };
  try {
    const res = await fetch(PUBLISHED_META);
    if (res.ok) return countsOf(await res.json(), PUBLISHED_META);
  } catch { /* offline */ }
  try {
    return countsOf(JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf-8')), 'gamedata/meta.json');
  } catch {
    return null;
  }
}

(async () => {
  const previous = await previousCounts();
  const store = memoryStore();
  const started = Date.now();
  await buildMobData({ store, cacheDir: CACHE, log: (t) => console.log(t), signal: undefined });

  const out = {
    cards: store.read('cards'),
    items: store.read('items'),
    mobs: store.read('mobs'),
    drops: store.read('drops'),
    spawns: store.read('spawns'),
    recipes: store.read('recipes'),
    pets: store.read('pets'),
  };

  const verdict = check(out, { previous });
  for (const line of verdict.warnings) console.log(`  warning: ${line}`);
  if (!verdict.ok) {
    console.error('\nRefused to write:');
    for (const line of verdict.errors) console.error(`  ${line}`);
    process.exit(1);
  }

  const upstream = await upstreamCommit();
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, value] of Object.entries(out)) {
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(value), 'utf-8');
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), `${JSON.stringify({
    builtAt: new Date().toISOString(),
    tookMs: Date.now() - started,
    rathena: upstream,
    counts: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])),
  }, null, 2)}\n`, 'utf-8');

  console.log(`\nWritten to gamedata/: ${Object.entries(verdict.counts)
    .map(([k, v]) => `${v} ${k}`).join(', ')}`);
})();
