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
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
  JOIN_FLOOR: () => JOIN_FLOOR,
  MEASURED: () => MEASURED,
  SHRINK_ERROR: () => SHRINK_ERROR,
  SHRINK_WARN: () => SHRINK_WARN,
  check: () => checkGameData,
  checkGameData: () => checkGameData
});
module.exports = __toCommonJS(gamedata_exports);
const GAME_DATA_KEYS = ["cards", "mobs", "drops", "spawns"];
const MEASURED = { cards: 538, mobs: 1004, drops: 5019, spawns: 1907 };
const FLOOR = { cards: 400, mobs: 800, drops: 4e3, spawns: 1200 };
const JOIN_FLOOR = {
  droppableCards: 300,
  spawningMobs: 300,
  readableCards: 200
};
const SHRINK_ERROR = 0.9;
const SHRINK_WARN = 0.97;
const GROWTH_WARN = 1.5;
function checkGameData(data, { previous = null } = {}) {
  const errors = [];
  const warnings = [];
  const counts = {};
  for (const key of GAME_DATA_KEYS) {
    const list = data[key];
    counts[key] = Array.isArray(list) ? list.length : -1;
    if (!Array.isArray(list)) errors.push(`${key}: not a list`);
    else if (list.length < FLOOR[key]) {
      errors.push(`${key}: ${list.length}, below the floor of ${FLOOR[key]} (a live build had ${MEASURED[key]})`);
    }
  }
  if (errors.length) return { ok: false, errors, warnings, counts };
  const game = data;
  if (previous) {
    for (const key of GAME_DATA_KEYS) {
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
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: { ...counts, droppableCards, spawningMobs, readableCards }
  };
}
