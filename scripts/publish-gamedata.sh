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
# The work happens in a worktree of the checkout, never in a repository
# of its own. actions/checkout leaves the token in the local config of
# the repository it checks out; a repository created from scratch carries
# none of that and asks for a username nobody is there to type.
#
# Usage: scripts/publish-gamedata.sh <source-dir> [branch]
set -euo pipefail
trap 'echo "publish-gamedata: failed at line $LINENO: $BASH_COMMAND" >&2' ERR

# Absolute: node's require() resolves a relative path against the module
# it is called from, not against the working directory.
SOURCE=$(cd "${1:?source directory with the built json}" && pwd)
BRANCH=${2:-gamedata}
FILES="cards.json mobs.json drops.json spawns.json"

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
git -C "$WORK" push --quiet origin "HEAD:refs/heads/$BRANCH"
echo "Published: $SUMMARY"
