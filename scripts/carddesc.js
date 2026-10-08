'use strict';
/**
 * Card, item and pet descriptions derived from rAthena's script field.
 *
 * Cards carry no description in rAthena, but they do carry their script -
 * which is exactly the bonuses the card grants. The control panel does have
 * a description text, but only on the per-item page: 538 requests for
 * something that is already here. An item's script reads the same way,
 * and adds what a usable item does: heal, give or rent items.
 *
 * Only unambiguous forms are translated. Everything else is left standing
 * as a script line rather than guessed at - a wrong number would be worse
 * here than a raw one.
 */

const STAT = {
  bStr: 'STR', bAgi: 'AGI', bVit: 'VIT', bInt: 'INT', bDex: 'DEX', bLuk: 'LUK',
  bAllStats: 'all stats',
  bMaxHP: 'Max HP', bMaxSP: 'Max SP',
  bDef: 'DEF', bDef2: 'DEF', bMdef: 'MDEF', bMdef2: 'MDEF',
  bFlee: 'Flee', bFlee2: 'Perfect Dodge', bHit: 'Hit',
  bCritical: 'Crit', bBaseAtk: 'ATK', bMatk: 'MATK', bMatkRate: 'MATK',
  bAtkRange: 'attack range', bSpeedRate: 'movement speed',
  bAspd: 'ASPD', bAspdRate: 'ASPD', bCastrate: 'cast time',
  bUseSPrate: 'SP cost', bHPrecovRate: 'HP recovery',
  bSPrecovRate: 'SP recovery', bMaxHPrate: 'Max HP', bMaxSPrate: 'Max SP',
  bPerfectHitRate: 'Perfect Hit', bDefRate: 'DEF', bMdefRate: 'MDEF',
  bNoCastCancel: 'casting cannot be interrupted',
  bUnbreakableWeapon: 'weapon is unbreakable',
  bUnbreakableArmor: 'armor is unbreakable',
  bUnbreakableHelm: 'headgear is unbreakable',
  bUnbreakableShield: 'shield is unbreakable',
  bUnbreakableGarment: 'garment is unbreakable',
  bUnbreakableShoes: 'shoes are unbreakable',
  bAtk: 'ATK', bAtkRate: 'ATK',
  bLongAtkRate: 'ranged damage', bDelayRate: 'after-cast delay', bHealPower: 'healing power',
};
// Values given in percent rather than in points.
const PERCENT = new Set(['bMatkRate', 'bAspdRate', 'bCastrate', 'bUseSPrate',
  'bHPrecovRate', 'bSPrecovRate', 'bMaxHPrate', 'bMaxSPrate', 'bSpeedRate',
  'bDefRate', 'bMdefRate', 'bCriticalRate', 'bHitRate', 'bFleeRate',
  'bAtkRate', 'bLongAtkRate', 'bDelayRate', 'bHealPower']);
// Flags without a numeric value.
const FLAG = new Set(['bNoCastCancel', 'bUnbreakableWeapon', 'bUnbreakableArmor',
  'bUnbreakableHelm', 'bUnbreakableShield', 'bUnbreakableGarment', 'bUnbreakableShoes']);

const RACE = {
  RC_Formless: 'Formless', RC_Undead: 'Undead', RC_Brute: 'Brute',
  RC_Plant: 'Plant', RC_Insect: 'Insect', RC_Fish: 'Fish',
  RC_Demon: 'Demon', RC_DemiHuman: 'Demi-Human', RC_Angel: 'Angel',
  RC_Dragon: 'Dragon', RC_Boss: 'Boss', RC_NonBoss: 'non-Boss',
  RC_All: 'all races', RC_Player: 'Player',
  RC_Player_Human: 'human players', RC_Player_Doram: 'Doram players',
};
const ELEMENT = {
  Ele_Neutral: 'Neutral', Ele_Water: 'Water', Ele_Earth: 'Earth',
  Ele_Fire: 'Fire', Ele_Wind: 'Wind', Ele_Poison: 'Poison', Ele_Holy: 'Holy',
  Ele_Dark: 'Shadow', Ele_Ghost: 'Ghost', Ele_Undead: 'Undead',
  Ele_All: 'all elements',
};
const SIZE = { Size_Small: 'small', Size_Medium: 'medium', Size_Large: 'large', Size_All: 'all' };
const CLASS = {
  Class_Normal: 'normal monsters', Class_Boss: 'boss monsters',
  Class_Guardian: 'guardians', Class_All: 'all monsters',
};
const STATUS = {
  Eff_Blind: 'Blind', Eff_Curse: 'Curse', Eff_Poison: 'Poison',
  Eff_Silence: 'Silence', Eff_Stone: 'Petrify', Eff_Stun: 'Stun',
  Eff_Sleep: 'Sleep', Eff_Bleeding: 'Bleeding', Eff_Confusion: 'Confusion',
  Eff_Freeze: 'Freeze', Eff_Fear: 'Fear', Eff_Burning: 'Burning',
  Eff_Crystalize: 'Crystallize', Eff_DPoison: 'Deadly Poison',
};

