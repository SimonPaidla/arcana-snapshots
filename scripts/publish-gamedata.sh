#!/usr/bin/env bash
# Commits the built game data to its branch and pushes it, when a list
# changed; meta.json goes along. Works in a worktree of the checkout, which
# carries the checkout's credentials. Starts the branch as an orphan when
# it does not exist.
#
# Usage: scripts/publish-gamedata.sh <source-dir> [branch]
set -euo pipefail
trap 'echo "publish-gamedata: failed at line $LINENO: $BASH_COMMAND" >&2' ERR

# Absolute, for require() below.
SOURCE=$(cd "${1:?source directory with the built json}" && pwd)
BRANCH=${2:-gamedata}
FILES="cards.json items.json mobs.json drops.json spawns.json recipes.json pets.json"

cd "$(git rev-parse --show-toplevel)"

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

for f in $FILES meta.json; do
  cp "$SOURCE/$f" "$WORK/$f"
done

git -C "$WORK" add -A
# Compared without meta.json, which carries the build time.
if git -C "$WORK" diff --cached --quiet -- $FILES; then
  echo "rAthena is unchanged - nothing to publish."
  exit 0
fi

SUMMARY=$(node -p "
  const m = require('$SOURCE/meta.json');
  const c = m.counts;
  \`\${c.cards} cards, \${c.items} items, \${c.mobs} mobs, \${c.spawns} spawns, \${c.recipes} recipes, \${c.pets} pets\`
    + (m.rathena ? \` (rathena \${m.rathena.sha.slice(0, 7)})\` : '');
")
git -C "$WORK" commit --quiet -m "Game data: $SUMMARY"
git -C "$WORK" push --quiet origin "HEAD:refs/heads/$BRANCH"
echo "Published: $SUMMARY"
