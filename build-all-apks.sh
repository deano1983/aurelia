#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Aurelia OS — Batch Native Android APK Builder (for local Android Studio setups)
# Builds sideloadable APKs for all 8 apps and copies them into ./apks/
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APK_OUT_DIR="$ROOT_DIR/apks"
mkdir -p "$APK_OUT_DIR"

# Auto-detect Android Studio bundled JDK (JBR) if JAVA_HOME is not set
if ! command -v java >/dev/null 2>&1; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "$HOME/android-studio/jbr" \
    "/opt/android-studio/jbr" \
    "/usr/local/android-studio/jbr" \
    "/c/Program Files/Android/Android Studio/jbr"; do
    if [ -d "$candidate" ]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

# Auto-detect ANDROID_HOME if not set
if [ -z "${ANDROID_HOME:-}" ]; then
  for sdk_candidate in \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "$LOCALAPPDATA/Android/Sdk" \
    "/c/Users/$USER/AppData/Local/Android/Sdk"; do
    if [ -d "$sdk_candidate" ]; then
      export ANDROID_HOME="$sdk_candidate"
      export ANDROID_SDK_ROOT="$sdk_candidate"
      break
    fi
  done
fi

APPS=(
  "00-central-hub"
  "01-daily-command-timeline"
  "02-cross-cloud-asset-vault"
  "03-voice-authority-studio"
  "04-ctl-encrypted-relay"
  "05-glowgrid-creator-radar"
  "06-expense-tax-invoice"
  "07-distribution-affiliate-engine"
)

echo "================================================================"
echo " Aurelia OS — Building All 8 Sideloadable Android APKs"
echo " JAVA_HOME:    ${JAVA_HOME:-$(which java 2>/dev/null || echo 'not found')}"
echo " ANDROID_HOME: ${ANDROID_HOME:-not set}"
echo " Output Dir:   $APK_OUT_DIR"
echo "================================================================"

for app in "${APPS[@]}"; do
  echo ""
  echo ">>> [$app] Syncing web bundle & compiling sideloadable APK..."
  cd "$ROOT_DIR/$app"
  npm run build
  npx cap sync android
  cd "$ROOT_DIR/$app/android"
  chmod +x gradlew
  ./gradlew assembleDebug
  cp app/build/outputs/apk/debug/app-debug.apk "$APK_OUT_DIR/${app}-sideload.apk"
  echo "✓ Built: $APK_OUT_DIR/${app}-sideload.apk"
done

echo ""
echo "✅ All 8 sideloadable APKs built in: $APK_OUT_DIR"
ls -lh "$APK_OUT_DIR"
