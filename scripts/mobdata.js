'use strict';
/**
 * Cards, items, mobs, drops, spawns, recipes and pets from rAthena's
 * pre-renewal and renewal databases.
 *
 * The pre-renewal database is read whole. From the renewal database comes
 * what it alone knows - its cards and items, the mobs that drop those
 * cards, those drops and those mobs' spawns - each marked
 * `renewal: true`. A renewal mob or drop never touches a pre-renewal card.
 * Recipes, pets and NPC shop prices are pre-renewal's alone.
 *
 * Drop rates are rAthena's base rates, `source: 'rathena'`; measured
 * rates (`source: 'cp'`) found in the store are kept beside them.
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
const PRODUCE_DB = 'db/pre-re/produce_db.txt';
const PET_DB = 'db/pre-re/pet_db.yml';
/** The NPC script lists of a pre-renewal server that name its merchants; their files under a `merchants/` folder are read for shops. */
const SHOP_INDEXES = ['npc/scripts_athena.conf', 'npc/pre-re/scripts_athena.conf'];
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
// map,x,y,dir | - \t shop|marketshop \t display name \t sprite,item:price[:stock]{,item:price[:stock]}
const SHOP = /^[^\t/][^\t]*\t+(shop|marketshop)\t+[^\t]+\t+[^,\t]+,([^\t]+)/;

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

/**
 * rAthena's item types (`Type`, any case) as the control panel's vendor
 * list numbers them; an item without a type is Etc.
 */
const VENDOR_TYPES = {
  healing: 0, usable: 2, etc: 3, weapon: 4, armor: 5, card: 6, petegg: 7, petarmor: 8,
  ammo: 10, delayconsume: 11, shadowgear: 12, cash: 18,
};

/**
 * An item as the game data lists it. NPC prices as rAthena fills them in:
 * no Buy is twice the Sell, no Sell half the Buy, rounded down. Attack,
 * defense and the base level to equip it are null where rAthena gives
 * none; a weapon without a weapon level has level 1, anything else none.
 * Locations are those rAthena sets, ascending.
 */
function itemOf(item) {
  const buy = item.Buy ?? (item.Sell != null ? item.Sell * 2 : 0);
  const type = VENDOR_TYPES[String(item.Type ?? 'Etc').toLowerCase()] ?? null;
  return {
    itemId: item.Id,
    name: item.Name || item.AegisName,
    type,
    subType: item.SubType ?? null,
    slots: item.Slots ?? 0,
    buy,
    sell: item.Sell ?? Math.floor(buy / 2),
    weight: item.Weight ?? 0,
    attack: item.Attack ?? null,
    defense: item.Defense ?? null,
    weaponLevel: item.WeaponLevel ?? (type === VENDOR_TYPES.weapon ? 1 : null),
    equipLevel: item.EquipLevelMin ?? null,
    locations: Object.entries(item.Locations || {}).filter(([, on]) => on === true).map(([at]) => at).sort(),
    refineable: item.Refineable === true,
  };
}

/** A script as readable text when every line of it translates; null otherwise. */
function effectOf(script, ctx) {
  const { effects, complete } = describe(script, ctx);
  return complete && effects.length ? effects.join(', ') : null;
}

/**
 * AegisName -> itemId and itemId -> name of every item in `files`, every
 * item with its script, and the cards with their scripts.
 */
