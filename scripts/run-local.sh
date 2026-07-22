#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

HEADLESS="${HEADLESS:-false}" \
SLOW_MO="${SLOW_MO:-150}" \
RECORD_VIDEO="${RECORD_VIDEO:-true}" \
npm run test
