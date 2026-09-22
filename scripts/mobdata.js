'use strict';
// ---------------------------------------------------------------------
// COPY. The source lives in the code repository under src/mobdata.js.
// Do not edit here - syncing overwrites every change.
// ---------------------------------------------------------------------
/**
 * Mob base data from rAthena's pre-renewal database.
 *
 * The uaRO control panel supplies NEITHER HP NOR spawn maps (verified on
 * the Poring page), so both come from here. Side effect: the pre-renewal
 * boundary falls out by itself, because the pre-re files only contain
 * pre-renewal content.
 *
 * The drop rates here are rAthena's defaults and NOT uaRO's rates - uaRO
 * runs with a multiplier. They are therefore stored with source 'rathena'
 * and are overwritten by measured CP rates.
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { describe } = require('./carddesc.js');

const RAW = 'https://raw.githubusercontent.com/rathena/rathena/master/';
const INDEX = 'npc/pre-re/scripts_monsters.conf';
const MOB_DB = 'db/pre-re/mob_db.yml';
const SKILL_DB = 'db/pre-re/skill_db.yml';
const ITEM_DBS = [
  'db/pre-re/item_db_etc.yml',
  'db/pre-re/item_db_equip.yml',
  'db/pre-re/item_db_usable.yml',
];

// map,x,y[,xs,ys] \t monster|boss_monster \t display name \t mobid,count[,...]
const SPAWN = /^([^,/\s]+),[\d,]*\s*\t+(?:boss_)?monster\t+([^\t]+)\t+(\d+)\s*,\s*(\d+)/i;

async function fetchFile(remotePath, cacheDir, signal) {
  const local = path.join(cacheDir, remotePath.replace(/\//g, '_'));
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf-8');

  const res = await fetch(RAW + remotePath, { signal });
  if (!res.ok) throw new Error(`${remotePath}: HTTP ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(local, text, 'utf-8');
  return text;
}

/** AegisName -> itemId, plus the card list with descriptions. */
async function loadItems(cacheDir, log, signal) {
  const byAegis = new Map();
  const byId = new Map();          // for cards that make other items drop
  const rawCards = [];

  for (const file of ITEM_DBS) {
    const body = YAML.parse(await fetchFile(file, cacheDir, signal))?.Body || [];
    for (const item of body) {
      if (!item.AegisName || item.Id == null) continue;
      byAegis.set(item.AegisName, item.Id);
      byId.set(item.Id, item.Name || item.AegisName);
      if (item.Type === 'Card') {
        // Locations names the slot target: Armor, Weapon, Left_Hand, Head_Top ...
        const locations = Object.keys(item.Locations || {}).sort();
        rawCards.push({
          itemId: item.Id,
          name: item.Name || item.AegisName,
          slotTarget: locations.join(', ') || null,
          script: item.Script || null,
        });
      }
    }
    log(`  ${file.split('/').pop()}`);
  }

  // Skill names for cards that trigger or strengthen a spell.
  const skills = new Map();
  try {
    for (const s of YAML.parse(await fetchFile(SKILL_DB, cacheDir, signal))?.Body || []) {
      if (s.Id != null) skills.set(s.Id, s.Description || s.Name);
    }
    log(`  skill_db.yml (${skills.size} skills)`);
  } catch (err) {
    // Without skill names the affected lines stay as raw script.
    log(`  skill_db.yml not loaded (${err.message}) - skill names missing`);
  }

  let readable = 0;
  const cards = rawCards.map(({ script, ...card }) => {
    const { effects, raw, complete } = describe(script, { items: byId, skills });
    if (effects.length && complete) readable++;
    return {
      ...card,
      // effect: translated lines. scriptRest: whatever could not be
      // translated unambiguously, in the original - better than a guess.
      effect: effects.join(', ') || null,
      scriptRest: raw.length ? raw.join(' ') : null,
    };
  });
  log(`  ${readable} of ${cards.length} cards fully readable as text`);
  return { byAegis, cards };
}

