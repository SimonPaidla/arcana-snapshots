<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img src="assets/logo-light.svg" alt="Arcana" width="200">
  </picture>
</p>

# Arcana snapshots

The shared data store of **Arcana**, a desktop app that follows the
vendor market of the uaRO private server and ranks its cards by value and
farmability. The app is on
[arcana-releases](https://github.com/SimonPaidla/arcana-releases).

Contributors crawl the market into this repository with **Arcana
Crawler** every full hour; every Arcana installation reads it.

| | Where | Arrives |
|---|---|---|
| **Crawls of the cards** | `snapshots/` on `main` | one pull request per crawl |
| **Parts of items** | `items/` on `main` | one pull request per part: an item type other than cards, or a list of item IDs |
| **Game data** | the `gamedata` branch | built daily from [rAthena](https://github.com/rathena/rathena)'s pre-renewal database, and its renewal database for the cards and items only that knows |

The archive starts on 24 September 2026 with snapshot schema 5.

## Reading the data

GitHub Pages serves these files, rebuilt from the archive by
`scripts/build-index.js`:

| File | Contents |
|---|---|
| [`index.json`](https://simonpaidla.github.io/arcana-snapshots/index.json) | every counted crawl with its path, time, card and offer count, and the crawls left out with the reason; under `items`, every part the validator passes, with its path, time, item and offer count |
| [`series.json`](https://simonpaidla.github.io/arcana-snapshots/series.json) | every card's min, median, mean, max and count in every counted crawl |
| [`latest.json`](https://simonpaidla.github.io/arcana-snapshots/latest.json) | the newest counted crawl as stored |

The game data is read from the `gamedata` branch:

| File | Contents |
|---|---|
| [`cards.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/cards.json) | the cards with their effects as text; `renewal: true` for a card only the renewal database knows |
| [`items.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/items.json) | every item of the vendor list's types: name, type, subtype, slots, NPC buy and sell price, weight; attack, defense, weapon level and the base level to equip it, or null; its equip locations as rAthena names them (`Head_Top`, `Armor`, `Right_Hand` …), whether it can be refined; its script as text where all of it reads as text (`effect`), else null; the lowest price an NPC shop of the pre-renewal merchants asks for it (`shop`), else null; `renewal: true` for an item only the renewal database knows |
| [`recipes.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/recipes.json) | what the pre-renewal produce database makes: the item, made one at a time, and the materials it uses up - a guide or cookbook that only has to be carried is not listed |
| [`pets.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/pets.json) | the pets of the pre-renewal pet database: mob, egg, the item that tames it and its food, or null; the bonus it gives at loyal intimacy as text, else null |
| [`mobs.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/mobs.json) | level, HP, element, race, size, MVP; `renewal: true` for a renewal mob that drops a renewal card |
| [`drops.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/drops.json) | which mob drops which item - every drop of the pre-renewal mobs, and the renewal cards' drops of the renewal mobs - at rAthena's base rate in percent, `source: "rathena"` |
| [`spawns.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/spawns.json) | how many of a mob stand on a map, and its respawn time in milliseconds |
| [`meta.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/meta.json) | build time, rAthena commit, and the count of each list |

Arcana reads `index.json`, the crawls and parts it lacks, and the game
data. `meta.json` on `main` names the store and its schemas:
`schemaVersion` for the crawls of the cards, `itemSchemaVersion` for the
parts of items.

## Contributing

Through Arcana Crawler, with a fine-grained token for this repository
that has write access to *contents* and *pull requests*. Each crawl and
each part is a pull request that adds one file, named after the full UTC
hour it was taken for:

```
snapshots/2026-10-08T17-00-00-000Z.json               a crawl of the cards
items/type-7/2026-10-08T17-00-00-000Z.json            every offer of one item type (here Pet Egg)
items/ids/2026-10-08T17-00-00-000Z-1a2b3c4d.json      every offer of a list of item IDs
```

**A crawl** is snapshot schema 5: the crawl time and the counts on the
first line, then every shop on a line of its own - merchant, shop name,
map, x, y, and its offers as `[itemId, price, amount]`, ascending by card
and price. Shops come in a fixed order, so an unchanged shop is the same
line in two crawls. Snapshots carry no contributor.

**A part** is item schema 1, with its scope (`{ "type": 7 }` or
`{ "items": [501, 607] }`) and the item names the control panel showed
(`names`) on the first line, and its shops as in a crawl. An offer is
`[itemId, price, amount]`, or `[itemId, price, amount, refine, cards]`
for a piece with a refine or socketed cards; equal offers in one shop are
separate pieces. `type-<id>` is the vendor list's type: 0 Healing,
2 Usable, 3 Etc, 4 Weapon, 5 Armor, 7 Pet Egg, 8 Pet Armor, 10 Ammo,
11 Delay Consume, 18 Cash Shop Reward - never 6 (Card). A
list's file name ends in the first eight hex digits of the SHA-256 of its
IDs, ascending, in decimal, joined by `,`.

The crawler runs the store's validation before it offers a file.

## The check

`.github/workflows/pull-request.yml` judges every pull request into
`main`; its job `validate` is the check the ruleset on `main` requires,
and auto-merge merges a pull request once it passes.

- It runs on `pull_request_target`: the workflow and `scripts/` are
  `main`'s, the pull request's commits are fetched as data, and nothing
  of the pull request is executed. `scripts/check-pr.js` reads each file
  with `git show`.
- The token is read-only (`contents: read`) and not kept in the checkout.

Refused:
- a modified, deleted or renamed file, and any path other than `snapshots/<time>.json`, `items/type-<id>/<time>.json` and `items/ids/<time>-<list>.json` - `.github/` and `scripts/` included;
- a symbolic link, an executable file, a submodule, and a file above 16 MB;
- under `snapshots/`, a file that is not snapshot schema 5 or whose name is not its crawl time;
- under `items/`, a file that is not item schema 1, a part of cards or of a type outside the vendor list, or one whose path is not the one its scope and crawl time name;
- a field outside the format - a snapshot carries nothing but its own fields;
- a crawl time that is not a full UTC hour, more than 10 minutes in the future or older than 30 days;
- a crawl whose shops are identical to one of the ten newest here;
- a price above ten billion; in a part, a refine above 20, more than four cards, an item outside its list, or names that are not the offered items' ids in decimal with well-formed text;
- a file the validator throws on.

A part with the same shops as one an hour before is taken: a quiet
market observed again.

The size of a crawl is not judged: a crawl of an empty market, during the
weekly maintenance, has no shops and an offer count of 0.

## Counting

`scripts/validate.js` decides which crawls count, for the index and for
Arcana alike: crawls with identical shops are one observation whatever
their time, and of crawls less than **15 minutes** apart the fullest
counts. `index.json` lists the crawls left out with the reason; the
archive keeps every file.

## Game data

`.github/workflows/gamedata.yml` builds the lists from about 210 files
of rAthena - its databases, every spawn file, and the merchants' files
of the pre-renewal NPC lists for the shop prices - (`scripts/mobdata.js`,
`scripts/carddesc.js`, `scripts/build-gamedata.js`) in a job with a
read-only token and `yaml` at a fixed version; a second job, the only
one that may write, commits them to the `gamedata` branch with
`scripts/publish-gamedata.sh`. `scripts/validate-gamedata.js` has to
accept a build first: every list above its floor and at 90 % or more of the
published build; every entry of its list's form - ids, names as text,
drop rates above 0 up to 100 %, amounts of 0 or more, an item's figures,
locations, effect and shop price where given -; every drop, spawn and
pet names a known mob; every card, every recipe's item and materials and
every pet's egg is an item, every item has a type of the vendor list;
enough cards drop, mobs spawn, card effects read as text and items have
an NPC shop price; drop rates from `rathena` only.
Arcana multiplies the base rates by the server's factor, one of its
settings.

No ruleset covers the `gamedata` branch: a token with write access to
*contents* - a contributor's among them - can push to it. Arcana takes a
build there only when `checkGameData()` accepts it. A ruleset on
`gamedata` that lets only the workflow push would close the branch.

## Maintenance

The ruleset on `main` has an **empty bypass list**. A push to `main`
therefore takes three steps:

1. *Settings → Rules →* the ruleset *→ Enforcement status:* `Disabled`
2. `git push`
3. *Enforcement status:* `Active`

**Step three follows step two in the same sitting**: in between, `main`
has no protection.

The game data workflow also starts by hand from the Actions tab.

## Copied code

Two files under `scripts/` are generated by `npm run store-copies` in the
app's repository and carry a banner saying so; they are edited there:

| Copy | Source |
|---|---|
| `scripts/validate.js` | `common/snapshot.ts` |
| `scripts/validate-gamedata.js` | `common/gamedata.ts` |

A change to a schema lands here first; the crawler that writes it is
released right after. `assets/` holds the app's logo.

## Layout

```
snapshots/            one file per crawl of the cards, added and never changed
items/                one file per part of items - type-<id>/, ids/ - added and never changed
scripts/              validation, the pull request check, the index and the game data builds
.github/workflows/    the three workflows below
assets/               the logo
meta.json             the store's name and schema versions
build/                the index build's output; not committed
gamedata/             the game data build's output; published to the gamedata branch, not committed
.cache-rathena/       rAthena's files, fetched by the game data build; not committed
```

| Workflow | When | What it does |
|---|---|---|
| `pull-request.yml` | every pull request into `main` | judges a contribution; `validate` is the required check |
| `pages.yml` | a push to `snapshots/` or `items/` on `main`, every six hours, on demand | builds the index and publishes it on Pages |
| `gamedata.yml` | 02:17 UTC daily, on demand | builds the game data and publishes the `gamedata` branch |

| Branch | What is on it | Who writes it |
|---|---|---|
| `main` | the archive, the scripts, the workflows | contributors, through accepted pull requests |
| `gamedata` | the seven built lists and their `meta.json` | the game data workflow |
| `crawl/<time>` | one offered crawl, the head of its pull request | Arcana Crawler |
| `crawl/items/<folder>/<name>` | one offered part, the head of its pull request | Arcana Crawler |
