#!/usr/bin/env bash
set -euo pipefail

DAEMON_LABEL="${DAEMON_LABEL:-com.bookzang.ingest.daemon}"
TARGET_PLIST="$HOME/Library/LaunchAgents/$DAEMON_LABEL.plist"

remove_service() {
  local label="$1"
  local plist="$HOME/Library/LaunchAgents/$label.plist"
  if [[ -f "$plist" ]]; then
    launchctl unload "$plist" 2>/dev/null || true
    rm -f "$plist"
    printf "Removed launchd service: %s\n" "$plist"
  fi
}

if [[ -f "$TARGET_PLIST" ]]; then
  remove_service "$DAEMON_LABEL"
else
  printf "No launchd service found at %s\n" "$TARGET_PLIST"
fi

# Legacy cleanup for prior hardcoded label
if [[ "$DAEMON_LABEL" != "com.bookzang.ingest.daemon" ]]; then
  remove_service "com.bookzang.ingest.daemon"
fi
