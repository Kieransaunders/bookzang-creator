#!/usr/bin/env bash
set -euo pipefail

TARGET_PLIST="$HOME/Library/LaunchAgents/com.bookzang.ingest.daemon.plist"

if [[ -f "$TARGET_PLIST" ]]; then
  launchctl unload "$TARGET_PLIST" 2>/dev/null || true
  rm -f "$TARGET_PLIST"
  printf "Removed launchd service: %s\n" "$TARGET_PLIST"
else
  printf "No launchd service found at %s\n" "$TARGET_PLIST"
fi