async function readItemDbs(files, cacheDir, log, signal) {
  const byAegis = new Map();
  const byId = new Map();
  const items = [];
  const cards = [];
  for (const file of files) {
    const body = readYaml(await fetchFile(file, cacheDir, signal))?.Body || [];
    for (const item of body) {
      if (!item.AegisName || item.Id == null) continue;
      byAegis.set(item.AegisName, item.Id);
      byId.set(item.Id, item.Name || item.AegisName);
      items.push({ ...itemOf(item), script: item.Script || null });
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
  return {
    byAegis, byId, items, cards,
  };
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
 * The item list - every pre-renewal item, then every item only the
 * renewal database knows, marked `renewal`, ascending by id, each with its
 * script as text where all of it translates - and the card list with
 * descriptions: every pre-renewal card, then every card only the renewal
 * database knows, marked `renewal`. Item and skill names in the scripts
 * come from pre-renewal, else from renewal. `preBuy` is what a pre-renewal
 * item costs at an NPC.
 */
async function loadItems(cacheDir, log, signal) {
  const pre = await readItemDbs(ITEM_DBS, cacheDir, log, signal);
  const re = await readItemDbs(RE_ITEM_DBS, cacheDir, log, signal);
  const byId = new Map([...re.byId, ...pre.byId]);
  const preItems = new Set(pre.items.map((i) => i.itemId));
  const skills = new Map([...await readSkills(RE_SKILL_DB, cacheDir, log, signal), ...await readSkills(SKILL_DB, cacheDir, log, signal)]);
  const itemList = [
    ...pre.items.map((i) => ({ ...i, renewal: false })),
    ...re.items.filter((i) => !preItems.has(i.itemId)).map((i) => ({ ...i, renewal: true })),
  ].filter((i) => i.type != null).sort((a, b) => a.itemId - b.itemId)
    .map(({ script, ...item }) => ({ ...item, effect: effectOf(script, { items: byId, skills }) }));
  log(`  ${itemList.filter((i) => i.effect).length} of ${itemList.length} item scripts readable as text`);

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
  return {
    byAegis: pre.byAegis,
    reByAegis: re.byAegis,
    byId,
    skills,
    preBuy: new Map(pre.items.map((i) => [i.itemId, i.buy])),
    cards,
    items: itemList,
  };
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
 * `renewal`. `renewalMobs` are those mobs' ids, `mobByAegis` the
 * pre-renewal mobs' ids by AegisName.
 */
async function loadMobs(cacheDir, { byAegis, reByAegis, cards }, signal) {
  const mobs = [];
  const drops = [];
  const preMobs = new Set();
  const mobByAegis = new Map();
  for (const mob of readYaml(await fetchFile(MOB_DB, cacheDir, signal))?.Body || []) {
    if (mob.Id == null) continue;
    preMobs.add(mob.Id);
    if (mob.AegisName) mobByAegis.set(mob.AegisName, mob.Id);
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
  return {
    mobs, drops, renewalMobs, mobByAegis,
  };
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

/**
 * The lowest price an NPC shop of a pre-renewal server asks for each item,
 * by item id: the `shop` and `marketshop` lines of the files under a
 * `merchants/` folder that SHOP_INDEXES list. A price of -1 is the item's
 * NPC buy price (`preBuy`); an item the pre-renewal database lacks and a
 * price of 0 or less are passed over.
 */
async function loadShops(cacheDir, log, signal, { byAegis, preBuy }) {
  const files = new Set();
  for (const index of SHOP_INDEXES) {
    const listed = await fetchFile(index, cacheDir, signal);
    for (const m of listed.matchAll(/^npc:\s*(\S+)/gm)) {
      if (m[1].includes('/merchants/')) files.add(m[1]);
    }
  }
  log(`  ${files.size} merchant files according to ${SHOP_INDEXES.join(' and ')}`);

  const lowest = new Map();
  let shops = 0;
  for (const file of files) {
    let text;
    try {
      text = await fetchFile(file, cacheDir, signal);
    } catch (err) {
      log(`    skipped ${file}: ${err.message}`);
      continue;
    }
    for (const line of text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
      if (line.trimStart().startsWith('//')) continue;
      const m = SHOP.exec(line.replace(/\r$/, ''));
      if (!m) continue;
      shops++;
      for (const entry of m[2].replace(/\/\/.*$/, '').split(',')) {
        const [item, price] = entry.trim().split(':');
        const itemId = /^\d+$/.test(item) ? Number(item) : byAegis.get(item);
        if (itemId == null || !preBuy.has(itemId)) continue;
        const asked = Number(price) === -1 ? preBuy.get(itemId) : Number(price);
        if (!(Number.isFinite(asked) && asked > 0)) continue;
        if (!lowest.has(itemId) || asked < lowest.get(itemId)) lowest.set(itemId, asked);
      }
    }
  }
  log(`  ${shops} shops sell ${lowest.size} items`);
  return lowest;
}

/**
 * The recipes of the pre-renewal produce database, one per line: the item,
 * made one at a time, and the materials used up - a material that only has
 * to be carried (amount 0: a guide, a cookbook) is left out. A line whose
 * item or a material of it is not in `known`, and a recipe given twice,
 * are passed over.
 */
async function loadRecipes(cacheDir, log, signal, known) {
  const text = await fetchFile(PRODUCE_DB, cacheDir, signal);
  const recipes = [];
  const seen = new Set();
  let unknown = 0;
  for (const line of text.split('\n')) {
    const body = line.replace(/\/\/.*$/, '').trim();
    if (!body) continue;
    // ID,ProduceItemID,ItemLV,RequireSkill,RequireSkillLv,MaterialID1,MaterialAmount1,...
    const [, itemId, , , , ...rest] = body.split(',').map((field) => Number(field.trim()));
    if (!(Number.isInteger(itemId) && itemId > 0)) continue;
    const materials = [];
    for (let i = 0; i + 1 < rest.length; i += 2) {
      if (Number.isInteger(rest[i]) && rest[i] > 0 && Number.isInteger(rest[i + 1]) && rest[i + 1] > 0) {
        materials.push({ itemId: rest[i], amount: rest[i + 1] });
      }
    }
    if (!materials.length) continue;
    if (!known.has(itemId) || materials.some((m) => !known.has(m.itemId))) {
      unknown++;
      continue;
    }
    const key = JSON.stringify([itemId, materials]);
    if (seen.has(key)) continue;
    seen.add(key);
    recipes.push({ itemId, amount: 1, materials });
  }
  log(`  ${PRODUCE_DB}: ${recipes.length} recipes of ${new Set(recipes.map((r) => r.itemId)).size} items`
    + `${unknown ? `, ${unknown} naming an unknown item passed over` : ''}`);
  return recipes;
}

// .@i = getpetinfo(PETINFO_INTIMATE); if( .@i >= PET_INTIMATE_LOYAL ){ <bonus lines> }
const LOYAL = /^\s*\.@i\s*=\s*getpetinfo\(\s*PETINFO_INTIMATE\s*\)\s*;\s*if\s*\(\s*\.@i\s*>=\s*PET_INTIMATE_LOYAL\s*\)\s*\{([^{}]*)\}\s*$/;

/**
 * The pets of the pre-renewal pet database: mob, egg, the item that tames
 * it and its food, and the bonus it gives at loyal intimacy as text when
 * the script is of that one form and all of it translates, else null. A
 * pet whose mob or egg is unknown is passed over.
 */
async function loadPets(cacheDir, log, signal, {
  mobByAegis, byAegis, byId, skills,
}) {
  const pets = [];
  let unknown = 0;
  for (const pet of readYaml(await fetchFile(PET_DB, cacheDir, signal))?.Body || []) {
    const mobId = mobByAegis.get(pet.Mob);
    const eggId = byAegis.get(pet.EggItem);
    if (mobId == null || eggId == null) {
      unknown++;
      continue;
    }
    const loyal = LOYAL.exec(pet.Script || '');
    pets.push({
      mobId,
      eggId,
      tameItemId: byAegis.get(pet.TameItem) ?? null,
      foodId: byAegis.get(pet.FoodItem) ?? null,
      bonus: loyal ? effectOf(loyal[1], { items: byId, skills }) : null,
    });
  }
  log(`  ${PET_DB}: ${pets.length} pets, ${pets.filter((p) => p.bonus).length} with their bonus as text`
    + `${unknown ? `, ${unknown} with an unknown mob or egg passed over` : ''}`);
  return pets;
}

/** Fetches everything and puts it in the store. */
async function buildMobData({ store, cacheDir, log, signal }) {
  log('Item databases...');
  const items = await loadItems(cacheDir, log, signal);
  const { cards } = items;
  const renewalCards = cards.filter((c) => c.renewal).length;
  const renewalItems = items.items.filter((i) => i.renewal).length;
  log(`  ${items.items.length - renewalItems} pre-renewal and ${renewalItems} renewal items; `
    + `${cards.length - renewalCards} pre-renewal and ${renewalCards} renewal cards`);

  log('Mob databases...');
  const {
    mobs, drops, renewalMobs, mobByAegis,
  } = await loadMobs(cacheDir, items, signal);
  log(`  ${mobs.length} mobs (${renewalMobs.size} renewal), ${drops.length} drop entries`);

  log('Spawn files...');
  const preSpawns = await loadSpawns(cacheDir, log, signal, INDEX);
  log('Renewal spawn files...');
  const reSpawns = (await loadSpawns(cacheDir, log, signal, RE_INDEX)).filter((s) => renewalMobs.has(s.mobId));
  const spawns = [...preSpawns, ...reSpawns];
  log(`  ${spawns.length} mob/map combinations (${reSpawns.length} of renewal mobs)`);

  log('NPC shops...');
  const shop = await loadShops(cacheDir, log, signal, items);
  const itemList = items.items.map((item) => ({ ...item, shop: shop.get(item.itemId) ?? null }));

  log('Recipes and pets...');
  const recipes = await loadRecipes(cacheDir, log, signal, new Set(itemList.map((i) => i.itemId)));
  const pets = await loadPets(cacheDir, log, signal, { ...items, mobByAegis });

  // Measured CP rates are kept. They cost several hundred page requests,
  // while this step only supplies rAthena's default rates - overwriting
  // blindly would silently throw the expensive measurement away.
  const measured = store.read('drops').filter((d) => d.source === 'cp');
  store.write('cards', cards);
  store.write('items', itemList);
  store.write('mobs', mobs);
  store.write('drops', [...drops, ...measured]);
  store.write('spawns', spawns);
  store.write('recipes', recipes);
  store.write('pets', pets);
  if (measured.length) log(`  ${measured.length} measured CP rates kept`);

  const cardIds = new Set(cards.map((c) => c.itemId));
  const droppable = new Set(drops.filter((d) => cardIds.has(d.itemId)).map((d) => d.itemId));
  log(`\nDone. ${cardIds.size} cards (${renewalCards} renewal), ${droppable.size} of them droppable by mobs.`);
  return {
    cards: cards.length,
    items: itemList.length,
    mobs: mobs.length,
    drops: drops.length,
    spawns: spawns.length,
    recipes: recipes.length,
    pets: pets.length,
  };
}

module.exports = {
  buildMobData, loadItems, loadMobs, loadSpawns, loadShops, loadRecipes, loadPets, itemOf, SPAWN, SHOP, VENDOR_TYPES,
};