/**
 * The units come from rAthena's doc/item_bonus.txt:
 *   bAddEff, bAddEffWhenHit, bResEff, bAddMonsterDropItem -> n/100 %
 *   bAutoSpell, bAutoSpellWhenHit                          -> n/10 %
 * They are worked out here so the interface shows a percentage and not a
 * raw number.
 */
const pct = (n, divisor) => {
  const v = Number(n) / divisor;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const sign = (n) => (Number(n) >= 0 ? `+${n}` : String(n));

// An amount of itemheal: a number, or rand(<min>,<max>).
const AMOUNT = String.raw`\d+|rand\(\s*\d+\s*,\s*\d+\s*\)`;
/** "45-65" for rand(45,65), "45" for 45; null for nothing healed. */
function spanOf(amount) {
  const [low, high = low] = (amount.match(/\d+/g) || []).map(Number);
  if (!(high > 0)) return null;
  return low === high ? String(low) : `${low}-${high}`;
}
/** Seconds as whole days, hours or minutes where they divide evenly. */
function durationOf(seconds) {
  const unit = [[86_400, 'day'], [3_600, 'hour'], [60, 'minute'], [1, 'second']].find(([size]) => seconds % size === 0);
  const n = seconds / unit[0];
  return `${n} ${unit[1]}${n === 1 ? '' : 's'}`;
}

/** A single script statement. null means "not safely translatable". */
function translateLine(line, ctx = {}) {
  const item = (id) => (ctx.items && ctx.items.get(Number(id))) || `Item ${id}`;
  const skill = (id) => (ctx.skills && ctx.skills.get(Number(id))) || `Skill ${id}`;
  let m;

  if ((m = /^bonus\s+(b[A-Za-z0-9]+)\s*,\s*(-?\d+)$/.exec(line)) && STAT[m[1]]) {
    const [, name, value] = m;
    if (FLAG.has(name)) return STAT[name];
    return `${STAT[name]} ${sign(value)}${PERCENT.has(name) ? '%' : ''}`;
  }
  if ((m = /^bonus\s+(b[A-Za-z0-9]+)$/.exec(line))) {
    return FLAG.has(m[1]) ? STAT[m[1]] : null;
  }
  if ((m = new RegExp(`^itemheal\\s+(${AMOUNT})\\s*,\\s*(${AMOUNT})$`).exec(line))) {
    const healed = [[spanOf(m[1]), 'HP'], [spanOf(m[2]), 'SP']].filter(([span]) => span).map(([span, what]) => `${span} ${what}`);
    return healed.length ? `restores ${healed.join(' and ')}` : null;
  }
  if ((m = /^percentheal\s+(\d+)\s*,\s*(\d+)$/.exec(line))) {
    const healed = [[m[1], 'HP'], [m[2], 'SP']].filter(([n]) => Number(n) > 0).map(([n, what]) => `${n}% ${what}`);
    return healed.length ? `restores ${healed.join(' and ')}` : null;
  }
  if ((m = /^getitem\s+(\d+)\s*,\s*(\d+)$/.exec(line))) {
    return Number(m[2]) > 0 ? `gives ${item(m[1])} x ${m[2]}` : null;
  }
  if ((m = /^rentitem\s+(\d+)\s*,\s*(\d+)$/.exec(line))) {
    return Number(m[2]) > 0 ? `gives ${item(m[1])} for ${durationOf(Number(m[2]))}` : null;
  }
  if ((m = /^bonus2\s+bAddRace\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return RACE[m[1]] ? `damage to ${RACE[m[1]]} ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bSubRace\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return RACE[m[1]] ? `damage taken from ${RACE[m[1]]} ${sign(-m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bAddEle\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return ELEMENT[m[1]] ? `damage to ${ELEMENT[m[1]]} ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bSubEle\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return ELEMENT[m[1]] ? `damage taken from ${ELEMENT[m[1]]} ${sign(-m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bAddSize\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return SIZE[m[1]] ? `damage to ${SIZE[m[1]]} monsters ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bSubSize\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return SIZE[m[1]] ? `damage taken from ${SIZE[m[1]]} monsters ${sign(-m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bCriticalAddRace\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return RACE[m[1]] ? `Crit against ${RACE[m[1]]} ${sign(m[2])}` : null;
  }
  if ((m = /^bonus2\s+bMagicAddRace\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return RACE[m[1]] ? `magic damage to ${RACE[m[1]]} ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bMagicAddEle\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return ELEMENT[m[1]] ? `magic damage to ${ELEMENT[m[1]]} ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bHPDrainRate\s*,\s*(\d+)\s*,\s*(\d+)$/.exec(line))) {
    return `HP drain: ${Number(m[1]) / 10}% chance, ${m[2]}% of damage`;
  }
  if ((m = /^bonus2\s+bSPDrainRate\s*,\s*(\d+)\s*,\s*(\d+)$/.exec(line))) {
    return `SP drain: ${Number(m[1]) / 10}% chance, ${m[2]}% of damage`;
  }
  if ((m = /^bonus\s+bAtkEle\s*,\s*(\w+)$/.exec(line))) {
    return ELEMENT[m[1]] ? `weapon element ${ELEMENT[m[1]]}` : null;
  }
  if ((m = /^bonus\s+bDefEle\s*,\s*(\w+)$/.exec(line))) {
    return ELEMENT[m[1]] ? `armor element ${ELEMENT[m[1]]}` : null;
  }
  if ((m = /^bonus2\s+bResEff\s*,\s*(\w+)\s*,\s*(\d+)$/.exec(line))) {
    return STATUS[m[1]] ? `resistance to ${STATUS[m[1]]} +${pct(m[2], 100)}%` : null;
  }
  if ((m = /^bonus2\s+bAddEff\s*,\s*(\w+)\s*,\s*(\d+)$/.exec(line))) {
    return STATUS[m[1]] ? `${pct(m[2], 100)}% chance of ${STATUS[m[1]]} on attack` : null;
  }
  if ((m = /^bonus2\s+bAddEffWhenHit\s*,\s*(\w+)\s*,\s*(\d+)$/.exec(line))) {
    return STATUS[m[1]] ? `${pct(m[2], 100)}% chance of ${STATUS[m[1]]} when struck` : null;
  }
  if ((m = /^bonus2\s+bAddMonsterDropItem\s*,\s*(\d+)\s*,\s*(-?\d+)$/.exec(line))) {
    if (Number(m[2]) < 0) return null;            // negative values are a formula
    return `${pct(m[2], 100)}% chance to gain ${item(m[1])} on kill`;
  }
  if ((m = /^bonus3\s+bAddMonsterDropItem\s*,\s*(\d+)\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    if (Number(m[3]) < 0 || !RACE[m[2]]) return null;
    return `${pct(m[3], 100)}% chance to gain ${item(m[1])} when killing ${RACE[m[2]]}`;
  }
  if ((m = /^bonus3\s+bAutoSpell\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/.exec(line))) {
    return `${pct(m[3], 10)}% chance to cast ${skill(m[1])} level ${m[2]} on attack`;
  }
  if ((m = /^bonus3\s+bAutoSpellWhenHit\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/.exec(line))) {
    return `${pct(m[3], 10)}% chance to cast ${skill(m[1])} level ${m[2]} when struck`;
  }
  if ((m = /^bonus2\s+bSkillAtk\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return /^\d+$/.test(m[1]) ? `${skill(m[1])} damage ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus\s+bCritAtkRate\s*,\s*(-?\d+)$/.exec(line))) {
    return `critical damage ${sign(m[1])}%`;
  }
  if ((m = /^bonus2\s+bSPGainRace\s*,\s*(\w+)\s*,\s*(\d+)$/.exec(line))) {
    return RACE[m[1]] ? `+${m[2]} SP when killing ${RACE[m[1]]}` : null;
  }
  if ((m = /^bonus2\s+bExpAddRace\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return RACE[m[1]] ? `experience from ${RACE[m[1]]} ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bAddClass\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return CLASS[m[1]] ? `damage to ${CLASS[m[1]]} ${sign(m[2])}%` : null;
  }
  if ((m = /^bonus2\s+bSubClass\s*,\s*(\w+)\s*,\s*(-?\d+)$/.exec(line))) {
    return CLASS[m[1]] ? `damage taken from ${CLASS[m[1]]} ${sign(-m[2])}%` : null;
  }
  return null;
}

/**
 * Turns a card script into a list of readable lines.
 * @returns {{ effects: string[], raw: string[], complete: boolean }}
 */
function describe(script, ctx = {}) {
  if (!script || !String(script).trim()) {
    return { effects: [], raw: [], complete: true };
  }
  // Conditional blocks and calls with braces are kept in one piece.
  const hasBlock = /[{}]/.test(script);
  const lines = String(script)
    .split(';')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const effects = [];
  const raw = [];
  for (const line of lines) {
    const text = hasBlock ? null : translateLine(line, ctx);
    if (text) effects.push(text);
    else raw.push(`${line};`);
  }
  return { effects, raw, complete: raw.length === 0 };
}

/** One-line text for the interface. Empty when nothing is readable. */
function shortDescription(script, ctx = {}) {
  return describe(script, ctx).effects.join(', ');
}

module.exports = {
  describe, shortDescription, translateLine,
  STAT, RACE, ELEMENT, STATUS, SIZE, CLASS,
};
