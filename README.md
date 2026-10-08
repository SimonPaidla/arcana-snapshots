<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img src="assets/logo-light.svg" alt="Arcana" width="200">
  </picture>
</p>

# Arcana snapshots

The shared data store of **Arcana**, a desktop app that follows the
vendor market of a Ragnarok Online server and ranks its cards, items and
monsters by what they are worth and bring. The app is on
[arcana-releases](https://github.com/SimonPaidla/arcana-releases).

Contributors add the market to this repository with **Arcana Crawler**
every full hour; every Arcana installation reads it.

| | Where | Arrives |
|---|---|---|
| **Crawls of the cards** | `snapshots/` on `main` | every full hour, through an accepted pull request |
| **Parts of items** | `items/` on `main` | with the crawl of their hour: an item type other than cards, or a list of item IDs |
| **Game data** | `gamedata/` on `main`, published on the `gamedata` branch | built by hand from the server's own item and monster database and [rAthena](https://github.com/rathena/rathena)'s pre-renewal database for everything else - its renewal database for the cards and items only that knows -, through an accepted pull request; a build holds until the next |

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
| [`items.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/items.json) | every item of the market's item types: name, type, subtype, slots, NPC buy and sell price, weight; attack, defense, weapon level and the base level to equip it, or null; its equip locations as rAthena names them (`Head_Top`, `Armor`, `Right_Hand` …), whether it can be refined; its script as text where all of it reads as text (`effect`), else null; the lowest price an NPC shop of the pre-renewal merchants asks for it (`shop`), else null; `renewal: true` for an item only the renewal database knows; `from: "server"` where name, NPC prices and weight are the server's own |
| [`recipes.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/recipes.json) | what the pre-renewal produce database makes: the item, made one at a time, and the materials it uses up - a guide or cookbook that only has to be carried is not listed |
| [`pets.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/pets.json) | the pets of the pre-renewal pet database: mob, egg, the item that tames it and its food, or null; the bonus it gives at loyal intimacy as text, else null |
| [`mobs.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/mobs.json) | level, HP, element, race, size, MVP; `renewal: true` for a renewal mob that drops a renewal card; `from: "server"` where these are the server's own |
| [`drops.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/drops.json) | which mob drops which item - every drop of the pre-renewal mobs, and the renewal cards' drops of the renewal mobs - in percent: a mob the server's database lists with the server's own rate (`source: "server"`), any other at rAthena's base rate (`source: "rathena"`) |
| [`spawns.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/spawns.json) | how many of a mob stand on a map, and its respawn time in milliseconds |
| [`meta.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/meta.json) | build time, rAthena commit, what the server's database gave, and the count of each list |

Arcana reads `index.json`, the crawls and parts it lacks, and the game
data. `meta.json` on `main` names the store and its schemas:
`schemaVersion` for the crawls of the cards, `itemSchemaVersion` for the
parts of items.

## Contributing

Through Arcana Crawler, with access the maintainer grants. A contribution
only adds files, each named after the full UTC hour it was taken for:

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
`{ "items": [501, 607] }`) and the items' names as the market lists them
(`names`) on the first line, and its shops as in a crawl. An offer is
`[itemId, price, amount]`, or `[itemId, price, amount, refine, cards]`
for a piece with a refine or socketed cards; equal offers in one shop are
separate pieces. `type-<id>` is the market's item type: 0 Healing,
2 Usable, 3 Etc, 4 Weapon, 5 Armor, 7 Pet Egg, 8 Pet Armor, 10 Ammo,
11 Delay Consume, 18 Cash Shop Reward - never 6 (Card). A
list's file name ends in the first eight hex digits of the SHA-256 of its
IDs, ascending, in decimal, joined by `,`.

**A build of the game data** comes on its own: the files of
`gamedata/` - `cards`, `mobs`, `drops`, `spawns`, `items`, `recipes`,
`pets` and `meta`, each `.json` - added or modified, `meta.json` among
them.

## The check

`.github/workflows/pull-request.yml` judges every pull request into
`main`; its job `validate` is the check the ruleset on `main` requires,
and auto-merge merges a pull request once it passes.

- It runs on `pull_request_target`: the workflow and `scripts/` are
  `main`'s, the pull request's commits are fetched as data, and nothing
  of the pull request is executed. `scripts/check-pr.js` reads each file
  with `git show`.
- The token is read-only (`contents: read`) and not kept in the checkout.
- A pull request passes only when every file in it does: one file refused
  holds up the others of its pull request.

Refused:
- a modified, deleted or renamed file outside a build of the game data, and any path other than `snapshots/<time>.json`, `items/type-<id>/<time>.json`, `items/ids/<time>-<list>.json` and the files of `gamedata/` - `.github/` and `scripts/` included;
- a build of the game data beside any other file, one that deletes a file of it or leaves `meta.json` as it was, one `scripts/validate-gamedata.js` refuses against the counts of the published build, and one built before the build it replaces;
- a symbolic link, an executable file, a submodule, and a file above 16 MB;
- under `snapshots/`, a file that is not snapshot schema 5 or whose name is not its crawl time;
- under `items/`, a file that is not item schema 1, a part of cards or of a type outside the market's item types, or one whose path is not the one its scope and crawl time name;
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

A build is made by hand with Arcana Crawler: the server's own item list,
monster list and every monster's drops, over rAthena's databases at
their newest commit - its spawn files, and the merchants' files of the
pre-renewal NPC lists for the shop prices. The server's figures win
where it has the item or the monster; rAthena's fill in the rest. It is
offered as a pull request into `main` that writes `gamedata/`; once
merged, `.github/workflows/gamedata.yml` - the only job that may write -
commits it to the `gamedata` branch with `scripts/publish-gamedata.sh`,
which judges it again first. `scripts/validate-gamedata.js` has to
accept a build: every list above its floor and at 90 % or more of the
published build; every entry of its list's form - ids, names as text,
drop rates above 0 up to 100 %, amounts of 0 or more, an item's figures,
locations, effect and shop price where given -; every drop, spawn and
pet names a known mob; every card, every recipe's item and materials and
every pet's egg is an item, every item has one of the market's item types;
enough cards drop, mobs spawn, card effects read as text and items have
an NPC shop price; every drop rate from `server` or `rathena`; a
`meta.json` whose counts are its lists' lengths.
Arcana multiplies rAthena's base rates by the server's factor, one of its
settings, and takes the server's own rates as they are.

Arcana takes a build from the `gamedata` branch only when
`checkGameData()` accepts it.

## Maintenance

The ruleset on `main` has an **empty bypass list**. A push to `main`
therefore takes three steps:

1. *Settings → Rules →* the ruleset *→ Enforcement status:* `Disabled`
2. `git push`
3. *Enforcement status:* `Active`

**Step three follows step two in the same sitting**: in between, `main`
has no protection.

The game data workflow also starts by hand from the Actions tab: it
publishes the build on `main` again.

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
scripts/              validation, the pull request check, the index build, the game data's publishing
.github/workflows/    the three workflows below
assets/               the logo
meta.json             the store's name and schema versions
build/                the index build's output; not committed
gamedata/             the newest build of the game data, through accepted pull requests
```

| Workflow | When | What it does |
|---|---|---|
| `pull-request.yml` | every pull request into `main` | judges a contribution; `validate` is the required check |
| `pages.yml` | a push to `snapshots/` or `items/` on `main`, every six hours, on demand | builds the index and publishes it on Pages |
| `gamedata.yml` | a push to `gamedata/` on `main`, on demand | publishes the build on the `gamedata` branch |

| Branch | What is on it | Who writes it |
|---|---|---|
| `main` | the archive, the game data's newest build, the scripts, the workflows | contributors, through accepted pull requests |
| `gamedata` | the published build: seven lists and their `meta.json` | the game data workflow |
| `crawl/…` | an offered crawl, the head of its pull request | Arcana Crawler |
