'use strict';
// ---------------------------------------------------------------------
// COPY, generated from common/snapshot.ts in the arcana repository by
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
var snapshot_exports = {};
__export(snapshot_exports, {
  CARD_SHARE_ERROR: () => CARD_SHARE_ERROR,
  CARD_SHARE_WARN: () => CARD_SHARE_WARN,
  CLOCK_SKEW_MS: () => CLOCK_SKEW_MS,
  LOWEST_N: () => LOWEST_N,
  MIN_GAP_MS: () => MIN_GAP_MS,
  PRICE_MAX: () => PRICE_MAX,
  SNAPSHOT_FILE_PATTERN: () => SNAPSHOT_FILE_PATTERN,
  SNAPSHOT_SCHEMA: () => SNAPSHOT_SCHEMA,
  byCard: () => byCard,
  cardCountOf: () => cardCountOf,
  crawledAtOf: () => crawledAtOf,
  dedupeSnapshots: () => dedupeSnapshots,
  fileNameFor: () => fileNameFor,
  fingerprintOf: () => fingerprintOf,
  isSnapshotFileName: () => isSnapshotFileName,
  isSnapshotShape: () => isSnapshotShape,
  knownOf: () => knownOf,
  pathFor: () => pathFor,
  shopOrderKey: () => shopOrderKey,
  shopsOf: () => shopsOf,
  snapshotOf: () => snapshotOf,
  snapshotText: () => snapshotText,
  validateSnapshot: () => validateSnapshot
});
module.exports = __toCommonJS(snapshot_exports);
var import_node_crypto = require("node:crypto");
const SNAPSHOT_SCHEMA = 5;
const LOWEST_N = 10;
const PRICE_MAX = 1e10;
const PRICE_WARN = 2e9;
const CLOCK_SKEW_MS = 10 * 60 * 1e3;
const COMPARE_DEPTH = 5;
const CARD_SHARE_ERROR = 0.75;
const CARD_SHARE_WARN = 0.9;
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SNAPSHOT_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;
const fileNameFor = (iso) => `${iso.replace(/[:.]/g, "-")}.json`;
const pathFor = (iso) => `snapshots/${fileNameFor(iso)}`;
const isSnapshotFileName = (name) => typeof name === "string" && SNAPSHOT_FILE_PATTERN.test(name);
function crawledAtOf(name) {
  if (!isSnapshotFileName(name)) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(name);
  return `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
}
function fingerprintOf(snapshot) {
  const shops = snapshot?.shops ?? null;
  return (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(shops)).digest("hex");
}
const shopOrderKey = (shop) => JSON.stringify(shop.slice(0, 5));
const byCode = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function shopsOf(offers) {
  const shops = /* @__PURE__ */ new Map();
  for (const o of offers) {
    const who = [o.merchant, o.shop, o.map, o.x, o.y, []];
    const key = shopOrderKey(who);
    const shop = shops.get(key) ?? who;
    shops.set(key, shop);
    shop[5].push([o.itemId, o.price, o.amount]);
  }
  for (const shop of shops.values()) shop[5].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return [...shops].sort((a, b) => byCode(a[0], b[0])).map(([, shop]) => shop);
}
function snapshotOf(crawledAt, offers) {
  return {
    schemaVersion: SNAPSHOT_SCHEMA,
    crawledAt,
    complete: true,
    offerCount: offers.length,
    shops: shopsOf(offers)
  };
}
function snapshotText(snapshot) {
  const { shops, ...head } = snapshot;
  return `${JSON.stringify(head).slice(0, -1)},"shops":[
${shops.map((s) => JSON.stringify(s)).join(",\n")}
]}
`;
}
function byCard(snapshot, lowestN = LOWEST_N) {
  const offers = /* @__PURE__ */ new Map();
  for (const [merchant, shop, map, x, y, list] of snapshot.shops) {
    for (const [itemId, price, amount] of list) {
      const offer = {
        price,
        amount,
        merchant,
        shop,
        map,
        x,
        y
      };
      const held = offers.get(itemId);
      if (held) held.push(offer);
      else offers.set(itemId, [offer]);
    }
  }
  const cards = [];
  for (const [itemId, list] of offers) {
    list.sort((a, b) => a.price - b.price);
    const lowest = list.slice(0, lowestN).map((o) => o.price);
    cards.push({
      itemId,
      min: lowest[0],
      median: median(lowest),
      mean: Math.round(lowest.reduce((sum, v) => sum + v, 0) / lowest.length),
      max: lowest.at(-1),
      count: list.length,
      offers: list
    });
  }
  cards.sort((a, b) => a.itemId - b.itemId);
  return { crawledAt: snapshot.crawledAt, offerCount: snapshot.offerCount, cards };
}
function isSnapshotShape(data) {
  const candidate = data;
  return typeof candidate === "object" && candidate !== null && candidate.schemaVersion === SNAPSHOT_SCHEMA && typeof candidate.crawledAt === "string" && Array.isArray(candidate.shops) && candidate.shops.every((shop) => Array.isArray(shop) && Array.isArray(shop[5]));
}
function cardCountOf(data) {
  if (!isSnapshotShape(data)) return null;
  const ids = /* @__PURE__ */ new Set();
  for (const shop of data.shops) for (const offer of shop[5]) ids.add(Array.isArray(offer) ? offer[0] : void 0);
  return ids.size;
}
function knownOf(data, { fingerprint = true } = {}) {
  if (!isSnapshotShape(data)) return null;
  return {
    crawledAt: data.crawledAt,
    cardCount: cardCountOf(data),
    offerCount: isInt(data.offerCount) ? data.offerCount : null,
    ...fingerprint ? { fingerprint: fingerprintOf(data) } : {}
  };
}
const MIN_GAP_MS = 15 * 60 * 1e3;
function dedupeSnapshots(snapshots, { minGapMs = MIN_GAP_MS } = {}) {
  const sorted = snapshots.filter(Boolean).sort((a, b) => String(a.crawledAt).localeCompare(String(b.crawledAt)));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const snapshot of sorted) {
    const print = fingerprintOf(snapshot);
    if (seen.has(print)) continue;
    seen.add(print);
    const last = out.at(-1);
    const gap = last ? Date.parse(snapshot.crawledAt) - Date.parse(last.crawledAt) : Infinity;
    if (last && Number.isFinite(gap) && gap < minGapMs) {
      if ((snapshot.offerCount ?? 0) > (last.offerCount ?? 0)) out[out.length - 1] = snapshot;
      continue;
    }
    out.push(snapshot);
  }
  return out;
}
function median(values) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v) => v === null || typeof v === "string";
const isPlace = (v) => v === null || isInt(v);
function validateSnapshot(data, context = {}) {
  const {
    fileName = null,
    known = [],
    now = Date.now(),
    maxAgeDays = null
  } = context;
  const errors = [];
  const warnings = [];
  const reject = (text) => {
    errors.push(text);
  };
  if (!isObject(data)) return { ok: false, errors: ["Content is not an object."], warnings };
  if (!isInt(data.schemaVersion)) {
    reject("Field schemaVersion is missing or not an integer.");
  } else if (data.schemaVersion > SNAPSHOT_SCHEMA) {
    reject(`Schema version ${data.schemaVersion} is newer than the known ${SNAPSHOT_SCHEMA}.`);
  } else if (data.schemaVersion < SNAPSHOT_SCHEMA) {
    reject(`Schema version ${data.schemaVersion} is older than ${SNAPSHOT_SCHEMA}, the only one the store takes.`);
  }
  if (typeof data.complete !== "boolean") {
    reject("Field complete is missing or not a boolean.");
  } else if (!data.complete) {
    reject("The crawl is marked as aborted.");
  }
  const crawledAt = typeof data.crawledAt === "string" ? data.crawledAt : "";
  const time = Date.parse(crawledAt);
  if (!TIME_PATTERN.test(crawledAt) || Number.isNaN(time)) {
    reject("Field crawledAt is missing or not an ISO timestamp with milliseconds (2026-09-22T05:55:43.537Z).");
  } else {
    if (time > now + CLOCK_SKEW_MS) reject(`The timestamp lies in the future (${crawledAt}).`);
    if (maxAgeDays != null && now - time > maxAgeDays * 864e5) {
      reject(`The timestamp is older than ${maxAgeDays} days.`);
    }
    if (fileName && fileName !== fileNameFor(crawledAt)) {
      reject(`File name "${fileName}" does not match crawledAt (expected "${fileNameFor(crawledAt)}").`);
    }
    if (known.some((k) => k.crawledAt === crawledAt)) reject(`A run for ${crawledAt} already exists.`);
  }
  if (Array.isArray(data.shops) && data.shops.length) {
    const print = fingerprintOf(data);
    const twin = known.find((k) => k.fingerprint && k.fingerprint === print);
    if (twin) reject(`Identical to the run of ${twin.crawledAt} - same shops, same offers.`);
  }
  if (!Array.isArray(data.shops) || !data.shops.length) {
    reject("Field shops is missing or empty.");
    return { ok: false, errors, warnings };
  }
  const cards = /* @__PURE__ */ new Set();
  let offersCounted = 0;
  let previousKey = null;
  for (const [i, shop] of data.shops.entries()) {
    const at = `Shop ${i + 1}`;
    if (!Array.isArray(shop) || shop.length !== 6) {
      reject(`${at}: not a list of merchant, shop, map, x, y and offers.`);
      continue;
    }
    const [merchant, name, map, x, y, offers] = shop;
    if (!isText(merchant) || !isText(name) || !isText(map)) {
      reject(`${at}: merchant, shop and map are not text or null.`);
      continue;
    }
    if (!isPlace(x) || !isPlace(y)) {
      reject(`${at}: x and y are not integers or null.`);
      continue;
    }
    const key = shopOrderKey(shop);
    if (previousKey !== null && key === previousKey) reject(`${at}: appears more than once.`);
    else if (previousKey !== null && key < previousKey) reject(`${at}: the shops are not in order.`);
    previousKey = key;
    if (!Array.isArray(offers) || !offers.length) {
      reject(`${at}: has no offers.`);
      continue;
    }
    offersCounted += offers.length;
    let lastCard = -Infinity;
    let lastPrice = -Infinity;
    for (const offer of offers) {
      if (!Array.isArray(offer) || offer.length !== 3) {
        reject(`${at}: an offer is not a list of card, price and amount.`);
        break;
      }
      const [itemId, price, amount] = offer;
      if (!isInt(itemId) || itemId <= 0) {
        reject(`${at}: invalid itemId ${String(itemId)}.`);
        break;
      }
      if (!isNum(price) || price <= 0 || price > PRICE_MAX) {
        reject(`${at}: card ${itemId}: price ${String(price)} is implausible.`);
        break;
      }
      if (!isInt(amount) || amount <= 0) {
        reject(`${at}: card ${itemId}: amount ${String(amount)} is not a positive integer.`);
        break;
      }
      if (itemId < lastCard || itemId === lastCard && price < lastPrice) {
        reject(`${at}: the offers are not sorted by card and price.`);
        break;
      }
      if (price > PRICE_WARN) warnings.push(`Card ${itemId}: price ${price}.`);
      lastCard = itemId;
      lastPrice = price;
      cards.add(itemId);
    }
  }
  if (!isInt(data.offerCount) || data.offerCount <= 0) {
    reject("Field offerCount is missing or not a positive integer.");
  } else if (offersCounted !== data.offerCount) {
    reject(`offerCount = ${data.offerCount} but ${offersCounted} offers were counted.`);
  }
  const earlier = known.filter((k) => isInt(k.cardCount) && k.cardCount > 0).slice(-COMPARE_DEPTH);
  if (earlier.length >= 3) {
    const usual = median(earlier.map((k) => k.cardCount));
    const share = cards.size / usual;
    if (share < CARD_SHARE_ERROR) {
      reject(`${cards.size} cards, usually around ${Math.round(usual)} (${Math.round(share * 100)} %). This looks like an aborted crawl.`);
    } else if (share < CARD_SHARE_WARN) {
      warnings.push(`${cards.size} cards against the usual ${Math.round(usual)}.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
