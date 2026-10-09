'use strict';
// ---------------------------------------------------------------------
// COPY, generated from common/pictures.ts in the arcana repository by
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
var pictures_exports = {};
__export(pictures_exports, {
  DEAD_MAX_SHARE: () => DEAD_MAX_SHARE,
  INDEX_MAX_BYTES: () => INDEX_MAX_BYTES,
  PACKS_DIR: () => PACKS_DIR,
  PACKS_MAX: () => PACKS_MAX,
  PACK_MAX_BYTES: () => PACK_MAX_BYTES,
  PICTURES_CLOCK_SKEW_MS: () => PICTURES_CLOCK_SKEW_MS,
  PICTURES_DIR: () => PICTURES_DIR,
  PICTURES_MAX_BYTES: () => PICTURES_MAX_BYTES,
  PICTURE_BOUNDS: () => PICTURE_BOUNDS,
  PICTURE_FLOOR: () => PICTURE_FLOOR,
  PICTURE_KINDS: () => PICTURE_KINDS,
  PICTURE_SHRINK_ERROR: () => PICTURE_SHRINK_ERROR,
  PICTURE_TILE: () => PICTURE_TILE,
  checkIndex: () => checkPictureIndex,
  checkMeta: () => checkPicturesMeta,
  checkPack: () => checkPack,
  checkPictureIndex: () => checkPictureIndex,
  checkPicturesMeta: () => checkPicturesMeta,
  countsOf: () => countsOf,
  isPackName: () => isPackName,
  packFileOf: () => packFileOf,
  pictureOf: () => pictureOf,
  webpSize: () => webpSize
});
module.exports = __toCommonJS(pictures_exports);
const PICTURE_KINDS = ["icon", "image", "mob"];
const PICTURE_TILE = 1;
const PICTURES_DIR = "pictures/";
const PACKS_DIR = "packs/";
const packFileOf = (name) => `${PACKS_DIR}${name}.pack`;
const isPackName = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const PICTURE_BOUNDS = {
  icon: { width: 32, height: 32, bytes: 8 * 1024 },
  image: { width: 160, height: 160, bytes: 48 * 1024 },
  mob: { width: 400, height: 400, bytes: 128 * 1024 }
};
const WEBP_MIN_BYTES = 30;
const PIXELS_MAX = Math.max(...PICTURE_KINDS.map((kind) => Math.max(PICTURE_BOUNDS[kind].width, PICTURE_BOUNDS[kind].height)));
const PACK_MAX_BYTES = 12 * 1024 * 1024;
const PACKS_MAX = 20;
const PICTURES_MAX_BYTES = 64 * 1024 * 1024;
const INDEX_MAX_BYTES = 8 * 1024 * 1024;
const DEAD_MAX_SHARE = 0.5;
const PICTURE_FLOOR = { icon: 3e3, image: 3e3, mob: 500 };
const PICTURE_SHRINK_ERROR = 0.9;
const PICTURES_CLOCK_SKEW_MS = 864e5;
const ID_MAX = 2147483647;
const PROCESS_MAX = 1e3;
function webpSize(bytes) {
  if (bytes.length < WEBP_MIN_BYTES) return null;
  const ascii = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  const u32 = (at) => (bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16 | bytes[at + 3] << 24) >>> 0;
  const u24 = (at) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
  if (ascii(0) !== "RIFF" || ascii(8) !== "WEBP" || u32(4) + 8 !== bytes.length) return null;
  const chunk = ascii(12);
  if (20 + u32(16) > bytes.length) return null;
  if (chunk === "VP8 ") {
    if (bytes[23] !== 157 || bytes[24] !== 1 || bytes[25] !== 42) return null;
    return { width: (bytes[26] | bytes[27] << 8) & 16383, height: (bytes[28] | bytes[29] << 8) & 16383 };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 47) return null;
    const bits = u32(21);
    return { width: (bits & 16383) + 1, height: (bits >>> 14 & 16383) + 1 };
  }
  if (chunk === "VP8X") {
    if (bytes[20] & 2) return null;
    return { width: u24(24) + 1, height: u24(27) + 1 };
  }
  return null;
}
const isMap = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const only = (v, fields) => isMap(v) && Object.keys(v).every((key) => fields.includes(key));
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const within = (min, max) => (v) => Number.isSafeInteger(v) && v >= min && v <= max;
const isoTime = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
const sha256Hex = isPackName;
const idKey = (key) => /^[1-9][0-9]{0,9}$/.test(key) && Number(key) <= ID_MAX;
const shown = (list) => list.slice(0, 3).map((key) => JSON.stringify(key).slice(0, 40)).join(", ");
const INDEX_FIELDS = ["builtAt", "packs", "pictures", "icon", "image", "mob", "card"];
const PACK_FIELDS = ["name", "bytes"];
const CARD_FIELDS = ["icon", "image"];
const META_FIELDS = ["builtAt", "tookMs", "process", "counts", "index"];
const COUNT_FIELDS = ["icon", "image", "mob", "tile", "pictures", "packs"];
const DIGEST_FIELDS = ["sha256", "bytes"];
function countsOf(index) {
  const tile = Object.values(index.image).filter((n) => (index.pictures[n][5] & PICTURE_TILE) !== 0).length;
  return {
    icon: Object.keys(index.icon).length,
    image: Object.keys(index.image).length,
    mob: Object.keys(index.mob).length,
    tile,
    pictures: index.pictures.length,
    packs: index.packs.length
  };
}
function checkPictureIndex(index, { meta = null, previous = null } = {}) {
  const errors = [];
  const warnings = [];
  const fail = () => ({ ok: false, errors, warnings, counts: {} });
  if (!only(index, INDEX_FIELDS)) {
    const foreign = index && typeof index === "object" && !Array.isArray(index) ? Object.keys(index).filter((key) => !INDEX_FIELDS.includes(key)) : [];
    errors.push(foreign.length ? `index.json: fields outside the format: ${shown(foreign)}` : "index.json: not an object");
    return fail();
  }
  if (!isoTime(index.builtAt)) errors.push("index.json: builtAt is not an ISO time");
  const packs = index.packs;
  if (!Array.isArray(packs) || packs.length < 1 || packs.length > PACKS_MAX) {
    errors.push(`index.json: packs is not a list of 1 to ${PACKS_MAX} packs`);
    return fail();
  }
  if (!packs.every((p) => only(p, PACK_FIELDS) && isPackName(p.name) && within(1, PACK_MAX_BYTES)(p.bytes))) {
    errors.push(`index.json: a pack is not a name of 64 hex digits with 1 to ${PACK_MAX_BYTES} bytes`);
    return fail();
  }
  const packList = packs;
  if (new Set(packList.map((p) => p.name)).size !== packList.length) errors.push("index.json: a pack is named twice");
  const packBytes = packList.reduce((sum, p) => sum + p.bytes, 0);
  if (packBytes > PICTURES_MAX_BYTES) errors.push(`index.json: the packs hold ${packBytes} bytes, above ${PICTURES_MAX_BYTES}`);
  const pictures = index.pictures;
  if (!Array.isArray(pictures)) {
    errors.push("index.json: pictures is not a list");
    return fail();
  }
  const sound = (e) => {
    if (!Array.isArray(e) || e.length !== 6 || !e.every(count)) return false;
    const [pack = -1, offset = 0, length = 0, width = 0, height = 0, flags = -1] = e;
    const into = packList[pack];
    return !!into && length >= WEBP_MIN_BYTES && offset + length <= into.bytes && within(1, PIXELS_MAX)(width) && within(1, PIXELS_MAX)(height) && (flags === 0 || flags === PICTURE_TILE);
  };
  const odd = pictures.filter((e) => !sound(e)).length;
  if (odd) {
    errors.push(`index.json: ${odd} pictures are not a place in a pack with dimensions of 1 to ${PIXELS_MAX} and flags of 0 or ${PICTURE_TILE}`);
    return fail();
  }
  const entries = pictures;
  const byPack = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const list = byPack.get(e[0]);
    if (list) list.push(e);
    else byPack.set(e[0], [e]);
  }
  let overlaps = 0;
  for (const list of byPack.values()) {
    list.sort((a, b) => a[1] - b[1]);
    for (let i = 1; i < list.length; i++) if (list[i][1] < list[i - 1][1] + list[i - 1][2]) overlaps++;
  }
  if (overlaps) errors.push(`index.json: ${overlaps} pictures overlap another in their pack`);
  const kindsOf = entries.map(() => /* @__PURE__ */ new Set());
  for (const kind of PICTURE_KINDS) {
    const map = index[kind];
    if (!isMap(map) || !Object.keys(map).every(idKey)) {
      errors.push(`index.json: ${kind} is not a map of ids of 1 to ${ID_MAX}`);
      continue;
    }
    const stray = Object.values(map).filter((n) => !within(0, entries.length - 1)(n)).length;
    if (stray) {
      errors.push(`index.json: ${stray} entries of ${kind} name no picture`);
      continue;
    }
    for (const n of Object.values(map)) kindsOf[n].add(kind);
  }
  const card = index.card;
  if (card !== null) {
    if (!only(card, CARD_FIELDS) || !CARD_FIELDS.every((field) => within(0, entries.length - 1)(card[field]))) {
      errors.push("index.json: card is neither null nor an icon and an image that name pictures");
    } else {
      kindsOf[card.icon].add("icon");
      kindsOf[card.image].add("image");
    }
  }
  if (errors.length) return fail();
  const unused = kindsOf.filter((kinds) => kinds.size === 0).length;
  if (unused) errors.push(`index.json: ${unused} pictures are shown by no item, mob or card`);
  const idle = packList.filter((_, n) => !byPack.has(n)).length;
  if (idle) errors.push(`index.json: ${idle} packs hold no picture`);
  for (const kind of PICTURE_KINDS) {
    const bound = PICTURE_BOUNDS[kind];
    const over = entries.filter((e, n) => kindsOf[n].has(kind) && (e[2] > bound.bytes || e[3] > bound.width || e[4] > bound.height)).length;
    if (over) errors.push(`index.json: ${over} pictures of ${kind} are larger than ${bound.width}\xD7${bound.height} or ${bound.bytes} bytes`);
  }
  const misflagged = entries.filter((e, n) => (e[5] & PICTURE_TILE) !== 0 && [...kindsOf[n]].some((kind) => kind !== "image")).length;
  if (misflagged) errors.push(`index.json: ${misflagged} pictures on a tile are shown as something other than an item image`);
  const used = entries.reduce((sum, e) => sum + e[2], 0);
  const dead = packBytes ? 1 - used / packBytes : 0;
  if (dead > DEAD_MAX_SHARE) errors.push(`index.json: ${Math.round(dead * 100)} % of the packs' bytes are unused, above ${DEAD_MAX_SHARE * 100} %`);
  if (errors.length) return fail();
  const counts = countsOf(index);
  for (const kind of PICTURE_KINDS) {
    if (counts[kind] < PICTURE_FLOOR[kind]) errors.push(`index.json: ${counts[kind]} ${kind} entries, below the floor of ${PICTURE_FLOOR[kind]}`);
  }
  if (meta) {
    if (meta.builtAt !== index.builtAt) errors.push(`index.json: built at ${String(index.builtAt)}, meta.json at ${meta.builtAt}`);
    for (const field of COUNT_FIELDS) {
      if (meta.counts?.[field] !== counts[field]) errors.push(`meta.json: counts.${field} is ${String(meta.counts?.[field])}, the index holds ${counts[field]}`);
    }
  }
  if (previous) {
    for (const kind of PICTURE_KINDS) {
      const before = previous[kind];
      if (!before) continue;
      const share = counts[kind] / before;
      if (share < PICTURE_SHRINK_ERROR) errors.push(`index.json: ${counts[kind]} ${kind} entries against ${before} last time (${Math.round(share * 100)} %)`);
    }
  }
  if (dead > DEAD_MAX_SHARE / 2) warnings.push(`${Math.round(dead * 100)} % of the packs' bytes are unused`);
  return { ok: errors.length === 0, errors, warnings, counts };
}
function checkPicturesMeta(meta, { now = Date.now() } = {}) {
  const errors = [];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return { ok: false, errors: ["meta.json: not an object"] };
  const m = meta;
  const foreign = Object.keys(m).filter((key) => !META_FIELDS.includes(key));
  if (foreign.length) errors.push(`meta.json: fields outside the format: ${shown(foreign)}`);
  if (!isoTime(m.builtAt)) errors.push("meta.json: builtAt is not an ISO time");
  else if (Date.parse(m.builtAt) > now + PICTURES_CLOCK_SKEW_MS) errors.push(`meta.json: builtAt ${m.builtAt} lies more than a day in the future`);
  if (m.tookMs !== void 0 && !count(m.tookMs)) errors.push("meta.json: tookMs is not a count of milliseconds");
  if (!within(1, PROCESS_MAX)(m.process)) errors.push(`meta.json: process is not a version of 1 to ${PROCESS_MAX}`);
  const counts = m.counts;
  if (!only(counts, COUNT_FIELDS) || !COUNT_FIELDS.every((field) => count(counts[field]))) {
    errors.push(`meta.json: counts is not a count of each of ${COUNT_FIELDS.join(", ")}`);
  }
  const digest = m.index;
  if (!only(digest, DIGEST_FIELDS) || !sha256Hex(digest.sha256) || !within(1, INDEX_MAX_BYTES)(digest.bytes)) {
    errors.push(`meta.json: index is not a sha256 of 64 hex digits with 1 to ${INDEX_MAX_BYTES} bytes`);
  }
  return { ok: errors.length === 0, errors };
}
function checkPack(bytes, digest, index, pack) {
  const errors = [];
  const entry = index.packs[pack];
  if (!entry) return { ok: false, errors: [`pack ${pack}: not in the index`] };
  const file = packFileOf(entry.name);
  if (digest !== entry.name) errors.push(`${file}: its bytes have the digest ${digest.slice(0, 64)}`);
  if (bytes.length !== entry.bytes) errors.push(`${file}: ${bytes.length} bytes, the index says ${entry.bytes}`);
  if (errors.length) return { ok: false, errors };
  let odd = 0;
  for (const e of index.pictures) {
    if (e[0] !== pack) continue;
    const size = webpSize(bytes.subarray(e[1], e[1] + e[2]));
    if (!size || size.width !== e[3] || size.height !== e[4]) odd++;
  }
  if (odd) errors.push(`${file}: ${odd} pictures are no still WebP of the dimensions the index gives`);
  return { ok: errors.length === 0, errors };
}
function pictureOf(index, kind, id) {
  const n = index[kind][String(id)];
  return n === void 0 ? null : index.pictures[n] ?? null;
}
