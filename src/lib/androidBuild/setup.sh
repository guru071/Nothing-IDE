#!/bin/sh
# Provisions an on-device Android build toolchain inside the Alpine sandbox:
# a JDK, Google's D8 dexer (pure JVM, works on any CPU architecture), and a
# stub android.jar to compile against. aapt2 (resource compiling/packaging)
# has no pure-JVM equivalent - it's a native binary, so we look for one
# already on the device (e.g. installed via Termux: `pkg install aapt`)
# rather than bundling one ourselves, since prebuilt aapt2 binaries from
# Google only target desktop OSes, not Android's own CPU/ABI.
set -e

TOOLS_DIR="$HOME/.android-build"
PLATFORM_API="35"
PLATFORM_ZIP_URL="https://dl.google.com/android/repository/platform-${PLATFORM_API}_r02.zip"
R8_VERSION="9.1.31"
R8_JAR_URL="https://dl.google.com/dl/android/maven2/com/android/tools/r8/${R8_VERSION}/r8-${R8_VERSION}.jar"

mkdir -p "$TOOLS_DIR/tools" "$TOOLS_DIR/platforms"

echo "==> Checking for a JDK..."
if ! command -v javac >/dev/null 2>&1; then
	echo "==> Installing OpenJDK 17..."
	apk add --no-cache openjdk17 >/dev/null
else
	echo "    javac found: $(command -v javac)"
fi

for pkg in zip unzip wget; do
	if ! command -v "$pkg" >/dev/null 2>&1; then
		echo "==> Installing $pkg..."
		apk add --no-cache "$pkg" >/dev/null
	fi
done

echo "==> Checking for D8 (dexer)..."
if [ ! -f "$TOOLS_DIR/tools/r8.jar" ]; then
	echo "==> Downloading D8/R8 ${R8_VERSION}..."
	wget -q -O "$TOOLS_DIR/tools/r8.jar.part" "$R8_JAR_URL"
	mv "$TOOLS_DIR/tools/r8.jar.part" "$TOOLS_DIR/tools/r8.jar"
else
	echo "    already present"
fi

echo "==> Checking for android.jar (API $PLATFORM_API)..."
if [ ! -f "$TOOLS_DIR/platforms/android-${PLATFORM_API}/android.jar" ]; then
	echo "==> Downloading Android platform $PLATFORM_API (this is ~65MB, may take a while)..."
	wget -q -O "$TOOLS_DIR/platform.zip.part" "$PLATFORM_ZIP_URL"
	mv "$TOOLS_DIR/platform.zip.part" "$TOOLS_DIR/platform.zip"
	unzip -q -o "$TOOLS_DIR/platform.zip" -d "$TOOLS_DIR/platforms"
	rm -f "$TOOLS_DIR/platform.zip"
else
	echo "    already present"
fi

echo "==> Looking for aapt2/aapt (resource packaging - needs a native binary)..."
AAPT_BIN=""
for candidate in \
	"$(command -v aapt2 2>/dev/null)" \
	"$(command -v aapt 2>/dev/null)" \
	"/data/data/com.termux/files/usr/bin/aapt2" \
	"/data/data/com.termux/files/usr/bin/aapt"; do
	if [ -n "$candidate" ] && [ -x "$candidate" ]; then
		AAPT_BIN="$candidate"
		break
	fi
done

if [ -n "$AAPT_BIN" ]; then
	ln -sf "$AAPT_BIN" "$TOOLS_DIR/tools/aapt_bin"
	echo "    found: $AAPT_BIN"
	echo "aapt-ok" > "$TOOLS_DIR/aapt-status"
else
	echo "    NOT FOUND."
	echo "    Resource packaging needs a native aapt2/aapt binary, which isn't"
	echo "    available in this sandbox. Install the Termux app (termux.com,"
	echo "    F-Droid build - not the abandoned Play Store one), then inside"
	echo "    Termux run: pkg install aapt"
	echo "    Then re-run this setup."
	rm -f "$TOOLS_DIR/aapt-status"
fi

echo "==> Done."
echo "jdk-ok" > "$TOOLS_DIR/setup-status"
