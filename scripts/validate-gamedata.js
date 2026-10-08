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
  FLOOR: () => FLOOR,
  GAME_DATA_KEYS: () => GAME_DATA_KEYS,
  GROWTH_WARN: () => GROWTH_WARN,
  ITEM_TYPE_IDS: () => ITEM_TYPE_IDS,
  JOIN_FLOOR: () => JOIN_FLOOR,
  MEASURED: () => MEASURED,
  OPTIONAL_GAME_DATA_KEYS: () => OPTIONAL_GAME_DATA_KEYS,
  SHRINK_ERROR: () => SHRINK_ERROR,
  SHRINK_WARN: () => SHRINK_WARN,
  check: () => checkGameData,
  checkGameData: () => checkGameData
});
module.exports = __toCommonJS(gamedata_exports);
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
const id = (v) => Number.isInteger(v) && v > 0;
const count = (v) => Number.isInteger(v) && v >= 0;
const amount = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const name = (v) => typeof v === "string" && v.trim() !== "";
const textOrNull = (v) => v === null || typeof v === "string";
const amountOrNull = (v) => v === null || amount(v);
const optional = (v, sound) => v === void 0 || sound(v);
const ITEM_FIGURES = ["attack", "defense", "weaponLevel", "equipLevel"];
const ENTRY_SOUND = {
  cards: (e) => !!e && id(e.itemId) && name(e.name) && textOrNull(e.slotTarget) && textOrNull(e.effect) && textOrNull(e.scriptRest),
  mobs: (e) => !!e && id(e.mobId) && name(e.name) && (e.level === null || count(e.level)) && (e.hp === null || amount(e.hp)) && typeof e.isBoss === "boolean",
  drops: (e) => !!e && id(e.mobId) && id(e.itemId) && amount(e.rate) && e.rate > 0 && e.rate <= 100,
  spawns: (e) => !!e && id(e.mobId) && name(e.map) && count(e.amount),
  items: (e) => !!e && id(e.itemId) && name(e.name) && Number.isInteger(e.type) && textOrNull(e.subType) && count(e.slots) && amount(e.buy) && amount(e.sell) && amount(e.weight) && typeof e.renewal === "boolean" && ITEM_FIGURES.every((key) => optional(e[key], amountOrNull)) && optional(e.locations, (v) => Array.isArray(v) && v.every(name)) && optional(e.refineable, (v) => typeof v === "boolean") && optional(e.effect, textOrNull) && optional(e.shop, (v) => v === null || amount(v) && v > 0),
  recipes: (e) => !!e && id(e.itemId) && id(e.amount) && Array.isArray(e.materials) && e.materials.length > 0 && e.materials.every((m) => !!m && id(m.itemId) && id(m.amount)),
  pets: (e) => !!e && id(e.mobId) && id(e.eggId) && (e.tameItemId === null || id(e.tameItemId)) && (e.foodId === null || id(e.foodId)) && textOrNull(e.bonus)
};
const ENTRY_FORM = {
  cards: "an item id, a name, slot, effect and script rest as text or null",
  mobs: "a mob id, a name, level and HP of 0 or more or null, isBoss",
  drops: "a mob and an item id, a rate above 0 up to 100",
  spawns: "a mob id, a map, an amount of 0 or more",
  items: "an item id, a name, a type, sub-type as text or null, slots, buy, sell and weight of 0 or more, renewal; where given, attack, defense, weapon and equip level of 0 or more or null, locations as a list of text, refineable, effect as text or null, a shop price above 0 or null",
  recipes: "an item id, an amount, materials of item ids and amounts",
  pets: "a mob and an egg id, tame and food item ids or null, a bonus as text or null"
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
    const odd = game[key].filter((entry) => !ENTRY_SOUND[key](entry)).length;
    if (odd) errors.push(`${key}: ${odd} entries that are not of the form (${ENTRY_FORM[key]})`);
  }
  if (errors.length) return { ok: false, errors, warnings, counts };
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
  const oddRespawns = game.spawns.filter((s) => s.respawnMs !== void 0 && !(Number.isFinite(s.respawnMs) && s.respawnMs >= 0)).length;
  if (oddRespawns) errors.push(`${oddRespawns} spawn entries carry a respawn time that is not a number of milliseconds`);
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
  const foreign = [...new Set(game.drops.map((d) => d.source))].filter((s) => s !== "rathena");
  if (foreign.length) errors.push(`drop rates carry sources other than rathena: ${foreign.join(", ")}`);
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
