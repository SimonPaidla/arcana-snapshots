<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
    <img src="assets/logo-light.svg" alt="Arcana" width="200">
  </picture>
</p>

# Arcana snapshots

The shared data store of **Arcana**, a desktop app that ranks pre-renewal
cards on the uaRO private server by what they are worth and how long they
take to farm. The app itself is on
[arcana-releases](https://github.com/SimonPaidla/arcana-releases).

Several people crawl the market into this one repository with **Arcana
Crawler**, a separate app, instead of each keeping a history of their own,
so every Arcana installation opens on everyone's prices — with history. Two kinds
of data live here, and they arrive in opposite directions:

| | Where | Arrives |
|---|---|---|
| **Price snapshots** | `snapshots/` on `main` | from contributors, one pull request per crawl |
| **Game data** | the `gamedata` branch | built once a day from [rAthena](https://github.com/rathena/rathena)'s pre-renewal database |

## Using the data

The archive is not the serving format — one file per crawl is right for
keeping data and wrong for an installation that wants the current state.
What the app fetches, and anyone else may:

| File | What it is |
|---|---|
| [`index.json`](https://simonpaidla.github.io/arcana-snapshots/index.json) | every crawl that exists, so a client fetches only the gap |
| [`series.json`](https://simonpaidla.github.io/arcana-snapshots/series.json) | all metrics of all crawls, without the individual offers |
| [`latest.json`](https://simonpaidla.github.io/arcana-snapshots/latest.json) | the newest crawl in full, offers included |
| [`cards.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/cards.json) · [`mobs.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/mobs.json) · [`drops.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/drops.json) · [`spawns.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/spawns.json) | the game data, from the `gamedata` branch |
| [`meta.json`](https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/meta.json) | when the game data was built, from which rAthena commit, and how many of each |

The first three are published to GitHub Pages after every merge and are
never committed: they are derived, and can be rebuilt from the archive at
any time. The game data is the other way round — it **is** committed, on
its own branch. Pages serves what is derived from the archive; the
repository serves what is kept.

`meta.json` on `main` says what this store is and which snapshot schema it
speaks.

## Contributing a crawl

Through Arcana Crawler, not by hand. With a token set in the crawler — a
fine-grained token for this repository with write access to *contents*
and *pull requests* — every crawl is offered here as a pull request that
adds exactly one file:

```
snapshots/2026-09-22T05-55-43-537Z.json
```

Each file is one crawl in schema 5: the crawl time and the counts on the
first line, then every shop on a line of its own - merchant, shop name,
map, x, y, and its offers as `[itemId, price, amount]`, ascending by card
and price - with the shops in a fixed order. A shop that did not change
between two crawls is the same line in both, so the history grows by
little more than what changed. Files of an earlier schema stay in the
archive and are not listed in `index.json`.

`.github/workflows/pull-request.yml` judges it, the branch ruleset on
`main` requires that check to pass, and auto-merge takes it in once it is
green. The crawler runs the same validation before it offers anything, so
a pull request that could only be refused is never opened.

What is refused: a modification, a deletion, a file in a subfolder, a file
that is not a snapshot, a crawl dated in the future, a crawl missing a
third of its cards, a crawl identical to one already here, and any path
under `.github/`. All of those were reproduced against the real archive
before the check was trusted.

## Why it is built the way it is

**Snapshots are flat and anonymous.** No folder per contributor and no
contributor field in the file. A snapshot is judged on what it contains,
not on who sent it, and `scripts/validate.js` is what judges it: schema
version, a crawl time that is not in the future, prices within bounds, and
a card count inside a narrow band around what is already known. The band
is tight because the data allows it — across day and night, seven
consecutive runs ranged from 348 to 365 cards.

**Nothing is ever edited or deleted.** Pull requests only add files. A
price from yesterday is gone once it is gone, and that is the one thing
this repository exists to prevent.

**One market moment counts once.** Statistics count crawls, which is right
while every crawl is an independent look at the market and wrong the
moment the same look is filed twice. Measured on this archive with three
identical runs added, the usual price moved on **222 of 370 cards**, in the
worst case from 299,999 to 999,999 — and that figure is what the buying
advice vetoes against. So identical card data is one observation whatever
time is on it, and runs closer together than **15 minutes** are one moment,
of which the fullest counts. The rule lives in `validate.js`, so the app
and this repository apply the same one; `index.json` names what it left
out and why, and the archive keeps every file.

**Game data is built here, once.** About seventy files fetched and parsed,
some sixteen seconds, to produce four files totalling around 64 KB gzipped
— the same result for everyone, so it is cheaper once a day here than in
every copy of the app. `scripts/validate-gamedata.js` has to accept a build
before it is committed: floors, the size against the last published build,
and the **joins** — every list can be the right length while the ids that
tie them together have stopped matching.

**Game data sits on a branch of its own.** A workflow cannot push to a
branch a ruleset protects — GitHub does not let the Actions app bypass a
ruleset, since any collaborator could otherwise write a workflow that
pushes wherever they liked. The alternatives are a deploy key or a token
kept as a secret, and this project keeps no credentials. A branch costs
none of that and still has a history to diff and roll back.

**Measured drop rates never leave the machine.** The rates published here
all carry `source: "rathena"`. Rates an installation measured itself carry
`source: "cp"`, cost hundreds of page requests, and are merged in locally
only; the validator refuses a build with any other source in it.

## Changing anything in here

The ruleset on `main` has an **empty bypass list**, and it has to stay
empty. Every contributor token is issued from the same account that owns
this repository, so a bypass for "repository admin" would be a bypass for
every token as well, and the rule would protect nothing.

Nobody pushes to `main` directly — not even the owner — and `check-pr.js`
refuses any pull request touching a path outside `snapshots/*.json`.
Maintenance therefore takes three steps:

1. *Settings → Rules →* the ruleset *→ Enforcement status:* `Disabled`
2. `git push`
3. *Enforcement status:* `Active`

**Step three is not optional.** Between two and three the archive has no
protection at all. Do the push and put the rule back in the same sitting,
not "later".

This is a deliberate trade: letting `check-pr.js` accept pull requests
that touch no snapshot would have made maintenance ordinary — at the price
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

**Edit them there, not here** — the next generation overwrites whatever
is changed in this copy. Everything else under `scripts/` belongs to this
repository alone, `mobdata.js` and `carddesc.js` among them. The same goes for `assets/`: the logo is the app's, and
is copied again when it changes.

## Layout

```
snapshots/            one file per crawl, added and never changed
scripts/              validation, the daily build, and the index builder
.github/workflows/    the three jobs below
assets/               the logo, for this page
gamedata/             the build's output; published to the gamedata branch
build/                generated; not committed
meta.json             what this store is and which schema version it speaks
```

| Workflow | When | What it does |
|---|---|---|
| `pull-request.yml` | every pull request | judges a contribution; the check the ruleset requires |
| `pages.yml` | after a merge, every six hours, on demand | builds the index and publishes it |
| `gamedata.yml` | 02:17 UTC, on demand | rebuilds the game data and publishes the `gamedata` branch |

| Branch | What is on it | Who writes it |
|---|---|---|
| `main` | the archive, the scripts, the workflows | contributors, through accepted pull requests |
| `gamedata` | the four built tables and their manifest | the daily workflow |
| `crawl/<time>` | one offered crawl each, the head of its pull request | Arcana Crawler |
