'use strict';
/**
 * What a game-data build has to satisfy before it is published.
 *
 * rAthena is an outside repository and moves on its own. A renamed file,
 * a restructured YAML document or a changed spawn-script format does not
 * fail loudly here - the parser matches nothing and quietly returns an
 * empty list. Without this check that emptiness would be committed and
 * handed to every installation as the new truth.
 *
 * Three kinds of check, and the third is the one that earns its keep:
 *
 *   1. Floors. Absolute, generous, and only able to say "this source
 *      stopped being read at all".
 *   2. Against the last published build. Content grows slowly; a sudden
 *      loss is a parser that broke, not rAthena deleting half its mobs.
 *   3. Joins. Every list can be the right length while the keys that tie
 *      them together have stopped matching - an id read as text instead
 *      of a number leaves four healthy-looking files and a ranking with
 *      no mobs in it.
 */

/**
 * Measured on a live build, September 2026. The floors sit well below
 * those figures: they are not there to notice that four mobs were added,
 * they are there to notice that a file stopped parsing.
 */
const MEASURED = { cards: 538, mobs: 1004, drops: 5019, spawns: 1907 };
const FLOOR = { cards: 400, mobs: 800, drops: 4000, spawns: 1200 };

/** Joins, with the figure the same build produced. */
const JOIN_FLOOR = {
  droppableCards: 300,    // 449 of 538 cards drop from some mob
  spawningMobs: 300,      // 510 of 1004 mobs appear on some map
  readableCards: 200,     // 307 of 538 card scripts read as plain text
};

/** Below this share of the last published build it is an error. */
const SHRINK_ERROR = 0.90;
const SHRINK_WARN = 0.97;
const GROWTH_WARN = 1.50;

/**
 * @param {{cards:object[],mobs:object[],drops:object[],spawns:object[]}} data
 * @param {{previous?: Record<string, number>|null}} [options]
 *   previous: the counts of the last published build, from gamedata/meta.json.
 */
function check(data, { previous = null } = {}) {
  const errors = [];
  const warnings = [];
  const counts = Object.fromEntries(Object.entries(data)
    .map(([key, list]) => [key, Array.isArray(list) ? list.length : -1]));

  // --- 1. Every list has to be there, and be a list --------------------
  for (const key of Object.keys(MEASURED)) {
    if (!Array.isArray(data[key])) {
      errors.push(`${key}: not a list`);
      continue;
    }
    if (counts[key] < FLOOR[key]) {
      errors.push(`${key}: ${counts[key]}, below the floor of ${FLOOR[key]}`
        + ` (a live build had ${MEASURED[key]}) - that source is no longer being read`);
    }
  }
  if (errors.length) return { ok: false, errors, warnings, counts };

  // --- 2. Against what is already published ----------------------------
  if (previous) {
    for (const [key, count] of Object.entries(counts)) {
      const before = previous[key];
      if (!before) continue;
      const share = count / before;
      if (share < SHRINK_ERROR) {
        errors.push(`${key}: ${count} against ${before} last time`
          + ` (${Math.round(share * 100)} %) - too much to be an upstream edit`);
      } else if (share < SHRINK_WARN) {
        warnings.push(`${key}: ${count} against ${before} last time`);
      } else if (share > GROWTH_WARN) {
        warnings.push(`${key}: ${count} against ${before} last time - grew unusually`);
      }
    }
  }

  // --- 3. The keys still tie the lists together ------------------------
  const mobIds = new Set(data.mobs.map((m) => m.mobId));
  const cardIds = new Set(data.cards.map((c) => c.itemId));

  const strayDrops = data.drops.filter((d) => !mobIds.has(d.mobId)).length;
  if (strayDrops) errors.push(`${strayDrops} drop entries name a mob that is not in the mob list`);

  const straySpawns = data.spawns.filter((s) => !mobIds.has(s.mobId)).length;
  if (straySpawns) errors.push(`${straySpawns} spawn entries name a mob that is not in the mob list`);

  const droppableCards = new Set(data.drops.filter((d) => cardIds.has(d.itemId))
    .map((d) => d.itemId)).size;
  if (droppableCards < JOIN_FLOOR.droppableCards) {
    errors.push(`only ${droppableCards} cards drop from any mob`
      + ` (expected at least ${JOIN_FLOOR.droppableCards}) - cards and drops no longer match up`);
  }

  const spawningMobs = new Set(data.spawns.map((s) => s.mobId)).size;
  if (spawningMobs < JOIN_FLOOR.spawningMobs) {
    errors.push(`only ${spawningMobs} mobs appear on any map`
      + ` (expected at least ${JOIN_FLOOR.spawningMobs}) - mobs and spawns no longer match up`);
  }

  // Card effects are generated from rAthena's script field. If that
  // format changes, every card still exists and none of them says
  // anything any more.
  const readableCards = data.cards.filter((c) => c.scriptRest == null).length;
  if (readableCards < JOIN_FLOOR.readableCards) {
    errors.push(`only ${readableCards} card effects read as plain text`
      + ` (expected at least ${JOIN_FLOOR.readableCards}) - the script format has moved`);
  }

  // --- 4. Nothing measured may travel in a published build -------------
  // Rates an installation measured belong to that installation; they are
  // merged locally and must never be handed out as rAthena's defaults.
  const foreign = [...new Set(data.drops.map((d) => d.source))].filter((s) => s !== 'rathena');
  if (foreign.length) {
    errors.push(`drop rates carry sources other than rathena: ${foreign.join(', ')}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: { ...counts, droppableCards, spawningMobs, readableCards },
  };
}

module.exports = {
  check, MEASURED, FLOOR, JOIN_FLOOR, SHRINK_ERROR, SHRINK_WARN, GROWTH_WARN,
};
