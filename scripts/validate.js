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
  CARDS_MAX: () => CARDS_MAX,
  CARD_ITEM_TYPE: () => CARD_ITEM_TYPE,
  CLOCK_SKEW_MS: () => CLOCK_SKEW_MS,
  ITEM_LIST_MAX: () => ITEM_LIST_MAX,
  ITEM_NAME_MAX: () => ITEM_NAME_MAX,
  ITEM_SNAPSHOT_SCHEMA: () => ITEM_SNAPSHOT_SCHEMA,
  LOWEST_N: () => LOWEST_N,
  MIN_GAP_MS: () => MIN_GAP_MS,
  PART_ITEM_TYPES: () => PART_ITEM_TYPES,
  PRICE_MAX: () => PRICE_MAX,
  REFINE_MAX: () => REFINE_MAX,
  SNAPSHOT_FILE_PATTERN: () => SNAPSHOT_FILE_PATTERN,
  SNAPSHOT_SCHEMA: () => SNAPSHOT_SCHEMA,
  STORE_MAX_AGE_DAYS: () => STORE_MAX_AGE_DAYS,
  byCard: () => byCard,
  cardCountOf: () => cardCountOf,
  crawledAtOf: () => crawledAtOf,
  crawledAtOfItemPath: () => crawledAtOfItemPath,
  dedupeSnapshots: () => dedupeSnapshots,
  fileNameFor: () => fileNameFor,
  fingerprintOf: () => fingerprintOf,
  isItemPath: () => isItemPath,
  isItemSnapshotShape: () => isItemSnapshotShape,
  isSnapshotFileName: () => isSnapshotFileName,
  isSnapshotShape: () => isSnapshotShape,
  itemCountOf: () => itemCountOf,
  itemFolderOf: () => itemFolderOf,
  itemNameOf: () => itemNameOf,
  itemOfferOf: () => itemOfferOf,
  itemPathFor: () => itemPathFor,
  itemShopsOf: () => itemShopsOf,
  itemSnapshotOf: () => itemSnapshotOf,
  knownOf: () => knownOf,
  listKey: () => listKey,
  pathFor: () => pathFor,
  scopeProblem: () => scopeProblem,
  shopOrderKey: () => shopOrderKey,
  shopsOf: () => shopsOf,
  snapshotOf: () => snapshotOf,
  snapshotText: () => snapshotText,
  validateItemSnapshot: () => validateItemSnapshot,
  validateSnapshot: () => validateSnapshot
});
module.exports = __toCommonJS(snapshot_exports);
var import_node_crypto = require("node:crypto");
const SNAPSHOT_SCHEMA = 5;
const LOWEST_N = 10;
const PRICE_MAX = 1e10;
const PRICE_WARN = 2e9;
const CLOCK_SKEW_MS = 10 * 60 * 1e3;
const STORE_MAX_AGE_DAYS = 30;
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HOUR_MS = 36e5;
const SNAPSHOT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "crawledAt", "complete", "offerCount", "shops"]);
const ITEM_SNAPSHOT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "crawledAt", "complete", "scope", "offerCount", "names", "shops"]);
function timeProblem(crawledAt) {
  const time = Date.parse(crawledAt);
  if (!TIME_PATTERN.test(crawledAt) || Number.isNaN(time) || new Date(time).toISOString() !== crawledAt) {
    return "Field crawledAt is missing or not an ISO timestamp with milliseconds (2026-09-22T05:00:00.000Z).";
  }
  return time % HOUR_MS === 0 ? null : `The crawl time ${crawledAt} is not a full UTC hour.`;
}
function fieldsProblem(data, fields) {
  const other = Object.keys(data).filter((key) => !fields.has(key));
  return other.length ? `Fields outside the format: ${other.slice(0, 3).map((key) => JSON.stringify(key).slice(0, 40)).join(", ")}.` : null;
}
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
    const shops = snapshot.shops;
    if (Array.isArray(shops) && shops.length) {
      const print = fingerprintOf(snapshot);
      if (seen.has(print)) continue;
      seen.add(print);
    }
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
  const foreign = fieldsProblem(data, SNAPSHOT_FIELDS);
  if (foreign) reject(foreign);
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
  const badTime = timeProblem(crawledAt);
  if (badTime) {
    reject(badTime);
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
  if (!Array.isArray(data.shops)) {
    reject("Field shops is missing or not a list.");
    return { ok: false, errors, warnings };
  }
  const before = errors.length;
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
    }
  }
  if (errors.length === before && data.shops.length) {
    const print = fingerprintOf(data);
    const twin = known.find((k) => k.fingerprint && k.fingerprint === print);
    if (twin) reject(`Identical to the run of ${twin.crawledAt} - same shops, same offers.`);
  }
  if (!isInt(data.offerCount) || data.offerCount < 0) {
    reject("Field offerCount is missing or not an integer of 0 or more.");
  } else if (offersCounted !== data.offerCount) {
    reject(`offerCount = ${data.offerCount} but ${offersCounted} offers were counted.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
const ITEM_SNAPSHOT_SCHEMA = 1;
const CARD_ITEM_TYPE = 6;
const PART_ITEM_TYPES = [0, 2, 3, 4, 5, 7, 8, 10, 11, 18];
const ITEM_LIST_MAX = 1e3;
const REFINE_MAX = 20;
const CARDS_MAX = 4;
const ITEM_NAME_MAX = 100;
function itemNameOf(listed) {
  let name = "";
  for (const char of listed.replace(/\s*\[\d+\]\s*$/, "").trim()) {
    if (name.length + char.length > ITEM_NAME_MAX) break;
    name += char;
  }
  return name.trim();
}
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const ITEM_PATH = /^items\/(?:type-(\d{1,2})|ids)\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(-[0-9a-f]{8})?\.json$/;
const listKey = (items) => (0, import_node_crypto.createHash)("sha256").update(items.join(",")).digest("hex").slice(0, 8);
const itemFolderOf = (scope) => "type" in scope ? `type-${scope.type}` : "ids";
function itemPathFor(scope, crawledAt) {
  const name = fileNameFor(crawledAt);
  const file = "type" in scope ? name : `${name.slice(0, -".json".length)}-${listKey(scope.items)}.json`;
  return `items/${itemFolderOf(scope)}/${file}`;
}
function isItemPath(value) {
  if (typeof value !== "string") return false;
  const m = ITEM_PATH.exec(value);
  if (!m) return false;
  if (m[1] === void 0) return m[3] !== void 0;
  return m[3] === void 0 && String(Number(m[1])) === m[1] && PART_ITEM_TYPES.includes(Number(m[1]));
}
function crawledAtOfItemPath(value) {
  if (!isItemPath(value)) return null;
  return crawledAtOf(`${ITEM_PATH.exec(value)[2]}.json`);
}
function itemOfferOf(offer) {
  return offer.refine || offer.cards.length ? [offer.itemId, offer.price, offer.amount, offer.refine, [...offer.cards]] : [offer.itemId, offer.price, offer.amount];
}
function compareItemOffers(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3] ?? 0) - (b[3] ?? 0) || byCode(JSON.stringify(a[4] ?? []), JSON.stringify(b[4] ?? []));
}
function itemShopsOf(offers) {
  const shops = /* @__PURE__ */ new Map();
  for (const o of offers) {
    const who = [o.merchant, o.shop, o.map, o.x, o.y, []];
    const key = shopOrderKey(who);
    const shop = shops.get(key) ?? who;
    shops.set(key, shop);
    shop[5].push(itemOfferOf(o));
  }
  for (const shop of shops.values()) shop[5].sort(compareItemOffers);
  return [...shops].sort((a, b) => byCode(a[0], b[0])).map(([, shop]) => shop);
}
function itemSnapshotOf(crawledAt, scope, offers, names = /* @__PURE__ */ new Map()) {
  const shown = [...new Set(offers.map((o) => o.itemId))].sort((a, b) => a - b).flatMap((itemId) => {
    const name = itemNameOf(names.get(itemId) ?? "");
    return name ? [[String(itemId), name]] : [];
  });
  return {
    schemaVersion: ITEM_SNAPSHOT_SCHEMA,
    crawledAt,
    complete: true,
    scope: "type" in scope ? { type: scope.type } : { items: [...scope.items] },
    offerCount: offers.length,
    names: Object.fromEntries(shown),
    shops: itemShopsOf(offers)
  };
}
function isItemSnapshotShape(data) {
  const candidate = data;
  return typeof candidate === "object" && candidate !== null && candidate.schemaVersion === ITEM_SNAPSHOT_SCHEMA && typeof candidate.crawledAt === "string" && isObject(candidate.scope) && isObject(candidate.names) && Array.isArray(candidate.shops) && candidate.shops.every((shop) => Array.isArray(shop) && Array.isArray(shop[5]));
}
function itemCountOf(data) {
  if (!isItemSnapshotShape(data)) return null;
  const ids = /* @__PURE__ */ new Set();
  for (const shop of data.shops) for (const offer of shop[5]) ids.add(Array.isArray(offer) ? offer[0] : void 0);
  return ids.size;
}
function scopeProblem(scope) {
  if (!isObject(scope)) return "Field scope is missing or not an object.";
  const keys = Object.keys(scope);
  if (keys.length === 1 && keys[0] === "type") {
    if (scope.type === CARD_ITEM_TYPE) return "Cards are a card snapshot of their own, not a part of items.";
    if (!isInt(scope.type) || !PART_ITEM_TYPES.includes(scope.type)) return "The scope's type is not an item type of the vendor list.";
    return null;
  }
  if (keys.length === 1 && keys[0] === "items") {
    const items = scope.items;
    if (!Array.isArray(items) || !items.length || items.length > ITEM_LIST_MAX) {
      return `The scope's items are not a list of 1 to ${ITEM_LIST_MAX} items.`;
    }
    for (const [i, item] of items.entries()) {
      if (!isInt(item) || item <= 0) return `The scope's item ${String(item)} is not an item ID.`;
      if (i > 0 && item <= items[i - 1]) return "The scope's items are not ascending without repeats.";
    }
    return null;
  }
  return "The scope is neither a type nor a list of items.";
}
function validateItemSnapshot(data, context = {}) {
  const { path = null, now = Date.now(), maxAgeDays = null } = context;
  const errors = [];
  const warnings = [];
  const reject = (text) => {
    errors.push(text);
  };
  if (!isObject(data)) return { ok: false, errors: ["Content is not an object."], warnings };
  const foreign = fieldsProblem(data, ITEM_SNAPSHOT_FIELDS);
  if (foreign) reject(foreign);
  if (!isInt(data.schemaVersion)) {
    reject("Field schemaVersion is missing or not an integer.");
  } else if (data.schemaVersion !== ITEM_SNAPSHOT_SCHEMA) {
    reject(`Schema version ${data.schemaVersion} is not ${ITEM_SNAPSHOT_SCHEMA}, the only one the store takes for items.`);
  }
  if (typeof data.complete !== "boolean") {
    reject("Field complete is missing or not a boolean.");
  } else if (!data.complete) {
    reject("The crawl is marked as aborted.");
  }
  const problem = scopeProblem(data.scope);
  if (problem) reject(problem);
  const scope = problem === null ? data.scope : null;
  const listed = scope && "items" in scope ? new Set(scope.items) : null;
  const offered = /* @__PURE__ */ new Set();
  const crawledAt = typeof data.crawledAt === "string" ? data.crawledAt : "";
  const time = Date.parse(crawledAt);
  const badTime = timeProblem(crawledAt);
  if (badTime) {
    reject(badTime);
  } else {
    if (time > now + CLOCK_SKEW_MS) reject(`The timestamp lies in the future (${crawledAt}).`);
    if (maxAgeDays != null && now - time > maxAgeDays * 864e5) reject(`The timestamp is older than ${maxAgeDays} days.`);
    if (scope) {
      const expected = itemPathFor(scope, crawledAt);
      if (path && path !== expected) reject(`Path "${path}" does not match the scope and crawledAt (expected "${expected}").`);
    }
  }
  if (!Array.isArray(data.shops)) {
    reject("Field shops is missing or not a list.");
    return { ok: false, errors, warnings };
  }
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
    let last = null;
    for (const offer of offers) {
      const why = itemOfferProblem(offer, listed);
      if (why) {
        reject(`${at}: ${why}`);
        break;
      }
      const sound = offer;
      if (last && compareItemOffers(last, sound) > 0) {
        reject(`${at}: the offers are not sorted by item, price, amount, refine and cards.`);
        break;
      }
      if (sound[1] > PRICE_WARN) warnings.push(`Item ${sound[0]}: price ${sound[1]}.`);
      offered.add(sound[0]);
      last = sound;
    }
  }
  if (!isObject(data.names)) {
    reject("Field names is missing or not an object.");
  } else {
    for (const [id, name] of Object.entries(data.names)) {
      if (String(Number(id)) !== id || !offered.has(Number(id))) {
        reject(`Names: ${JSON.stringify(id).slice(0, 40)} is not the id of an item a shop offers.`);
        break;
      }
      if (typeof name !== "string" || !name.trim() || name.length > ITEM_NAME_MAX || LONE_SURROGATE.test(name)) {
        reject(`Names: the name of item ${id} is not well-formed text of 1 to ${ITEM_NAME_MAX} characters.`);
        break;
      }
    }
  }
  if (!isInt(data.offerCount) || data.offerCount < 0) {
    reject("Field offerCount is missing or not an integer of 0 or more.");
  } else if (offersCounted !== data.offerCount) {
    reject(`offerCount = ${data.offerCount} but ${offersCounted} offers were counted.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
function itemOfferProblem(offer, listed) {
  if (!Array.isArray(offer) || offer.length !== 3 && offer.length !== 5) {
    return "an offer is not a list of item, price and amount, with refine and cards for equipment.";
  }
  const [itemId, price, amount, refine, cards] = offer;
  if (!isInt(itemId) || itemId <= 0) return `invalid itemId ${String(itemId)}.`;
  if (listed && !listed.has(itemId)) return `item ${itemId} is not one of the scope's items.`;
  if (!isNum(price) || price <= 0 || price > PRICE_MAX) return `item ${itemId}: price ${String(price)} is implausible.`;
  if (!isInt(amount) || amount <= 0) return `item ${itemId}: amount ${String(amount)} is not a positive integer.`;
  if (offer.length === 3) return null;
  if (!isInt(refine) || refine < 0 || refine > REFINE_MAX) return `item ${itemId}: refine ${String(refine)} is not 0 to ${REFINE_MAX}.`;
  if (!Array.isArray(cards) || cards.length > CARDS_MAX || !cards.every((c) => isInt(c) && c > 0)) {
    return `item ${itemId}: the cards are not a list of up to ${CARDS_MAX} item IDs.`;
  }
  if (refine === 0 && cards.length === 0) return `item ${itemId}: the long form without refine or cards.`;
  return null;
}
