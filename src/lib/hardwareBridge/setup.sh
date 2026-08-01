#!/bin/sh
# Installs Python + OpenCV inside the Alpine sandbox, so scripts run from the
# terminal can process photos/sensor snapshots captured from the phone (see
# hardwareBridge.js for how those get into the shared /public folder).
#
# Uses Alpine's native py3-opencv package rather than `pip install
# opencv-python`: the PyPI opencv-python wheels are built against glibc and
# have no musl/Alpine-compatible build, so pip would either fail outright or
# fall back to a from-source build that needs a huge native toolchain
# (cmake, a C++ compiler, gtk/ffmpeg headers, etc.) and can take a very long
# time on a phone. py3-opencv is prebuilt for Alpine/musl and confirmed
# available for both aarch64 and x86_64 in the v3.21 community repo.
set -e

PACKAGES="python3 py3-pip py3-numpy py3-opencv"

echo "==> Checking for Python + OpenCV..."
MISSING=""
for pkg in $PACKAGES; do
	if ! apk info -e "$pkg" >/dev/null 2>&1; then
		MISSING="$MISSING $pkg"
	fi
done

if [ -n "$MISSING" ]; then
	echo "==> Installing:$MISSING"
	apk add --no-cache $MISSING
else
	echo "    already installed"
fi

echo "==> Verifying OpenCV is importable..."
if ! python3 -c "import cv2; print('OpenCV', cv2.__version__)"; then
	echo "FAILED: py3-opencv installed but 'import cv2' still fails." >&2
	echo "Try 'apk update && apk upgrade' and re-run this setup." >&2
	exit 1
fi

echo "==> Done. Captured photos/sensor snapshots land under ~/camera-captures"
echo "    and ~/sensor-snapshots (i.e. /public/camera-captures,"
echo "    /public/sensor-snapshots) - read them with cv2.imread(...) / json.load(...)."
