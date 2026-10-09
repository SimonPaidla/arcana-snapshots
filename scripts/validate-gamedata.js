'use strict';
// ---------------------------------------------------------------------
// COPY, generated from common/gamedata.ts in the arcana repository by
// `npm run store-copies`. Edit it there; this file is overwritten.
// ---------------------------------------------------------------------
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var gamedata_exports = {};
__export(gamedata_exports, {
  BOUNDS: () => BOUNDS,
  DATA_SOURCES: () => DATA_SOURCES,
  ENTRY_FIELDS: () => ENTRY_FIELDS,
  FLOOR: () => FLOOR,
  GAME_DATA_CLOCK_SKEW_MS: () => GAME_DATA_CLOCK_SKEW_MS,
  GAME_DATA_KEYS: () => GAME_DATA_KEYS,
  GROWTH_WARN: () => GROWTH_WARN,
  ITEM_TYPE_IDS: () => ITEM_TYPE_IDS,
  JOIN_FLOOR: () => JOIN_FLOOR,
  MEASURED: () => MEASURED,
  MOB_ELEMENTS: () => MOB_ELEMENTS,
  MOB_RACES: () => MOB_RACES,
  MOB_SIZES: () => MOB_SIZES,
  OPTIONAL_GAME_DATA_KEYS: () => OPTIONAL_GAME_DATA_KEYS,
  SHRINK_ERROR: () => SHRINK_ERROR,
  SHRINK_WARN: () => SHRINK_WARN,
  check: () => checkGameData,
  checkGameData: () => checkGameData,
  checkGameDataMeta: () => checkGameDataMeta,
  checkMeta: () => checkGameDataMeta
});
module.exports = __toCommonJS(gamedata_exports);
const DATA_SOURCES = ["server", "rathena"];
const ITEM_TYPE_IDS = [0, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 18];
const GAME_DATA_KEYS = ["cards", "mobs", "drops", "spawns"];
const OPTIONAL_GAME_DATA_KEYS = ["items", "recipes", "pets"];
const MEASURED = {
  cards: 5593,
  mobs: 1529,
  drops: 5581,
  spawns: 2115,
  items: 29356,
  recipes: 258,
  pets: 57
};
const FLOOR = {
  cards: 400,
  mobs: 800,
  drops: 4e3,
  spawns: 1200,
  items: 3e3,
  recipes: 150,
  pets: 30
};
const JOIN_FLOOR = {
  droppableCards: 300,
  spawningMobs: 300,
  readableCards: 200,
  /** Checked when the items carry `shop`. */
  shopItems: 150
};
const SHRINK_ERROR = 0.9;
const SHRINK_WARN = 0.97;
const GROWTH_WARN = 1.5;
const BOUNDS = {
  id: 2147483647,
  level: 1e3,
  hp: 4294967295,
  /** An NPC price, in zeny. */
  zeny: 1e10,
  /** In tenths. */
  weight: 1e7,
  slots: 4,
  attack: 1e6,
  defense: 1e6,
  weaponLevel: 10,
  equipLevel: 1e3,
  spawnAmount: 1e4,
  respawnMs: 4294967295,
  /** Units a recipe makes or uses up. */
  recipeAmount: 3e4
};
const GAME_DATA_CLOCK_SKEW_MS = 864e5;
const MOB_ELEMENTS = ["Neutral", "Water", "Earth", "Fire", "Wind", "Poison", "Holy", "Dark", "Ghost", "Undead"];
const MOB_RACES = [
  "Formless",
  "Undead",
  "Brute",
  "Plant",
  "Insect",
  "Fish",
  "Demon",
  "Demihuman",
  "Angel",
  "Dragon",
  "Player_Human",
  "Player_Doram"
];
const MOB_SIZES = ["Small", "Medium", "Large"];
const ENTRY_FIELDS = {
  cards: ["itemId", "name", "slotTarget", "effect", "scriptRest", "renewal"],
  mobs: ["mobId", "name", "level", "hp", "element", "race", "size", "isBoss", "renewal", "from"],
  drops: ["mobId", "itemId", "rate", "source", "mvp"],
  spawns: ["mobId", "map", "amount", "respawnMs"],
  items: [
    "itemId",
    "name",
    "type",
    "subType",
    "slots",
    "buy",
    "sell",
    "weight",
    "renewal",
    "attack",
    "defense",
    "weaponLevel",
    "equipLevel",
    "locations",
    "refineable",
    "effect",
    "shop",
    "from"
  ],
  recipes: ["itemId", "amount", "materials"],
  pets: ["mobId", "eggId", "tameItemId", "foodId", "bonus"]
};
const MATERIAL_FIELDS = ["itemId", "amount"];
const only = (v, fields) => typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).every((key) => fields.includes(key));
const id = (v) => Number.isSafeInteger(v) && v > 0 && v <= BOUNDS.id;
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const whole = (max) => (v) => count(v) && v <= max;
const figure = (max) => (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const name = (v) => typeof v === "string" && v.trim() !== "";
const textOrNull = (v) => v === null || typeof v === "string";
const orNull = (sound) => (v) => v === null || sound(v);
const flag = (v) => typeof v === "boolean";
const optional = (v, sound) => v === void 0 || sound(v);
const ITEM_FIGURES = {
  attack: figure(BOUNDS.attack),
  defense: figure(BOUNDS.defense),
  weaponLevel: whole(BOUNDS.weaponLevel),
  equipLevel: whole(BOUNDS.equipLevel)
};
const source = (v) => DATA_SOURCES.includes(v);
const zeny = figure(BOUNDS.zeny);
const ENTRY_SOUND = {
  cards: (e) => !!e && id(e.itemId) && name(e.name) && textOrNull(e.slotTarget) && textOrNull(e.effect) && textOrNull(e.scriptRest) && optional(e.renewal, flag),
  mobs: (e) => !!e && id(e.mobId) && name(e.name) && orNull(whole(BOUNDS.level))(e.level) && orNull(figure(BOUNDS.hp))(e.hp) && textOrNull(e.element) && textOrNull(e.race) && textOrNull(e.size) && flag(e.isBoss) && optional(e.renewal, flag) && optional(e.from, source),
  drops: (e) => !!e && id(e.mobId) && id(e.itemId) && figure(100)(e.rate) && e.rate > 0 && source(e.source) && optional(e.mvp, flag),
  spawns: (e) => !!e && id(e.mobId) && name(e.map) && whole(BOUNDS.spawnAmount)(e.amount) && optional(e.respawnMs, figure(BOUNDS.respawnMs)),
  items: (e) => !!e && id(e.itemId) && name(e.name) && Number.isSafeInteger(e.type) && textOrNull(e.subType) && whole(BOUNDS.slots)(e.slots) && zeny(e.buy) && zeny(e.sell) && figure(BOUNDS.weight)(e.weight) && flag(e.renewal) && Object.entries(ITEM_FIGURES).every(([key, sound]) => optional(e[key], orNull(sound))) && optional(e.locations, (v) => Array.isArray(v) && v.every(name)) && optional(e.refineable, flag) && optional(e.effect, textOrNull) && optional(e.shop, orNull((v) => zeny(v) && v > 0)) && optional(e.from, source),
  recipes: (e) => !!e && id(e.itemId) && id(e.amount) && whole(BOUNDS.recipeAmount)(e.amount) && Array.isArray(e.materials) && e.materials.length > 0 && e.materials.every((m) => only(m, MATERIAL_FIELDS) && id(m.itemId) && id(m.amount) && whole(BOUNDS.recipeAmount)(m.amount)),
  pets: (e) => !!e && id(e.mobId) && id(e.eggId) && orNull(id)(e.tameItemId) && orNull(id)(e.foodId) && textOrNull(e.bonus)
};
const ENTRY_FORM = {
  cards: "an item id, a name, slot, effect and script rest as text or null, where given renewal true or false",
  mobs: `a mob id, a name, a level of 0 to ${BOUNDS.level} or null, HP of 0 to ${BOUNDS.hp} or null, element, race and size as text or null, isBoss, where given renewal true or false and from server or rathena`,
  drops: "a mob and an item id, a rate above 0 up to 100, a source of server or rathena, where given mvp true or false",
  spawns: `a mob id, a map, an amount of 0 to ${BOUNDS.spawnAmount}, where given a respawn time of 0 to ${BOUNDS.respawnMs} ms`,
  items: `an item id, a name, a type, sub-type as text or null, slots of 0 to ${BOUNDS.slots}, buy and sell of 0 to ${BOUNDS.zeny}, weight of 0 to ${BOUNDS.weight}, renewal; where given, attack and defense of 0 to ${BOUNDS.attack}, weapon level of 0 to ${BOUNDS.weaponLevel}, equip level of 0 to ${BOUNDS.equipLevel}, each or null, locations as a list of text, refineable, effect as text or null, a shop price above 0 up to ${BOUNDS.zeny} or null, from server or rathena`,
  recipes: `an item id, an amount, materials of item ids and amounts, amounts of 1 to ${BOUNDS.recipeAmount}`,
  pets: "a mob and an egg id, tame and food item ids or null, a bonus as text or null"
};
const UNIQUE_BY = {
  cards: (e) => String(e.itemId),
  items: (e) => String(e.itemId),
  mobs: (e) => String(e.mobId),
  pets: (e) => String(e.mobId),
  spawns: (e) => `${String(e.mobId)} ${String(e.map)}`
};
const UNIQUE_FORM = {
  cards: "item id",
  items: "item id",
  mobs: "mob id",
  pets: "mob id",
  spawns: "mob and map"
};
function checkGameData(data, { previous = null } = {}) {
  const errors = [];
  const warnings = [];
  const counts = {};
  const present = [...GAME_DATA_KEYS, ...OPTIONAL_GAME_DATA_KEYS.filter((key) => data[key] !== void 0)];
  for (const key of present) {
    const list = data[key];
    counts[key] = Array.isArray(list) ? list.length : -1;
    if (!Array.isArray(list)) errors.push(`${key}: not a list`);
    else if (list.length < FLOOR[key]) {
      errors.push(`${key}: ${list.length}, below the floor of ${FLOOR[key]} (a live build had ${MEASURED[key]})`);
    }
  }
  if (errors.length) return { ok: false, errors, warnings, counts };
  const game = data;
  for (const key of present) {
    const list = game[key];
    const foreign = list.filter((entry) => !only(entry, ENTRY_FIELDS[key])).length;
    if (foreign) {
      const fields = new Set(list.flatMap((entry) => entry && typeof entry === "object" ? Object.keys(entry) : []));
      const other = [...fields].filter((field) => !ENTRY_FIELDS[key].includes(field)).slice(0, 3).map((field) => JSON.stringify(field).slice(0, 40));
      errors.push(`${key}: ${foreign} entries that are no object of the list's fields${other.length ? ` (outside the format: ${other.join(", ")})` : ""}`);
      continue;
    }
    const odd = list.filter((entry) => !ENTRY_SOUND[key](entry)).length;
    if (odd) errors.push(`${key}: ${odd} entries that are not of the form (${ENTRY_FORM[key]})`);
  }
  if (errors.length) return { ok: false, errors, warnings, counts };
  for (const key of present) {
    const of = UNIQUE_BY[key];
    if (!of) continue;
    const list = game[key];
    const twice = list.length - new Set(list.map(of)).size;
    if (twice) errors.push(`${key}: ${twice} entries repeat the ${UNIQUE_FORM[key]} of another`);
  }
  if (errors.length) return { ok: false, errors, warnings, counts };
  const oddWords = game.mobs.filter((m) => m.element !== null && !MOB_ELEMENTS.includes(m.element) || m.race !== null && !MOB_RACES.includes(m.race) || m.size !== null && !MOB_SIZES.includes(m.size)).length;
  if (oddWords) warnings.push(`${oddWords} mobs carry an element, race or size rAthena does not name`);
  if (previous) {
    for (const key of present) {
      const before = previous[key];
      if (!before) continue;
      const share = counts[key] / before;
      if (share < SHRINK_ERROR) {
        errors.push(`${key}: ${counts[key]} against ${before} last time (${Math.round(share * 100)} %)`);
      } else if (share < SHRINK_WARN) {
        warnings.push(`${key}: ${counts[key]} against ${before} last time`);
      } else if (share > GROWTH_WARN) {
        warnings.push(`${key}: ${counts[key]} against ${before} last time - grew unusually`);
      }
    }
  }
  const mobIds = new Set(game.mobs.map((m) => m.mobId));
  const cardIds = new Set(game.cards.map((c) => c.itemId));
  const strayDrops = game.drops.filter((d) => !mobIds.has(d.mobId)).length;
  if (strayDrops) errors.push(`${strayDrops} drop entries name a mob that is not in the mob list`);
  const straySpawns = game.spawns.filter((s) => !mobIds.has(s.mobId)).length;
  if (straySpawns) errors.push(`${straySpawns} spawn entries name a mob that is not in the mob list`);
  const strayPets = (game.pets ?? []).filter((p) => !mobIds.has(p.mobId)).length;
  if (strayPets) errors.push(`${strayPets} pets name a mob that is not in the mob list`);
  const droppableCards = new Set(game.drops.filter((d) => cardIds.has(d.itemId)).map((d) => d.itemId)).size;
  if (droppableCards < JOIN_FLOOR.droppableCards) {
    errors.push(`only ${droppableCards} cards drop from any mob (expected at least ${JOIN_FLOOR.droppableCards})`);
  }
  const spawningMobs = new Set(game.spawns.map((s) => s.mobId)).size;
  if (spawningMobs < JOIN_FLOOR.spawningMobs) {
    errors.push(`only ${spawningMobs} mobs appear on any map (expected at least ${JOIN_FLOOR.spawningMobs})`);
  }
  const readableCards = game.cards.filter((c) => c.scriptRest == null).length;
  if (readableCards < JOIN_FLOOR.readableCards) {
    errors.push(`only ${readableCards} card effects read as plain text (expected at least ${JOIN_FLOOR.readableCards})`);
  }
  if (game.items) {
    const types = new Set(ITEM_TYPE_IDS);
    const untyped = game.items.filter((i) => !types.has(i.type)).length;
    if (untyped) errors.push(`${untyped} items carry no type of the vendor list`);
    const itemIds = new Set(game.items.map((i) => i.itemId));
    const strayCards = game.cards.filter((c) => !itemIds.has(c.itemId)).length;
    if (strayCards) errors.push(`${strayCards} cards are not in the item list`);
    const strayRecipes = (game.recipes ?? []).filter((r) => !itemIds.has(r.itemId) || r.materials.some((m) => !itemIds.has(m.itemId))).length;
    if (strayRecipes) errors.push(`${strayRecipes} recipes name an item or material that is not in the item list`);
    const strayEggs = (game.pets ?? []).filter((p) => !itemIds.has(p.eggId)).length;
    if (strayEggs) errors.push(`${strayEggs} pets come in an egg that is not in the item list`);
    if (game.items.some((i) => i.shop !== void 0)) {
      counts.shopItems = game.items.filter((i) => i.shop != null).length;
      if (counts.shopItems < JOIN_FLOOR.shopItems) {
        errors.push(`only ${counts.shopItems} items have an NPC shop price (expected at least ${JOIN_FLOOR.shopItems})`);
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: { ...counts, droppableCards, spawningMobs, readableCards }
  };
}
const isoTime = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
const META_FIELDS = ["builtAt", "tookMs", "rathena", "server", "counts"];
const RATHENA_FIELDS = ["sha", "committedAt"];
const SERVER_FIELDS = ["readAt", "items", "mobs", "drops"];
function checkGameDataMeta(meta, data, { now = Date.now() } = {}) {
  const errors = [];
  const m = meta;
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, errors: ["meta.json: not an object"] };
  const foreign = Object.keys(m).filter((key) => !META_FIELDS.includes(key));
  if (foreign.length) errors.push(`meta.json: fields outside the format: ${foreign.slice(0, 3).map((key) => JSON.stringify(key).slice(0, 40)).join(", ")}`);
  const future = (time) => Date.parse(time) > now + GAME_DATA_CLOCK_SKEW_MS;
  if (!isoTime(m.builtAt)) errors.push("meta.json: builtAt is not an ISO time");
  else if (future(m.builtAt)) errors.push(`meta.json: builtAt ${m.builtAt} lies more than a day in the future`);
  if (!optional(m.tookMs, count)) errors.push("meta.json: tookMs is not a count of milliseconds");
  const rathena = m.rathena;
  if (rathena !== null && !(only(rathena, RATHENA_FIELDS) && /^[0-9a-f]{40}$/.test(String(rathena.sha)) && textOrNull(rathena.committedAt))) {
    errors.push("meta.json: rathena is neither null nor a commit of 40 hex digits with its time");
  }
  const server = m.server;
  if (server != null && !(only(server, SERVER_FIELDS) && isoTime(server.readAt) && !future(server.readAt) && count(server.items) && count(server.mobs) && count(server.drops))) {
    errors.push("meta.json: server is neither null nor a read time, not in the future, with counts of 0 or more");
  }
  const keys = [...GAME_DATA_KEYS, ...OPTIONAL_GAME_DATA_KEYS];
  if (m.counts !== void 0 && !(only(m.counts, keys) && Object.values(m.counts).every(count))) {
    errors.push(`meta.json: counts holds something other than counts of ${keys.join(", ")}`);
  }
  const counts = m.counts ?? {};
  for (const key of [...GAME_DATA_KEYS, ...OPTIONAL_GAME_DATA_KEYS]) {
    const list = data[key];
    if (Array.isArray(list) && counts[key] !== list.length) {
      errors.push(`meta.json: counts.${key} is ${String(counts[key])}, the list holds ${list.length}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
