'use strict';
/**
 * Builds the game data from rAthena, once, for everyone.
 *
 * Every installation used to fetch and parse about seventy files from
 * rAthena itself. The result is the same for all of them, so it is built
 * here instead and the app downloads four files.
 *
 * Writes gamedata/{cards,mobs,drops,spawns}.json and gamedata/meta.json.
 * Drop rates carry `source: 'rathena'` throughout - rates an installation
 * measured itself belong to that installation and are merged there, never
 * here.
 */
const fs = require('fs');
const path = require('path');
const { buildMobData } = require('./mobdata.js');
const { check } = require('./validate-gamedata.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'gamedata');
const CACHE = path.join(ROOT, '.cache-rathena');

/**
 * A store that keeps everything in memory. `buildMobData` merges the
 * measured rates it finds in the store; here there are none, which is
 * exactly right - this build must not invent them.
 */
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

/** The counts of the build that is already published, if there is one. */
function previousCounts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf-8')).counts || null;
  } catch {
    return null;
  }
}

(async () => {
  const previous = previousCounts();
  const store = memoryStore();
  const started = Date.now();
  await buildMobData({ store, cacheDir: CACHE, log: (t) => console.log(t), signal: undefined });

  const out = {
    cards: store.read('cards'),
    mobs: store.read('mobs'),
    drops: store.read('drops'),
    spawns: store.read('spawns'),
  };

  // Nothing is written before it has been judged. An upstream rename does
  // not announce itself - the parser simply returns nothing, and without
  // this the empty result would go out to everyone.
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
