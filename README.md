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
| **Game data** | `gamedata/` on `main` (copied to the `gamedata` branch for older installations) | built by hand from the server's own item and monster database and [rAthena](https://github.com/rathena/rathena)'s pre-renewal database for everything else - its renewal database for the cards and items only that knows -, through an accepted pull request; a build holds until the next |
| **Pictures** | `pictures/` on `main` | each item's icon and image and each mob's picture as the server's control panel shows them, as WebP, through an accepted pull request after a build of the game data |

The archive starts on 24 September 2026 with snapshot schema 5.

## Reading the data

GitHub Pages serves these files, rebuilt from the archive by
`scripts/build-index.js`:

| File | Contents |
|---|---|
| [`index.json`](https://simonpaidla.github.io/arcana-snapshots/index.json) | every counted crawl with its path, time, card and offer count, and the crawls left out with the reason; under `items`, every part the validator passes, with its path, time, item and offer count |
| [`recent.json`](https://simonpaidla.github.io/arcana-snapshots/recent.json) | `index.json` restricted to the last 32 days: the crawls within them of the newest crawl, the parts within them of the newest part - none dated more than 10 minutes ahead of the build |
| [`series.json`](https://simonpaidla.github.io/arcana-snapshots/series.json) | every card's min, median, mean, max and count in every counted crawl |
| [`latest.json`](https://simonpaidla.github.io/arcana-snapshots/latest.json) | the newest counted crawl as stored |

The game data lies in `gamedata/` on `main`, behind the check every pull
request passes; the `gamedata` branch holds a copy for installations that
read it there, until they have updated:

| File | Contents |
|---|---|
| [`cards.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/cards.json) | the cards with their effects as text; `renewal: true` for a card only the renewal database knows |
| [`items.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/items.json) | every item of the market's item types: name, type, subtype, slots, NPC buy and sell price, weight; attack, defense, weapon level and the base level to equip it, or null; its equip locations as rAthena names them (`Head_Top`, `Armor`, `Right_Hand` …), whether it can be refined; its script as text where all of it reads as text (`effect`), else null; the lowest price an NPC shop of the pre-renewal merchants asks for it (`shop`), else null; `renewal: true` for an item only the renewal database knows; `from: "server"` where name, NPC prices and weight are the server's own |
| [`recipes.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/recipes.json) | what the pre-renewal produce database makes: the item, made one at a time, and the materials it uses up - a guide or cookbook that only has to be carried is not listed |
| [`pets.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/pets.json) | the pets of the pre-renewal pet database: mob, egg, the item that tames it and its food, or null; the bonus it gives at loyal intimacy as text, else null |
| [`mobs.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/mobs.json) | level, HP, element, race, size, MVP; `renewal: true` for a renewal mob that drops a renewal card; `from: "server"` where these are the server's own |
| [`drops.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/drops.json) | which mob drops which item - every drop of the pre-renewal mobs, and the renewal cards' drops of the renewal mobs - in percent: a mob the server's database lists with the server's own rate (`source: "server"`), any other at rAthena's base rate (`source: "rathena"`) |
| [`spawns.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/spawns.json) | how many of a mob stand on a map, and its respawn time in milliseconds |
| [`meta.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/gamedata/meta.json) | build time, rAthena commit, what the server's database gave, the count of each list, and the sha256 of each list's file |

The pictures lie in `pictures/` on `main`, behind the same check:

| File | Contents |
|---|---|
| [`meta.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/main/pictures/meta.json) | when the set was made, the version of the processing that made it, the count of icons, images, mobs, images on a tile, pictures and packs, and the sha256 and length of `index.json` |
| `index.json` | every picture once - `[pack, offset, length, width, height, flags]`, flag 1 an item image kept on its white backdrop and shown on a light tile -, the packs by name and length, and which item id shows which icon (`icon`) and image (`image`), which mob id which picture (`mob`), and the icon and image every card shows (`card`) |
| `packs/<sha256>.pack` | WebP pictures end to end, named after the sha256 of their bytes; a pack is added and never changed, and deleted once the index no longer names it |

Arcana reads `index.json`, the crawls and parts it lacks, the game
data, and the pictures. `meta.json` on `main` names the store and its schemas:
`schemaVersion` for the crawls of the cards, `itemSchemaVersion` for the
parts of items.

## Contributing

Through Arcana Crawler, with access the maintainer grants. A contribution
only adds files of one full UTC hour, each named after it - 32 at most,
at most one list of item IDs among them:

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
them; the build that results holds all eight.

**A set of pictures** comes on its own too: `pictures/meta.json` and
`pictures/index.json` added or modified, `meta.json` among them, packs
under `pictures/packs/` added, and deleted where the index no longer
names them.

## The check

`.github/workflows/pull-request.yml` judges every pull request into
`main` - when it is opened, pushed to, reopened or edited (its title,
body or base); its job `validate` is the check the ruleset on `main`
requires, from GitHub Actions, and auto-merge merges a pull request once
it passes. The ruleset also requires a code owner's review, and
`.github/CODEOWNERS` gives every file but `snapshots/`, `items/`,
`gamedata/` and `pictures/` to the maintainer - a pull request that
touches a workflow, a script or anything else waits for the maintainer.

A check is matched by its name and its source, and every workflow that
runs here runs as GitHub Actions - one a contributor pushes on a branch
of their own as well, which runs without a pull request or a review. The
code owner's review keeps such a workflow off `main`, not from running:
that a passing `validate` is this workflow's judgement rests on who may
write to this repository, the contributors the maintainer grants access.

- It runs on `pull_request_target`: the workflow and `scripts/` are
  `main`'s, the pull request's commits are fetched as data, and nothing
  of the pull request is executed. `scripts/check-pr.js` reads each file
  with `git show`. It fetches `main` with its history, the pull request's
  head and the newest commit of `gamedata`, and no other branch.
- The token is read-only (`contents: read`) and not kept in the checkout.
  Every action is pinned by its commit.
- A pull request passes only when every file in it does: one file refused
  holds up the others of its pull request.
- What it prints is one line per line: a control character a
  contribution names is printed as `\uXXXX`, and its annotations carry
  their text escaped as GitHub reads workflow commands.

Refused:
- a modified, deleted or renamed file outside a build of the game data or a set of pictures, and any path other than `snapshots/<time>.json`, `items/type-<id>/<time>.json`, `items/ids/<time>-<list>.json`, the files of `gamedata/` and those of `pictures/` - `.github/` and `scripts/` included;
- more than 32 files; files of more than one crawl time; more than one list of item IDs, or a list that would make more than four of one crawl time;
- a build of the game data beside any other file, one that deletes a file of it or leaves `meta.json` as it was, one that lacks one of its eight files, one whose list is not the file `meta.json` names by sha256, one `scripts/validate-gamedata.js` refuses against the counts of the build it replaces (the one on `main`, else the copy on `gamedata`), one built more than a day ahead of now, and one built before the build it replaces - whose build time, if it lies in the future, does not count;
- a set of pictures beside any other file, one that changes a pack or leaves `meta.json` as it was, one whose `index.json` is not the one `meta.json` gives by sha256 and length, one `scripts/validate-pictures.js` refuses against the counts of the set it replaces, one missing a pack its index names or holding one it does not, a pack whose sha256 is not its name or whose pictures are not the index's, and one made more than a day ahead of now or before the set it replaces;
- a symbolic link, an executable file, a submodule, and a file above 16 MB;
- under `snapshots/`, a file that is not snapshot schema 5 or whose name is not its crawl time;
- under `items/`, a file that is not item schema 1, a part of cards or of a type outside the market's item types, or one whose path is not the one its scope and crawl time name;
- a field outside the format - a snapshot carries nothing but its own fields;
- a crawl time that is not a full UTC hour, more than 10 minutes in the future or older than 30 days;
- a crawl whose shops are identical to one of the ten newest here;
- a price that is not a whole number of zeny from 1 to ten billion, an amount outside 1 to 65,535, an item ID outside 1 to 2,147,483,647, a coordinate outside 0 to 1000, a merchant, shop or map name above 100 characters or with a control character, a bidirectional control or a lone surrogate; in a part, a refine above 20, more than four cards, an item outside its list, or names that are not the offered items' ids in decimal with well-formed text;
- a file the validator throws on.

A list of item IDs without offers is taken: nothing of it on sale is an
observation too.

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
offered as a pull request into `main` that writes `gamedata/`, and counts
from its merge: Arcana and Arcana Crawler read `gamedata/` on `main`.
`scripts/validate-gamedata.js` has to accept a build: every list above
its floor and at 90 % or more of the build before; every entry an object
of its list's fields and of its list's form - ids, names as text, drop
rates above 0 up to 100 %, every figure of 0 up to its bound (a level up
to 1000, HP up to 4,294,967,295, a spawn's amount up to 10,000, slots up
to 4, NPC prices up to ten billion …), an item's figures, locations,
effect and shop price where given, a mob's element, race and size as
text or null, the `renewal` and `mvp` flags true or false where given -;
each card and item once, each mob and pet once, each spawn once per map;
every drop, spawn and pet names a known mob; every card, every recipe's
item and materials and every pet's egg is an item, every item has one of
the market's item types; enough cards drop, mobs spawn, card effects read
as text and items have an NPC shop price; every drop rate from `server`
or `rathena`; a `meta.json` of its own fields, built no more than a day
ahead, whose counts are its lists' lengths and whose `sha256`, where it
gives them, are the digests of its lists' files. A drop marked `mvp: true` is
one of the rewards an MVP's killer gets, one per kill at most.
Arcana multiplies rAthena's base rates by the server's factor, one of its
settings, and takes the server's own rates as they are.

Arcana takes a build only when `checkGameData()` accepts it.

## Pictures

A set is made by Arcana Crawler after a build of the game data: each
item's icon and image and each mob's picture as the server's control
panel shows them - the items and mobs of the server's own database, the
items only rAthena knows once they appeared in the market, and for every
card one icon and one image. Icons and mobs are kept as they are, as
lossless WebP; an item image loses its white backdrop, as lossy WebP with
alpha, unless it is so pale that it keeps it and is shown on a light tile.
A run adds its new pictures as a new pack; small packs are joined, and
all of them written anew once a quarter of their bytes is unused.
`scripts/validate-pictures.js` has to accept a set: icons, images and
mobs above their floors and at 90 % or more of the set before; every
picture a still WebP in its pack, overlapping no other, within the
bounds of its kind (an icon 32×32 and 8 KB at most, an image 160×160 and
48 KB, a mob 400×400 and 128 KB), on a tile only as an item image; every
picture and pack in use, at most 20 packs of 12 MB, 64 MB together, no
more than half of it unused; a `meta.json` of its own fields, made no
more than a day ahead, whose counts are the index's.

**The `gamedata` branch** holds a copy of the build on `main` for
installations that read it there, until they have updated. Once a build
is merged, `.github/workflows/gamedata.yml` copies it with
`scripts/publish-gamedata.sh`, which judges it again first. The workflow
refuses to run on any ref but `main` and pushes with its own token; the
ruleset on `gamedata` blocks deletion and force pushes. Once no
installation reads the branch, the workflow goes.

## Maintenance

The ruleset on `main` stays active. Its bypass list holds the maintainer
alone (*Always*): a push of theirs to `main` passes it, while every open
pull request - one with auto-merge included - still needs `validate` and,
outside `snapshots/`, `items/`, `gamedata/` and `pictures/`, the
maintainer's review.
The ruleset is never disabled. Merges are squashed. A merged pull
request's branch is deleted only while *Automatically delete head
branches* (Settings → General → Pull Requests) is on, a setting the
maintainer turns on.

The game data workflow also starts by hand from the Actions tab, from
`main`: it copies the build on `main` to the `gamedata` branch again. Run
from any other branch it stops at its first step.

## Copied code

Three files under `scripts/` are generated by `npm run store-copies` in
the app's repository and carry a banner saying so; they are edited there:

| Copy | Source |
|---|---|
| `scripts/validate.js` | `common/snapshot.ts` |
| `scripts/validate-gamedata.js` | `common/gamedata.ts` |
| `scripts/validate-pictures.js` | `common/pictures.ts` |

The maintainer commits the copies and pushes them to `main` directly: a
pull request that touches `scripts/` is refused. The app's tests fail
while a checkout of this repository beside it holds stale copies, and run
`check-pr.js`, `build-index.js` and `publish-gamedata.sh` with fresh ones.

A change to a schema lands here first; the crawler that writes it is
released right after. `assets/` holds the app's logo.

## Layout

```
snapshots/            one file per crawl of the cards, added and never changed
items/                one file per part of items - type-<id>/, ids/ - added and never changed
scripts/              validation, the pull request check, the index build, the game data's copy
.github/workflows/    the three workflows below
.github/CODEOWNERS    every file the maintainer's, but snapshots/, items/, gamedata/ and pictures/
assets/               the logo
meta.json             the store's name and schema versions
build/                the index build's output; not committed
gamedata/             the newest build of the game data, through accepted pull requests
pictures/             the newest set of pictures, through accepted pull requests
```

| Workflow | When | What it does |
|---|---|---|
| `pull-request.yml` | every pull request into `main`: opened, pushed to, reopened, edited | judges a contribution; `validate` is the required check |
| `pages.yml` | a push to `snapshots/` or `items/` on `main`, every six hours, on demand | builds the index, one crawl at a time, and publishes it on Pages |
| `gamedata.yml` | a push to `gamedata/` on `main`, on demand from `main` | copies the build to the `gamedata` branch |

| Branch | What is on it | Who writes it |
|---|---|---|
| `main` | the archive, the game data's newest build, the newest set of pictures, the scripts, the workflows | contributors, through accepted pull requests; the maintainer |
| `gamedata` | a copy of the build on `main`: seven lists and their `meta.json` | the game data workflow |
| `crawl/…` | an offered crawl, the head of its pull request; deleted after the merge while *Automatically delete head branches* is on | Arcana Crawler |
| `game-data/…`, `pictures/…` | an offered build of the game data or set of pictures, the head of its pull request; deleted after the merge as a crawl's | Arcana Crawler |
