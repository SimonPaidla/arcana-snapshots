#!/usr/bin/env bash
# Commits a build of the game data to its branch and pushes it, when a file
# of it - meta.json included - differs from the published one. Judges the
# build first with validate-gamedata.js, against the counts of the
# published build; one that does not pass is not published. Works in a
# worktree of the checkout, which carries the checkout's credentials.
# Starts the branch as an orphan when it does not exist.
#
# Usage: scripts/publish-gamedata.sh <source-dir> [branch]
set -euo pipefail
trap 'echo "publish-gamedata: failed at line $LINENO: $BASH_COMMAND" >&2' ERR

# Absolute, for require() below.
SOURCE=$(cd "${1:?source directory with the build}" && pwd)
BRANCH=${2:-gamedata}
FILES="cards.json items.json mobs.json drops.json spawns.json recipes.json pets.json meta.json"

cd "$(git rev-parse --show-toplevel)"
ROOT=$(pwd)

TEMP=$(mktemp -d)
WORK="$TEMP/publish"          # git worktree add insists the path is new
cleanup() {
  git worktree remove --force "$WORK" >/dev/null 2>&1 || true
  rm -rf "$TEMP"
}
trap cleanup EXIT

# Carry the history on if the branch is already there; start one if not.
if git fetch --quiet --depth=1 origin "$BRANCH" 2>/dev/null; then
  git worktree add --quiet -B "$BRANCH" "$WORK" FETCH_HEAD
  echo "Continuing the existing $BRANCH branch."
else
  git worktree add --quiet --detach "$WORK"
  git -C "$WORK" checkout --quiet --orphan "$BRANCH"
  git -C "$WORK" read-tree --empty
  find "$WORK" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
  echo "Starting the $BRANCH branch."
fi

# The build, judged against the counts of the published one.
if ! node - "$ROOT/scripts/validate-gamedata.js" "$SOURCE" "$WORK" <<'JS'
const fs = require('fs');
const path = require('path');
const [validator, source, published] = process.argv.slice(2);
const { check, checkMeta } = require(validator);
const read = (dir, name) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf-8')); } catch { return undefined; }
};
const lists = {};
for (const name of ['cards', 'items', 'mobs', 'drops', 'spawns', 'recipes', 'pets']) {
  const list = read(source, name);
  if (list !== undefined) lists[name] = list;
}
const verdict = check(lists, { previous: read(published, 'meta')?.counts ?? null });
const errors = [...verdict.errors, ...checkMeta(read(source, 'meta'), lists).errors];
for (const line of verdict.warnings) console.log(`  warning: ${line}`);
if (errors.length) {
  for (const line of errors) console.error(`  ${line}`);
  console.error('The build does not pass - nothing published.');
  process.exit(1);
}
JS
then
  exit 1
fi

for f in $FILES; do
  cp "$SOURCE/$f" "$WORK/$f"
done

git -C "$WORK" add -A
if git -C "$WORK" diff --cached --quiet; then
  echo "The $BRANCH branch holds this build already - nothing to publish."
  exit 0
fi

SUMMARY=$(node -p "
  const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf-8'));
  const c = m.counts;
  \`\${c.cards} cards, \${c.items} items, \${c.mobs} mobs, \${c.spawns} spawns, \${c.recipes} recipes, \${c.pets} pets, built \${m.builtAt}\`
    + (m.rathena ? \` (rathena \${m.rathena.sha.slice(0, 7)})\` : '');
" "$SOURCE/meta.json")
git -C "$WORK" commit --quiet -m "Game data: $SUMMARY"
git -C "$WORK" push --quiet origin "HEAD:refs/heads/$BRANCH"
echo "Published: $SUMMARY"
