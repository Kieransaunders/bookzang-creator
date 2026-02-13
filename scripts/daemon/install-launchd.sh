#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_TEMPLATE="$ROOT_DIR/scripts/daemon/bookzang.ingest.daemon.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
DAEMON_LABEL="${DAEMON_LABEL:-com.bookzang.ingest.daemon}"
TARGET_PLIST="$TARGET_DIR/$DAEMON_LABEL.plist"
LOG_DIR="$HOME/Library/Logs/bookzang"
LIBRARY_ROOT="${LIBRARY_ROOT:-$ROOT_DIR/Library}"
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"
SYSTEM_PATH="${PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
TSX_BIN="$ROOT_DIR/node_modules/.bin/tsx"
DAEMON_ENTRY="$ROOT_DIR/scripts/daemon/ingestDaemon.ts"

if [[ -z "$NPM_BIN" ]]; then
  echo "npm not found in PATH; cannot install daemon" >&2
  exit 1
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found in PATH; cannot install daemon" >&2
  exit 1
fi

if [[ ! -x "$TSX_BIN" ]]; then
  echo "tsx binary not found at $TSX_BIN; run npm install first" >&2
  exit 1
fi

if [[ ! -f "$DAEMON_ENTRY" ]]; then
  echo "daemon entry not found at $DAEMON_ENTRY" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR" "$LOG_DIR"

sed \
  -e "s|__LABEL__|$DAEMON_LABEL|g" \
  -e "s|__WORKDIR__|$ROOT_DIR|g" \
  -e "s|__LIBRARY_ROOT__|$LIBRARY_ROOT|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__TSX_BIN__|$TSX_BIN|g" \
  -e "s|__DAEMON_ENTRY__|$DAEMON_ENTRY|g" \
  -e "s|__SYSTEM_PATH__|$SYSTEM_PATH|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  "$PLIST_TEMPLATE" > "$TARGET_PLIST"

launchctl unload "$TARGET_PLIST" 2>/dev/null || true
launchctl load "$TARGET_PLIST"
launchctl start "$DAEMON_LABEL" || true

printf "Installed launchd service: %s\n" "$TARGET_PLIST"
printf "Logs: %s\n" "$LOG_DIR"
printf "Label: %s\n" "$DAEMON_LABEL"
