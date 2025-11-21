#!/usr/bin/env bash
set -euo pipefail

# Serve the site at http://127.0.0.1:4000 using Jekyll's built-in server.
# This script will:
#  - install gems in `docs` via `bundle install`
#  - run `bundle exec jekyll serve` bound to 127.0.0.1:4000

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$ROOT_DIR/docs"

echo "Starting local HTTP preview for your site at http://127.0.0.1:4000"

cd "$DOCS_DIR"

echo "Installing gems (bundle install)..."
bundle install --quiet

echo "Serving the site with Jekyll (host 127.0.0.1:4000)..."
# Run Jekyll's built-in server which serves the site and watches for changes.
bundle exec jekyll serve --host 127.0.0.1 --port 4000