async function loadMobs(cacheDir, byAegis, signal) {
  const body = YAML.parse(await fetchFile(MOB_DB, cacheDir, signal))?.Body || [];
  const mobs = [];
  const drops = [];

  for (const mob of body) {
    if (mob.Id == null) continue;
    mobs.push({
      mobId: mob.Id,
      name: mob.Name || mob.AegisName,
      level: mob.Level ?? null,
      hp: mob.Hp ?? null,
      element: mob.Element ?? null,
      race: mob.Race ?? null,
      size: mob.Size ?? null,
      isBoss: Boolean(mob.MvpExp || mob.MvpDrops),
    });
    // Rate is given in 1/10000: 1 -> 0.01 %
    for (const key of ['Drops', 'MvpDrops']) {
      for (const drop of mob[key] || []) {
        const itemId = byAegis.get(drop.Item);
        if (itemId == null || drop.Rate == null) continue;
        drops.push({ mobId: mob.Id, itemId, rate: drop.Rate / 100, source: 'rathena' });
      }
    }
  }
  return { mobs, drops };
}

/**
 * Spawn count per mob and map, summed across all spawn lines.
 * A mob often appears several times on the same map with different respawn
 * timers; for "how many walk around at once" the sum is what counts.
 */
async function loadSpawns(cacheDir, log, signal) {
  const index = await fetchFile(INDEX, cacheDir, signal);
  const files = [...index.matchAll(/^npc:\s*(\S+)/gm)].map((m) => m[1]);
  log(`  ${files.length} spawn files according to the index`);

  const totals = new Map();
  let done = 0;
  for (const file of files) {
    let text;
    try {
      text = await fetchFile(file, cacheDir, signal);
    } catch (err) {
      log(`    skipped ${file}: ${err.message}`);
      continue;
    }
    for (const line of text.split('\n')) {
      if (line.trimStart().startsWith('//')) continue;
      const m = SPAWN.exec(line);
      if (!m) continue;
      const key = `${m[3]}|${m[1].trim()}`;
      totals.set(key, (totals.get(key) || 0) + Number.parseInt(m[4], 10));
    }
    if (++done % 20 === 0) log(`    ${done}/${files.length} files`);
  }

  return [...totals].map(([key, amount]) => {
    const [mobId, map] = key.split('|');
    return { mobId: Number.parseInt(mobId, 10), map, amount };
  });
}

/** Fetches everything and puts it in the store. */
async function buildMobData({ store, cacheDir, log, signal }) {
  log('Item database...');
  const { byAegis, cards } = await loadItems(cacheDir, log, signal);
  log(`  ${byAegis.size} items, ${cards.length} of them cards (pre-renewal)`);

  log('Mob database...');
  const { mobs, drops } = await loadMobs(cacheDir, byAegis, signal);
  log(`  ${mobs.length} mobs, ${drops.length} drop entries`);

  log('Spawn files...');
  const spawns = await loadSpawns(cacheDir, log, signal);
  log(`  ${spawns.length} mob/map combinations`);

  // Measured CP rates are kept. They cost several hundred page requests,
  // while this step only supplies rAthena's default rates - overwriting
  // blindly would silently throw the expensive measurement away.
  const measured = store.read('drops').filter((d) => d.source === 'cp');
  store.write('cards', cards);
  store.write('mobs', mobs);
  store.write('drops', [...drops, ...measured]);
  store.write('spawns', spawns);
  if (measured.length) log(`  ${measured.length} measured CP rates kept`);

  const cardIds = new Set(cards.map((c) => c.itemId));
  const droppable = new Set(drops.filter((d) => cardIds.has(d.itemId)).map((d) => d.itemId));
  log(`\nDone. ${cardIds.size} pre-renewal cards, ${droppable.size} of them droppable by mobs.`);
  return { cards: cards.length, mobs: mobs.length, drops: drops.length, spawns: spawns.length };
}

module.exports = { buildMobData, loadItems, loadMobs, loadSpawns, SPAWN };
