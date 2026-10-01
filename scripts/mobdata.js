'use strict';
/**
 * Card and mob data from rAthena's pre-renewal and renewal databases.
 *
 * The uaRO control panel supplies NEITHER HP NOR spawn maps (verified on
 * the Poring page), so both come from here. The pre-renewal database is
 * read whole. From the renewal database comes what it alone knows: its
 * cards, the mobs that drop them, those drops and those mobs' spawns -
 * each marked `renewal: true`. A renewal mob or drop never touches a
 * pre-renewal card: a pre-renewal card's figures are pre-renewal's.
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
const RE_INDEX = 'npc/re/scripts_monsters.conf';
const RE_MOB_DB = 'db/re/mob_db.yml';
const RE_SKILL_DB = 'db/re/skill_db.yml';
const RE_ITEM_DBS = [
  'db/re/item_db_etc.yml',
  'db/re/item_db_equip.yml',
  'db/re/item_db_usable.yml',
];

// map,x,y[,xs,ys] \t monster|boss_monster \t display name \t mobid,count[,delay1[,delay2[,...]]]
const SPAWN = /^([^,/\s]+),[\d,]*\s*\t+(?:boss_)?monster\t+([^\t]+)\t+(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?/i;

/** A YAML file of rAthena's; a key given twice in one entry keeps its last value, as rAthena reads it. */
function readYaml(text) {
  return YAML.parse(text, { uniqueKeys: false });
}

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

/** AegisName -> itemId and itemId -> name of every item in `files`, and their cards with their scripts. */
async function readItemDbs(files, cacheDir, log, signal) {
  const byAegis = new Map();
  const byId = new Map();
  const cards = [];
  for (const file of files) {
    const body = readYaml(await fetchFile(file, cacheDir, signal))?.Body || [];
    for (const item of body) {
      if (!item.AegisName || item.Id == null) continue;
      byAegis.set(item.AegisName, item.Id);
      byId.set(item.Id, item.Name || item.AegisName);
      if (item.Type === 'Card') {
        // Locations names the slot target: Armor, Weapon, Left_Hand, Head_Top ...
        const locations = Object.keys(item.Locations || {}).sort();
        cards.push({
          itemId: item.Id,
          name: item.Name || item.AegisName,
          slotTarget: locations.join(', ') || null,
          script: item.Script || null,
        });
      }
    }
    log(`  ${file}`);
  }
  return { byAegis, byId, cards };
}

/** Skill id -> name; empty when the file cannot be read. */
async function readSkills(file, cacheDir, log, signal) {
  const skills = new Map();
  try {
    for (const s of readYaml(await fetchFile(file, cacheDir, signal))?.Body || []) {
      if (s.Id != null) skills.set(s.Id, s.Description || s.Name);
    }
    log(`  ${file} (${skills.size} skills)`);
  } catch (err) {
    // Without skill names the affected lines stay as raw script.
    log(`  ${file} not loaded (${err.message}) - skill names missing`);
  }
  return skills;
}

/**
 * The card list with descriptions: every pre-renewal card, then every card
 * only the renewal database knows, marked `renewal`. Item and skill names
 * in the scripts come from pre-renewal, else from renewal.
 */
async function loadItems(cacheDir, log, signal) {
  const pre = await readItemDbs(ITEM_DBS, cacheDir, log, signal);
  const re = await readItemDbs(RE_ITEM_DBS, cacheDir, log, signal);
  const byId = new Map([...re.byId, ...pre.byId]);
  const skills = new Map([...await readSkills(RE_SKILL_DB, cacheDir, log, signal), ...await readSkills(SKILL_DB, cacheDir, log, signal)]);

  const preIds = new Set(pre.cards.map((c) => c.itemId));
  const rawCards = [
    ...pre.cards.map((c) => ({ ...c, renewal: false })),
    ...re.cards.filter((c) => !preIds.has(c.itemId)).map((c) => ({ ...c, renewal: true })),
  ];

  let readable = 0;
  const cards = rawCards.map(({ script, renewal, ...card }) => {
    const { effects, raw, complete } = describe(script, { items: byId, skills });
    if (effects.length && complete) readable++;
    return {
      ...card,
      // effect: translated lines. scriptRest: whatever could not be
      // translated unambiguously, in the original - better than a guess.
      effect: effects.join(', ') || null,
      scriptRest: raw.length ? raw.join(' ') : null,
      renewal,
    };
  });
  log(`  ${readable} of ${cards.length} cards fully readable as text`);
  return { byAegis: pre.byAegis, reByAegis: re.byAegis, cards };
}

function mobOf(mob, renewal) {
  return {
    mobId: mob.Id,
    name: mob.Name || mob.AegisName,
    level: mob.Level ?? null,
    hp: mob.Hp ?? null,
    element: mob.Element ?? null,
    race: mob.Race ?? null,
    size: mob.Size ?? null,
    isBoss: Boolean(mob.MvpExp || mob.MvpDrops),
    renewal,
  };
}

