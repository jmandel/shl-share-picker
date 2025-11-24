#!/bin/bash
set -e

# Define shared files
SHARED_FILES=("shl.js" "config.js")

# Define target directories
TARGET_DIRS=("requester" "checkin" "source-flexpa")

echo "Building project..."

for dir in "${TARGET_DIRS[@]}"; do
  echo "Updating $dir..."
  for file in "${SHARED_FILES[@]}"; do
    if [ -f "$file" ]; then
      cp "$file" "$dir/"
      echo "  Copied $file to $dir/"
    else
      echo "  Warning: $file not found in root"
    fi
  done
done

echo "Build complete."
