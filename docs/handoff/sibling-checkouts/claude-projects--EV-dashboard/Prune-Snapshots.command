#!/bin/bash
# Prune-Snapshots.command — one-click cleanup of old loose snapshot files
# after they've been archived into tar.gz by snapshot.py.
#
# Claude's sandbox cannot delete files it did not create, so rotation
# *archives* but may not *remove* old snapshots. Run this on your Mac to
# finish the job.

set -euo pipefail

cd "$(dirname "$0")"

ARCHIVE_DIR="snapshots/archive"
LOOSE_DIR="snapshots"

if [ ! -d "$ARCHIVE_DIR" ]; then
  echo "No archive directory yet — nothing to prune."
  exit 0
fi

# Find all filenames inside the most recent tarball. Anything matching those
# names in the loose dir is redundant and can be removed.
LATEST_TARBALL="$(ls -1t "$ARCHIVE_DIR"/*.tar.gz 2>/dev/null | head -1 || true)"
if [ -z "$LATEST_TARBALL" ]; then
  echo "No tarballs yet — run snapshot.py first so rotation creates one."
  exit 0
fi

echo "Reading archive: $LATEST_TARBALL"
tar -tzf "$LATEST_TARBALL" | while read -r name; do
  candidate="$LOOSE_DIR/$(basename "$name")"
  if [ -f "$candidate" ]; then
    echo "  removing (already in archive): $candidate"
    rm -f "$candidate"
  fi
done

echo "Pruning complete. Active snapshots:"
ls -1 "$LOOSE_DIR"/*.json 2>/dev/null | wc -l | awk '{print "  "$1" loose .json files"}'
du -sh "$ARCHIVE_DIR" 2>/dev/null | awk '{print "  archive total: "$1}'
