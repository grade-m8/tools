#!/bin/zsh
# Builds "PR Inbox.app" (menu bar app for scripts/pr-inbox.mjs) into ~/Applications.
#   ./build.sh            build (and restart it if it's running)
#   ./build.sh --login    build, and also open it at login
#   ./build.sh --remove   quit it, remove the app and the login item
# Needs only the Xcode Command Line Tools (swiftc).
set -euo pipefail

here=${0:A:h}
root=${here:h:h}                                    # tools/
app="$HOME/Applications/PR Inbox.app"
label=com.grade-m8.pr-inbox-bar
agent="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

pkill -x PRInbox 2>/dev/null || true

if [[ ${1:-} == --remove ]]; then
  launchctl bootout "$domain/$label" 2>/dev/null || true
  rm -rf "$app" "$agent"
  echo "Removed PR Inbox."
  exit 0
fi

mkdir -p "$app/Contents/MacOS"
swiftc -O -swift-version 5 -o "$app/Contents/MacOS/PRInbox" "$here/PRInbox.swift"

# PRInboxRoot tells the app where pr-inbox.mjs lives. LSUIElement: menu bar only, no Dock icon.
cat > "$app/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>PR Inbox</string>
  <key>CFBundleIdentifier</key><string>$label</string>
  <key>CFBundleExecutable</key><string>PRInbox</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>PRInboxRoot</key><string>$root</string>
</dict>
</plist>
EOF
codesign --force --sign - "$app" >/dev/null 2>&1

if [[ ${1:-} == --login ]]; then
  cat > "$agent" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>/usr/bin/open</string><string>-a</string><string>$app</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
  launchctl bootout "$domain/$label" 2>/dev/null || true
  launchctl bootstrap "$domain" "$agent"
  echo "Built $app; it opens at login."
else
  open "$app"
  echo "Built and opened $app."
fi
