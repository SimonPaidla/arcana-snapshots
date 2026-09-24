<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img src="assets/logo-light.svg" alt="Arcana" width="200">
  </picture>
</p>

# Arcana snapshots

The shared data store of **Arcana**, a desktop app that follows the card
market of the uaRO private server and ranks pre-renewal cards by what they
are worth and how long they take to farm. The app itself is on
[arcana-releases](https://github.com/SimonPaidla/arcana-releases).

Several people crawl the market into this one repository with **Arcana
Crawler**, a separate app, every full hour, instead of each keeping a
history of their own. Every Arcana installation then opens on everyone's
prices, with history. Two kinds of data live here, and they arrive in
opposite directions:

| | Where | Arrives |
|---|---|---|
| **Price snapshots** | `snapshots/` on `main` | from contributors, one pull request per crawl |
| **Game data** | the `gamedata` branch | built once a day from [rAthena](https://github.com/rathena/rathena)'s pre-renewal database |

**The archive started afresh on 24 September 2026** with snapshot schema 5.
The crawls of earlier schemas were removed. Until the first crawl of
schema 5 is merged, the index is empty.

## Using the data

The archive is not the serving format: one file per crawl is right for
keeping data and wrong for a reader who wants the current state. GitHub
Pages publishes these files, rebuilt from the archive:

| File | What it is |
|---|---|
| [`index.json`](https://simonpaidla.github.io/arcana-snapshots/index.json) | every counted crawl with its path, time, card and offer count, and the runs left out and why; Arcana compares it with its own cache and fetches only the gap |
| [`series.json`](https://simonpaidla.github.io/arcana-snapshots/series.json) | every card's metrics in every counted crawl - min, median, mean, max, count - without the individual offers |
| [`latest.json`](https://simonpaidla.github.io/arcana-snapshots/latest.json) | the newest counted crawl in full, as it is stored |

The game data is committed on its own branch and read from there:

| File | What it is |
|---|---|
| [`cards.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/cards.json) | the pre-renewal cards, with their effects as text |
| [`mobs.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/mobs.json) | level, HP, element, race, size, and whether a mob is an MVP |
| [`drops.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/drops.json) | which mob drops which card, at rAthena's base rate in percent |
| [`spawns.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/spawns.json) | how many of a mob stand on a map, and its respawn time in milliseconds |
| [`meta.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/meta.json) | when the game data was built, from which rAthena commit, and how many of each |

Arcana reads `index.json`, the snapshot files it lacks, and the game data;
`series.json` and `latest.json` are there for anyone else. Pages serves
what is derived from the archive; the repository serves what is kept.
`meta.json` on `main` says what this store is and which snapshot schema it
speaks.

## Contributing a crawl

Through Arcana Crawler, not by hand. With a token set in the crawler - a
fine-grained token for this repository with write access to *contents*
and *pull requests* - every crawl is offered here as a pull request that
adds exactly one file, named after the full UTC hour it was taken for:

```
snapshots/2026-09-24T17-00-00-000Z.json
```

Each file is one crawl in schema 5. The crawl time and the counts are on
the first line, then every shop on a line of its own: merchant, shop name,
map, x, y, and its offers as `[itemId, price, amount]`, ascending by card
and price. The shops come in a fixed order. A shop that did not change
between two crawls is the same line in both, so a crawl is about a third
of the size of the earlier per-card format.

`.github/workflows/pull-request.yml` judges the pull request, the branch
ruleset on `main` requires that check to pass, and auto-merge takes it in
once it is green. The crawler runs the same validation before it offers
anything, so it never opens a pull request that could only be refused.

What is refused:
- a modified or deleted file, a file in a subfolder, and any path outside `snapshots/*.json`, `.github/` included;
- a file that is not a snapshot of schema 5, or whose name is not its crawl time;
- a crawl more than 10 minutes in the future, or older than 30 days;
- a crawl whose shops are identical to one already here;
- a price above ten billion;
- a crawl with fewer than 75 % of the cards of the crawls before it.

## Why it is built the way it is

**Snapshots are flat and anonymous.** There is no folder per contributor
and no contributor field in the file. A snapshot is judged on what it
contains, not on who sent it, and `scripts/validate.js` is what judges
it. It checks the schema version, a crawl time that is neither in the
future nor too old, prices within bounds, shops in order, and a card
count close to what is already known.

The card count may fall to 75 % of the median of the five crawls before,
and below 90 % the check warns. The band can be this tight because the
data allows it: across 27 crawls between 21 and 24 September 2026 the
count ranged from 320 to 365 cards.

**Pull requests only add files.** A price from yesterday is gone once it
is gone, and keeping it is what this repository exists for. The one
exception was the deliberate restart of the archive with schema 5.

**One market moment counts once.** Statistics count crawls. That is right
while every crawl is an independent look at the market, and wrong the
moment the same look is filed twice. Measured on the archive of September
2026, three identical runs added moved the usual price on 222 of 370
cards, in the worst case from 299,999 to 999,999.

So identical shop data is one observation, whatever time is on it. Runs
closer together than **15 minutes** are one moment, and of them the
fullest counts. The rule lives in `validate.js`, so the app and this
repository apply the same one. `index.json` names what it left out and
why, and the archive keeps every file.

**Game data is built here, once.** About seventy files of rAthena are
fetched and parsed into four lists. The result is the same for everyone,
so building it once a day here is cheaper than in every copy of the app.
The spawn lines also give each map's respawn time, so a boss that stands
once an hour is not counted as if it were always there.

`scripts/validate-gamedata.js` has to accept a build before it is
committed. It checks floors, the size against the last published build,
and the **joins**: every list can be the right length while the ids that
tie them together have stopped matching.

**Game data sits on a branch of its own.** A workflow cannot push to a
branch a ruleset protects. GitHub does not let the Actions app bypass a
ruleset, since any collaborator could otherwise write a workflow that
pushes wherever they liked. The alternatives are a deploy key or a token
kept as a secret, and this project keeps no credentials. A branch costs
none of that and still has a history to diff and roll back.

**Drop rates are rAthena's.** Every rate published here carries
`source: "rathena"`, and the validator refuses a build with any other
source in it. The app multiplies them by the server's factor, one of its
settings: ×5 on uaRO, where normal cards drop at 0.05 %. MVP cards drop
at ×1 there.

## Changing anything in here

The ruleset on `main` has an **empty bypass list**, and it has to stay
empty. Every contributor token is issued from the same account that owns
this repository, so a bypass for "repository admin" would be a bypass for
every token as well, and the rule would protect nothing.

Nobody pushes to `main` directly, not even the owner, and `check-pr.js`
refuses any pull request touching a path outside `snapshots/*.json`.
Maintenance therefore takes three steps:

1. *Settings → Rules →* the ruleset *→ Enforcement status:* `Disabled`
2. `git push`
3. *Enforcement status:* `Active`

**Step three is not optional.** Between steps two and three the archive
has no protection at all. Do the push and put the rule back in the same
sitting, not "later".

This is a deliberate trade. Letting `check-pr.js` accept pull requests
that touch no snapshot would have made maintenance ordinary, at the price
of a token being able to rewrite the check itself. The archive is what
matters, so the inconvenience lands on maintenance.

The game-data workflow can also be started by hand from the Actions tab,
so a bad day upstream can be repaired without waiting for the next run.

## Copied code

Two files under `scripts/` are generated from the app's repository by
`npm run store-copies` there, and carry a banner saying so:

| Copy | Source |
|---|---|
| `scripts/validate.js` | `common/snapshot.ts` |
| `scripts/validate-gamedata.js` | `common/gamedata.ts` |

**Edit them there, not here**: the next generation overwrites whatever
is changed in the copy. Everything else under `scripts/` belongs to this
repository alone, `mobdata.js` and `carddesc.js` among them. `assets/`
holds the app's logo, copied again when it changes.

A change to the snapshot format changes both repositories in one sitting.
This store's side reaches `main` first, and the crawler that writes the
new schema is released right after. In between, each refuses what the
other writes.

## Layout

```
snapshots/            one file per crawl, added and never changed
scripts/              validation, the pull request check, the index and the game data builds
.github/workflows/    the three jobs below
assets/               the logo, for this page
meta.json             what this store is and which schema version it speaks
build/                the index build's output; not committed
gamedata/             the game data build's output; published to the gamedata branch, not committed
.cache-rathena/       rAthena's files, fetched by the game data build; not committed
```

| Workflow | When | What it does |
|---|---|---|
| `pull-request.yml` | every pull request | judges a contribution; the check the ruleset requires |
| `pages.yml` | after a merge into `snapshots/`, every six hours, on demand | builds the index and publishes it |
| `gamedata.yml` | 02:17 UTC daily, on demand | rebuilds the game data and publishes the `gamedata` branch |

| Branch | What is on it | Who writes it |
|---|---|---|
| `main` | the archive, the scripts, the workflows | contributors, through accepted pull requests |
| `gamedata` | the four built lists and their manifest | the daily workflow |
| `crawl/<time>` | one offered crawl each, the head of its pull request | Arcana Crawler |
