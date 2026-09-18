#!/usr/bin/env bash
set -euo pipefail

APP_GRADLE="android/app/build.gradle"
PKG_DIR="android/app/src/main/java/it/ge360/garage"

[ -f "$APP_GRADLE" ] || {
  echo "Progetto Android non trovato. Esegui prima: npx cap add android"
  exit 1
}

mkdir -p "$PKG_DIR"
cp scripts/android/GarageStoragePlugin.java "$PKG_DIR/GarageStoragePlugin.java"
cp scripts/android/MainActivity.java "$PKG_DIR/MainActivity.java"

VARS="android/variables.gradle"
if [ -f "$VARS" ]; then
  sed -i -E 's/minSdkVersion = [0-9]+/minSdkVersion = 26/' "$VARS"
fi

if ! grep -q "androidx.documentfile:documentfile" "$APP_GRADLE"; then
  cat >> "$APP_GRADLE" <<'EOF'

dependencies {
    implementation 'androidx.documentfile:documentfile:1.0.1'
}
EOF
fi

echo "GarageStorage installato."
