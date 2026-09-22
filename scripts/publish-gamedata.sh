#!/usr/bin/env bash
# Publishes the built game data to the branch that carries it.
#
# It goes to a branch of its own rather than to main, and not by
# preference: GitHub does not let a workflow push to a branch a ruleset
# protects. The Actions app cannot be granted a bypass - that is a
# deliberate refusal, because any collaborator could otherwise write a
# workflow that pushes anywhere. The alternatives are a deploy key or a
# token kept as a secret, and this project does not keep credentials.
#
# A branch costs none of that. The ruleset guards main, the archive lives
# on main, and derived data that can be rebuilt any day sits beside it -
# the same arrangement gh-pages has used for a decade.
#
# Usage: scripts/publish-gamedata.sh <source-dir> <branch>
set -euo pipefail

# Absolute: node's require() resolves a relative path against the module
# it is called from, not against the working directory.
SOURCE=$(cd "${1:?source directory with the built json}" && pwd)
BRANCH=${2:-gamedata}
FILES="cards.json mobs.json drops.json spawns.json"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$(git rev-parse --show-toplevel)"
REMOTE=$(git remote get-url origin)

git init -q -b "$BRANCH" "$WORK"
git -C "$WORK" remote add origin "$REMOTE"
git -C "$WORK" config user.name  "$(git config user.name)"
git -C "$WORK" config user.email "$(git config user.email)"

# Carry the history on if the branch is already there; start one if not.
if git -C "$WORK" fetch --quiet --depth=1 origin "$BRANCH" 2>/dev/null; then
  git -C "$WORK" reset --quiet --hard FETCH_HEAD
  echo "Continuing the existing $BRANCH branch."
else
  echo "Starting the $BRANCH branch."
fi

for f in $FILES meta.json; do
  cp "$SOURCE/$f" "$WORK/$f"
done

git -C "$WORK" add -A
# meta.json carries the build time and would differ every single day on
# its own, so it is left out of the comparison.
if git -C "$WORK" diff --cached --quiet -- $FILES; then
  echo "rAthena is unchanged - nothing to publish."
  exit 0
fi

SUMMARY=$(node -p "
  const m = require('$SOURCE/meta.json');
  const c = m.counts;
  \`\${c.cards} cards, \${c.mobs} mobs, \${c.spawns} spawns\`
    + (m.rathena ? \` (rathena \${m.rathena.sha.slice(0, 7)})\` : '');
")
git -C "$WORK" commit --quiet -m "Game data: $SUMMARY"
git -C "$WORK" push --quiet origin "HEAD:$BRANCH"
echo "Published: $SUMMARY"
