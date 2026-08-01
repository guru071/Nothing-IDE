#!/bin/sh
# Builds a debug APK from the current directory using a plain javac -> d8 ->
# aapt2 -> jarsigner pipeline (no Gradle). Expects a conventional layout:
#   ./AndroidManifest.xml   (required)
#   ./src/                 (required, .java sources, package-per-directory)
#   ./res/                 (optional, Android resources)
# Run `setup.sh` first to provision the JDK/D8/android.jar/aapt2.
set -e

TOOLS_DIR="$HOME/.android-build"
PLATFORM_API="35"
ANDROID_JAR="$TOOLS_DIR/platforms/android-${PLATFORM_API}/android.jar"
R8_JAR="$TOOLS_DIR/tools/r8.jar"
AAPT_BIN="$TOOLS_DIR/tools/aapt_bin"
OUT_NAME="${1:-app-debug.apk}"

fail() {
	echo "BUILD FAILED: $1" >&2
	exit 1
}

[ -f "$TOOLS_DIR/setup-status" ] || fail "Toolchain not set up yet. Run the 'Set Up Android Build Tools' command first."
[ -f "AndroidManifest.xml" ] || fail "No AndroidManifest.xml found in this project's root folder."
[ -d "src" ] || fail "No src/ folder found. Java sources must live under ./src (package-per-directory)."
[ -f "$ANDROID_JAR" ] || fail "android.jar missing - re-run setup."
[ -f "$R8_JAR" ] || fail "D8/R8 missing - re-run setup."
[ -x "$AAPT_BIN" ] || fail "aapt2/aapt not found. Install Termux and run 'pkg install aapt' inside it, then re-run setup."

rm -rf build
mkdir -p build/classes build/gen build/dex build/apk

echo "==> [1/5] Compiling & linking resources..."
if [ -d res ]; then
	"$AAPT_BIN" compile --dir res -o build/compiled_res.zip
	"$AAPT_BIN" link -o build/apk/base.apk \
		-I "$ANDROID_JAR" \
		--manifest AndroidManifest.xml \
		--java build/gen \
		--auto-add-overlay \
		build/compiled_res.zip
else
	"$AAPT_BIN" link -o build/apk/base.apk \
		-I "$ANDROID_JAR" \
		--manifest AndroidManifest.xml \
		--java build/gen
fi

echo "==> [2/5] Compiling Java sources..."
find src build/gen -name "*.java" > build/sources.txt
[ -s build/sources.txt ] || fail "No .java files found under src/."
javac -encoding UTF-8 -classpath "$ANDROID_JAR" -bootclasspath "$ANDROID_JAR" \
	-d build/classes @build/sources.txt

echo "==> [3/5] Dexing..."
find build/classes -name "*.class" > build/classfiles.txt
java -cp "$R8_JAR" com.android.tools.r8.D8 \
	--output build/dex --lib "$ANDROID_JAR" --min-api "${MIN_SDK:-24}" \
	@build/classfiles.txt

echo "==> [4/5] Assembling APK..."
rm -f "$OUT_NAME"
cp build/apk/base.apk "$OUT_NAME"
cp build/dex/classes.dex build/apk/classes.dex
(cd build/apk && zip -q -j -X "$OLDPWD/$OUT_NAME" classes.dex)

echo "==> [5/5] Signing (debug key)..."
if [ ! -f "$TOOLS_DIR/debug.keystore" ]; then
	keytool -genkeypair -v \
		-keystore "$TOOLS_DIR/debug.keystore" -storepass android \
		-alias androiddebugkey -keypass android \
		-keyalg RSA -keysize 2048 -validity 10000 \
		-dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi
jarsigner -keystore "$TOOLS_DIR/debug.keystore" -storepass android "$OUT_NAME" androiddebugkey >/dev/null

echo ""
echo "BUILD SUCCESSFUL"
echo "APK: $(pwd)/$OUT_NAME"
