'use strict';
// ---------------------------------------------------------------------
// COPY. The source lives in the code repository under src/validate.js.
// Do not edit here - syncing overwrites every change.
// ---------------------------------------------------------------------
/**
 * Snapshot validation.
 *
 * The same code runs in two places: in the app before a crawl is uploaded,
 * and in CI before a pull request is merged. Two separate copies would
 * drift apart, and the check would end up either too strict or absent.
 *
 * No Electron, no fs, nothing outside Node's own modules - so both sides
 * can just require it.
 *
 * Snapshots are anonymous: nothing records who submitted one. That is a
 * deliberate trade. It means a bad source cannot be excluded after the
 * fact, so the checks below are the only line of defence, and they are
 * written accordingly.
 */

const crypto = require('crypto');

const SNAPSHOT_SCHEMA = 4;

// Above this a price is no longer a typo but nonsense. The most expensive
// card observed so far sat at 400 million.
const PRICE_MAX = 1e10;
const PRICE_WARN = 2e9;

// Clocks drift; a timestamp slightly in the future is not an attempt at
// fraud.
const CLOCK_SKEW_MS = 10 * 60 * 1000;

// How an aborted crawl shows itself: it brings back noticeably fewer cards
// than the runs before it.
//
// The thresholds are tight because the data allows it: across day and
// night the first seven runs ranged from 348 to 365 cards, so +/- 2.5 %.
// Vending shops stay up overnight. A quarter fewer is no longer market
// movement.
//
// This matters more now that snapshots are anonymous: with no way to tell
// runs apart afterwards, an aborted crawl has to be caught here or not at
// all. Sale detection reads a missing offer as a sale.
const COMPARE_DEPTH = 5;
const CARD_SHARE_ERROR = 0.75;
const CARD_SHARE_WARN = 0.90;

const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => Number.isFinite(v);

/**
 * What a crawl saw, as one value. Only the card data: two runs that found
 * exactly the same market are the same observation of it, whatever time
 * is written on them.
 */
function fingerprintOf(snapshot) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(snapshot?.cards ?? null)).digest('hex');
}

/**
 * One market moment, one observation.
 *
 * Statistics count crawls. That is right as long as every crawl is an
 * independent look at the market, and wrong the moment the same look is
 * filed twice - the median then hears one voice several times.
 *
 * Measured on the real archive with three identical crawls added: the
 * usual price moved on 222 of 370 cards, in the worst case from 299,999
 * to 999,999. That figure is the buying advice's veto, so it decides what
 * gets recommended. Sale detection was untouched, because nothing
 * disappears between two identical crawls.
 *
 * Two rules, and the second one is the one the archive does not need yet:
 *
 *   - identical card data is the same observation, however it is dated
 *   - crawls closer together than MIN_GAP_MS are one moment, whoever
 *     took them. With several people crawling, two runs minutes apart
 *     say one thing about the market and would otherwise say it twice.
 *
 * The fullest crawl in a window wins, not the first: it is the better
 * view of the same moment. Nothing is deleted - this is about what the
 * statistics count, and the archive keeps everything.
 */
const MIN_GAP_MS = 15 * 60 * 1000;

/**
 * @param {Array} snapshots           parsed snapshots, in any order
 * @param {{minGapMs?: number}} [options]
 * @returns {Array} the snapshots that count as separate observations,
 *   ascending by crawl time. Nothing is written and nothing is deleted -
 *   this decides what the statistics count, and the archive keeps
 *   everything.
 */
