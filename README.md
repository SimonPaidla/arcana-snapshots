# arcana-snapshots

The shared data store for [Arcana](https://github.com/SimonPaidla/arcana), a
desktop app that tracks card prices on the Ragnarok Online server uaRO.

Two kinds of data live here, and they arrive in opposite directions.

## Price snapshots

One file per crawl under `snapshots/`, named after the moment it was taken:

```
snapshots/2026-09-22T05-55-43-537Z.json
```

They are **flat and anonymous**. There is no folder per contributor and no
contributor field in the file. A snapshot is judged on what it contains, not
on who sent it, and `scripts/validate.js` is what judges it: schema version,
a crawl time that is not in the future, prices within bounds, and a card
count inside a narrow band around what is already known. The band is tight
because the data allows it - across day and night, seven consecutive runs
ranged from 348 to 365 cards.

Snapshots arrive as pull requests that only ever **add** files. Nothing here
is edited or deleted; a price from yesterday is gone once it is gone, and
that is the one thing this repository exists to prevent.

`.github/workflows/pull-request.yml` runs that check on every pull request,
and the branch ruleset on `main` requires it to pass. It refuses anything it
was not explicitly built to accept - a modification, a deletion, a file in a
subfolder, a file that is not a snapshot, a crawl dated in the future, a
crawl that is missing a third of its cards. All of those were reproduced
against the real archive before the check was trusted.

## Game data

The `gamedata` **branch** holds the card, mob, drop and spawn tables, built
from [rAthena](https://github.com/rathena/rathena)'s pre-renewal database
once a day by `.github/workflows/gamedata.yml`.

It sits on a branch of its own because a workflow cannot push to `main`
while a ruleset protects it - GitHub does not let the Actions app bypass a
ruleset, deliberately, since any collaborator could otherwise write a
workflow that pushes wherever they liked. The alternatives are a deploy key
or a token kept as a secret, and this project keeps no credentials. A
branch costs none of that, and the data still has a history to diff and
roll back, the same arrangement `gh-pages` has used for a decade.

It is built here rather than in each installation because the result is the
same for everyone: about seventy files fetched and parsed, some sixteen
seconds, to produce four files totalling around 64 KB gzipped. Doing that
once a day for everybody is cheaper than doing it in every copy of the app.

The drop rates published here all carry `source: "rathena"`. Rates an
installation measured for itself carry `source: "cp"`, cost hundreds of page
requests to obtain, and belong to that installation - they are merged in
locally and are never uploaded.

Nothing is committed unless `scripts/validate-gamedata.js` accepts it.
rAthena moves on its own, and a renamed file or a restructured document does
not fail loudly - the parser matches nothing and returns an empty list. The
validator therefore checks floors, the size against the last published
build, and the **joins**: every list can be the right length while the ids
that tie them together have stopped matching, which would leave four
healthy-looking files and a ranking with no mobs in it.

The workflow can also be started by hand from the Actions tab, so a bad day
upstream can be repaired without waiting for the next one.

## What the app fetches

The archive is not the serving format. One file per crawl is right for
keeping data; it is wrong for an installation that wants the current state
and would otherwise fetch a thousand files to get it.

### One market moment, one observation

Statistics count crawls. That is right while every crawl is an independent
look at the market, and wrong the moment the same look is filed twice - the
median then hears one voice several times.

Measured on this archive with three identical runs added: the usual price
moved on **222 of 370 cards**, in the worst case from 299,999 to 999,999.
That figure is what the buying advice vetoes against, so a duplicate does
not merely add noise, it changes what gets recommended. Sale detection was
untouched: nothing disappears between two identical crawls.

Two rules, in `validate.js` so the app and this repository apply the same
one:

- identical card data is the same observation, whatever time is on it
- runs closer together than **15 minutes** are one moment, whoever took
  them - the fullest of them counts

`check-pr.js` refuses a run identical to one already here, and the published
index counts the rest once. Nothing is deleted: the archive keeps every
file, and `index.json` names what it left out and why.

`.github/workflows/pages.yml` therefore publishes three derived files to
GitHub Pages after every merge:

| File | What it is |
|---|---|
| `index.json` | what exists, so the app can fetch only the gap |
| `series.json` | all metrics of all crawls, without individual offers |
| `latest.json` | the newest run in full - outlier detection needs the offers |

None of the three is committed. They are derived, they can be rebuilt from
the archive at any time, and keeping them in the history would put a large
diff in front of every merge.

Game data is the other way round: it **is** committed, on the `gamedata`
branch, and the app reads it straight from there:

```
https://raw.githubusercontent.com/SimonPaidla/arcana-snapshots/gamedata/cards.json
```

So the two differ on purpose - Pages serves what is derived from the
archive, the repository serves what is kept.

## Changing anything in here

The ruleset on `main` has an **empty bypass list**, and it has to stay
empty. Every contributor token is issued from the same account that owns
this repository, so a bypass for "repository admin" would be a bypass for
every token as well, and the rule would protect nothing.

The consequence is that nobody can push to `main` directly - not even the
owner - and `check-pr.js` refuses any pull request touching a path outside
`snapshots/*.json`. Maintenance therefore takes three steps:

1. *Settings → Rules →* the ruleset *→ Enforcement status:* `Disabled`
2. `git push`
3. *Enforcement status:* `Active`

**Step three is not optional.** Between two and three the archive has no
protection at all: a buggy build could write anything into `snapshots/`
and nothing would stop it. Do the push and put the rule back in the same
sitting, not "later".

This is a deliberate trade. The alternative was to let `check-pr.js`
accept pull requests that touch no snapshot, which would have made
maintenance ordinary - at the price of a token being able to rewrite the
check itself. The archive is what matters here, so the inconvenience
lands on maintenance instead.

## Copied code

Three files under `scripts/` are copies. Their source is the code
repository, and they carry a banner saying so:

| Copy | Source |
|---|---|
| `scripts/validate.js` | `src/validate.js` |
| `scripts/mobdata.js` | `src/mobdata.js` |
| `scripts/carddesc.js` | `src/carddesc.js` |

They are copied rather than shared because this repository is public and the
code repository is not. **Edit them there, not here** - the next sync
overwrites whatever is changed in this copy. Everything else under
`scripts/` belongs to this repository alone.

## Layout

```
snapshots/            one file per crawl, added and never changed
scripts/              validation, the daily build, and the index builder
.github/workflows/    the three jobs below
gamedata/             the build's output; published to the gamedata branch
build/                generated; not committed
meta.json             what this store is and which schema version it speaks
```

| Workflow | When | What it does |
|---|---|---|
| `pull-request.yml` | every pull request | judges a contribution; the check the ruleset requires |
| `pages.yml` | after a merge, every six hours, on demand | builds the index and publishes it |
| `gamedata.yml` | 02:17 UTC, on demand | rebuilds the game data and publishes the `gamedata` branch |

### Branches

| Branch | What is on it | Who writes it |
|---|---|---|
| `main` | the archive, the scripts, the workflows | contributors, through accepted pull requests |
| `gamedata` | the four built tables and their manifest | the daily workflow |

Nothing reaches `main` except through a pull request that
`scripts/check-pr.js` has accepted, and that check refuses every path
outside `snapshots/*.json` - including the workflow files themselves. So
the rule needs no exception: the branch the workflow writes to is simply
not the branch the rule protects.
