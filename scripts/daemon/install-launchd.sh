#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_TEMPLATE="$ROOT_DIR/scripts/daemon/bookzang.ingest.daemon.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/com.bookzang.ingest.daemon.plist"
LOG_DIR="$HOME/Library/Logs/bookzang"
LIBRARY_ROOT="${LIBRARY_ROOT:-$ROOT_DIR/Library}"

mkdir -p "$TARGET_DIR" "$LOG_DIR"

sed \
  -e "s|__WORKDIR__|$ROOT_DIR|g" \
  -e "s|__LIBRARY_ROOT__|$LIBRARY_ROOT|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  "$PLIST_TEMPLATE" > "$TARGET_PLIST"

launchctl unload "$TARGET_PLIST" 2>/dev/null || true
launchctl load "$TARGET_PLIST"
launchctl start com.bookzang.ingest.daemon || true

printf "Installed launchd service: %s\n" "$TARGET_PLIST"
printf "Logs: %s\n" "$LOG_DIR"