function dedupeSnapshots(snapshots, { minGapMs = MIN_GAP_MS } = {}) {
  const sorted = [...(snapshots || [])]
    .filter(Boolean)
    .sort((a, b) => String(a.crawledAt).localeCompare(String(b.crawledAt)));

  const seen = new Set();
  const out = [];
  for (const snapshot of sorted) {
    const print = fingerprintOf(snapshot);
    if (seen.has(print)) continue;
    // Registered as soon as it has been looked at, not only when it is
    // kept. A crawl dropped for falling inside the window is still card
    // data that has now been seen, and the first rule says so however it
    // is dated - otherwise the same card data turning up again hours
    // later would count as a fresh look at the market purely because its
    // twin happened to be dropped for a different reason.
    seen.add(print);

    const last = out[out.length - 1];
    const gap = last
      ? Date.parse(snapshot.crawledAt) - Date.parse(last.crawledAt)
      : Infinity;
    if (Number.isFinite(gap) && gap < minGapMs) {
      // The same moment. Keep whichever saw more of it.
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

/**
 * File name for a snapshot: the timestamp, nothing else.
 *
 * Sorting by name is therefore sorting by time. Two crawls in the same
 * millisecond would collide, which at millisecond resolution does not
 * happen; if it ever did, the second one is rejected as a modification
 * rather than silently overwriting the first.
 */
const fileNameFor = (iso) => `${iso.replace(/[:.]/g, '-')}.json`;

/**
 * What a snapshot file may be called - the whole name, nothing else.
 *
 * A name that arrives from outside is never only a name: it gets joined
 * onto the snapshot folder to decide where a download lands. On Windows
 * `path.join` normalises backslashes too, so "..\..\x.json" out of a
 * published index would put the file somewhere else entirely. The name is
 * therefore matched against what fileNameFor() produces before anything
 * is built from it, rather than being trusted because it ends in .json.
 */
const SNAPSHOT_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;

/**
 * @param {*} name  a candidate file name, from anywhere
 * @returns {boolean} true only for a name this project would have written
 */
const isSnapshotFileName = (name) =>
  typeof name === 'string' && SNAPSHOT_FILE_PATTERN.test(name);

/** Path inside the repository. Flat, one file per crawl. */
const pathFor = (iso) => `snapshots/${fileNameFor(iso)}`;

/**
 * @param {object} data                   the parsed snapshot
 * @param {object} [context]
 * @param {string} [context.fileName]     what the path says the file is called
 * @param {Array}  [context.known]        earlier runs: { crawledAt, cardCount, offerCount }
 * @param {number} [context.now]          moment of validation
 * @param {number} [context.maxAgeDays]   null lifts the age limit (seeding the archive)
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
function validateSnapshot(data, context = {}) {
  const {
    fileName = null, known = [],
    now = Date.now(), maxAgeDays = null,
  } = context;

  const errors = [];
  const warnings = [];
  const reject = (t) => errors.push(t);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['Content is not an object.'], warnings };
  }

  // --- Schema version ---------------------------------------------------
  if (!isInt(data.schemaVersion)) {
    reject('Field schemaVersion is missing or not an integer.');
  } else if (data.schemaVersion > SNAPSHOT_SCHEMA) {
    reject(`Schema version ${data.schemaVersion} is newer than the known `
      + `${SNAPSHOT_SCHEMA}. The file is rejected rather than misread.`);
  } else if (data.schemaVersion < SNAPSHOT_SCHEMA) {
    warnings.push(`Schema version ${data.schemaVersion} instead of ${SNAPSHOT_SCHEMA}.`);
  }

  // --- Completeness -----------------------------------------------------
  // The one field that carries real weight. Sale detection reads a missing
  // offer as a sale, so an aborted crawl turns into hundreds of sales that
  // never happened.
  if (typeof data.complete !== 'boolean') {
    reject('Field complete is missing or not a boolean.');
  } else if (data.complete === false) {
    reject('The crawl is marked as aborted. Incomplete runs make sale '
      + 'detection see sales that never happened.');
  }

  // --- Timestamp --------------------------------------------------------
  const time = typeof data.crawledAt === 'string' ? Date.parse(data.crawledAt) : NaN;
  if (!TIME_PATTERN.test(data.crawledAt || '') || Number.isNaN(time)) {
    reject('Field crawledAt is missing or not an ISO timestamp with '
      + 'milliseconds (2026-09-22T05:55:43.537Z).');
  } else {
    if (time > now + CLOCK_SKEW_MS) {
      reject(`The timestamp lies in the future (${data.crawledAt}).`);
    }
    if (maxAgeDays != null && now - time > maxAgeDays * 86400000) {
      reject(`The timestamp is older than ${maxAgeDays} days.`);
    }
    if (fileName && fileName !== fileNameFor(data.crawledAt)) {
      reject(`File name "${fileName}" does not match crawledAt `
        + `(expected "${fileNameFor(data.crawledAt)}").`);
    }
    const duplicate = known.some((k) => k.crawledAt === data.crawledAt);
    if (duplicate) reject(`A run for ${data.crawledAt} already exists.`);
  }

  // --- The same look at the market, filed twice -------------------------
  // A crawl whose card data matches one already here carries no new
  // information, and it is not harmless: statistics count crawls, so the
  // median hears one voice several times. Measured on the real archive
  // with three identical runs added, the usual price moved on 222 of 370
  // cards - in the worst case from 299,999 to 999,999. That figure is
  // what the buying advice vetoes against.
  //
  // Only checked where the comparison material carries a fingerprint; a
  // caller that computes none loses nothing else.
  if (Array.isArray(data.cards) && data.cards.length) {
    const print = fingerprintOf(data);
    const twin = known.find((k) => k.fingerprint && k.fingerprint === print);
    if (twin) {
      reject(`Identical to the run of ${twin.crawledAt} - same cards, same `
        + 'offers, nothing moved. A crawl filed twice skews every figure '
        + 'that counts crawls.');
    }
  }

  // --- Cards ------------------------------------------------------------
  if (!Array.isArray(data.cards) || !data.cards.length) {
    reject('Field cards is missing or empty.');
    return { ok: false, errors, warnings };
  }

  const seen = new Set();
  let offersCounted = 0;
  let withOffers = 0;

  for (const card of data.cards) {
    const at = `Card ${card && card.itemId !== undefined ? card.itemId : '?'}`;
    if (!card || typeof card !== 'object') { reject(`${at}: not an object.`); continue; }

    if (!isInt(card.itemId) || card.itemId <= 0) { reject(`${at}: invalid itemId.`); continue; }
    if (seen.has(card.itemId)) { reject(`${at}: appears more than once.`); continue; }
    seen.add(card.itemId);

    for (const field of ['min', 'median', 'mean', 'max']) {
      if (!isNum(card[field]) || card[field] <= 0) {
        reject(`${at}: ${field} is not a positive number.`);
      } else if (card[field] > PRICE_MAX) {
        reject(`${at}: ${field} = ${card[field]} is implausibly high.`);
      } else if (card[field] > PRICE_WARN) {
        warnings.push(`${at}: ${field} = ${card[field]}.`);
      }
    }
    if (isNum(card.min) && isNum(card.max) && card.min > card.max) {
      reject(`${at}: min (${card.min}) is above max (${card.max}).`);
    }
    if (isNum(card.min) && isNum(card.median) && card.min > card.median) {
      reject(`${at}: min (${card.min}) is above median (${card.median}).`);
    }
    if (!isInt(card.count) || card.count <= 0) {
      reject(`${at}: count is not a positive integer.`);
    }

    if (card.offers === undefined || card.offers === null) continue;
    if (!Array.isArray(card.offers)) { reject(`${at}: offers is not a list.`); continue; }
    withOffers++;
    offersCounted += card.offers.length;

    if (isInt(card.count) && card.offers.length > card.count) {
      reject(`${at}: ${card.offers.length} offers but count = ${card.count}.`);
    }
    let previous = -Infinity;
    for (const offer of card.offers) {
      if (!offer || typeof offer !== 'object') { reject(`${at}: offer is not an object.`); break; }
      if (!isNum(offer.price) || offer.price <= 0 || offer.price > PRICE_MAX) {
        reject(`${at}: offer price ${offer.price} is implausible.`); break;
      }
      if (!isInt(offer.amount) || offer.amount <= 0) {
        reject(`${at}: offer amount ${offer.amount} is not a positive integer.`); break;
      }
      // Offers are stored ascending; outlier detection relies on that
      // instead of sorting again.
      if (offer.price < previous) { reject(`${at}: offers are not sorted ascending.`); break; }
      previous = offer.price;
    }
    if (isNum(card.min) && card.offers.length && card.offers[0].price !== card.min) {
      reject(`${at}: min (${card.min}) is not the cheapest offer `
        + `(${card.offers[0].price}).`);
    }
  }

  // --- Offer count ------------------------------------------------------
  if (!isInt(data.offerCount) || data.offerCount <= 0) {
    reject('Field offerCount is missing or not a positive integer.');
  } else if (withOffers === data.cards.length && offersCounted !== data.offerCount) {
    reject(`offerCount = ${data.offerCount} but ${offersCounted} offers were counted.`);
  }

  // --- Cross-check against what is already there ------------------------
  // The actual purpose: an aborted crawl brings back too few cards, and the
  // missing ones later look like offers that were sold.
  const earlier = known
    .filter((k) => isInt(k.cardCount) && k.cardCount > 0)
    .slice(-COMPARE_DEPTH);
  if (earlier.length >= 3) {
    const usual = median(earlier.map((k) => k.cardCount));
    const share = data.cards.length / usual;
    if (share < CARD_SHARE_ERROR) {
      reject(`${data.cards.length} cards, usually around ${Math.round(usual)} `
        + `(${Math.round(share * 100)} %). This looks like an aborted crawl.`);
    } else if (share < CARD_SHARE_WARN) {
      warnings.push(`${data.cards.length} cards against the usual `
        + `${Math.round(usual)}.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = {
  validateSnapshot, fingerprintOf, dedupeSnapshots, MIN_GAP_MS,
  fileNameFor, pathFor, median, isSnapshotFileName, SNAPSHOT_FILE_PATTERN,
  SNAPSHOT_SCHEMA, PRICE_MAX, CLOCK_SKEW_MS, CARD_SHARE_ERROR, CARD_SHARE_WARN,
};
