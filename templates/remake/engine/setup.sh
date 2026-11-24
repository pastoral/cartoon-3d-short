#!/usr/bin/env bash
# Copy the shared look modules from templates/bridge into src/ (they are not duplicated in the repo), then install.
# usage (from the project's engine/ folder): bash setup.sh <path to the skill>/templates/bridge
set -e
B="${1:?pass the path to templates/bridge}"
for f in shade ink cardshade grade lensblur paint toon; do cp "$B/$f.ts" "src/$f.ts"; done
npm i
echo "look modules copied; now: npm run build && npm run check"