/** A mob's drops of the items `byAegis` knows and `keep` accepts. Rate is given in 1/10000: 1 -> 0.01 %. */
function dropsOf(mob, byAegis, keep = () => true) {
  const drops = [];
  for (const key of ['Drops', 'MvpDrops']) {
    for (const drop of mob[key] || []) {
      const itemId = byAegis.get(drop.Item);
      if (itemId == null || drop.Rate == null || !keep(itemId)) continue;
      drops.push({ mobId: mob.Id, itemId, rate: drop.Rate / 100, source: 'rathena' });
    }
  }
  return drops;
}

/**
 * Every pre-renewal mob with its drops; from the renewal database the drops
 * of the renewal cards, and the mobs only it knows that drop one, marked
 * `renewal`. `renewalMobs` are those mobs' ids.
 */
async function loadMobs(cacheDir, { byAegis, reByAegis, cards }, signal) {
  const mobs = [];
  const drops = [];
  const preMobs = new Set();
  for (const mob of readYaml(await fetchFile(MOB_DB, cacheDir, signal))?.Body || []) {
    if (mob.Id == null) continue;
    preMobs.add(mob.Id);
    mobs.push(mobOf(mob, false));
    drops.push(...dropsOf(mob, byAegis));
  }

  const renewalCards = new Set(cards.filter((c) => c.renewal).map((c) => c.itemId));
  const renewalMobs = new Set();
  for (const mob of readYaml(await fetchFile(RE_MOB_DB, cacheDir, signal))?.Body || []) {
    if (mob.Id == null) continue;
    const own = dropsOf(mob, reByAegis, (itemId) => renewalCards.has(itemId));
    if (!own.length) continue;
    if (!preMobs.has(mob.Id)) {
      mobs.push(mobOf(mob, true));
      renewalMobs.add(mob.Id);
    }
    drops.push(...own);
  }
  return { mobs, drops, renewalMobs };
}

/**
 * Spawn count per mob and map from the spawn files `index` lists, summed
 * across all spawn lines, and the respawn time in milliseconds: delay1
 * plus half of delay2, averaged over the lines by their count.
 */
async function loadSpawns(cacheDir, log, signal, index = INDEX) {
  const listed = await fetchFile(index, cacheDir, signal);
  const files = [...listed.matchAll(/^npc:\s*(\S+)/gm)].map((m) => m[1]);
  log(`  ${files.length} spawn files according to ${index}`);

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
      const amount = Number.parseInt(m[4], 10);
      const respawn = Number.parseInt(m[5] || '0', 10) + Number.parseInt(m[6] || '0', 10) / 2;
      const held = totals.get(key) || { amount: 0, weighted: 0 };
      totals.set(key, { amount: held.amount + amount, weighted: held.weighted + amount * respawn });
    }
    if (++done % 20 === 0) log(`    ${done}/${files.length} files`);
  }

  return [...totals].map(([key, { amount, weighted }]) => {
    const [mobId, map] = key.split('|');
    return {
      mobId: Number.parseInt(mobId, 10), map, amount, respawnMs: amount ? Math.round(weighted / amount) : 0,
    };
  });
}

/** Fetches everything and puts it in the store. */
async function buildMobData({ store, cacheDir, log, signal }) {
  log('Item databases...');
  const items = await loadItems(cacheDir, log, signal);
  const { cards } = items;
  const renewalCards = cards.filter((c) => c.renewal).length;
  log(`  ${items.byAegis.size} pre-renewal items; ${cards.length - renewalCards} pre-renewal and ${renewalCards} renewal cards`);

  log('Mob databases...');
  const { mobs, drops, renewalMobs } = await loadMobs(cacheDir, items, signal);
  log(`  ${mobs.length} mobs (${renewalMobs.size} renewal), ${drops.length} drop entries`);

  log('Spawn files...');
  const preSpawns = await loadSpawns(cacheDir, log, signal, INDEX);
  log('Renewal spawn files...');
  const reSpawns = (await loadSpawns(cacheDir, log, signal, RE_INDEX)).filter((s) => renewalMobs.has(s.mobId));
  const spawns = [...preSpawns, ...reSpawns];
  log(`  ${spawns.length} mob/map combinations (${reSpawns.length} of renewal mobs)`);

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
  log(`\nDone. ${cardIds.size} cards (${renewalCards} renewal), ${droppable.size} of them droppable by mobs.`);
  return { cards: cards.length, mobs: mobs.length, drops: drops.length, spawns: spawns.length };
}

module.exports = { buildMobData, loadItems, loadMobs, loadSpawns, SPAWN };
