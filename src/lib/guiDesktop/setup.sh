#!/bin/sh
# Provisions a small Linux desktop inside the Alpine sandbox that can be
# viewed from the phone's own screen: TigerVNC's Xvnc (an X server that
# renders straight into memory instead of a physical display, and speaks the
# VNC protocol directly - no separate virtual framebuffer needed), IceWM (a
# lightweight window manager, so windows actually behave like windows), and
# noVNC + websockify (an HTML5 VNC client served over plain HTTP, so viewing
# the desktop needs nothing more than opening a URL - no separate VNC app
# required, though any VNC viewer from F-Droid/Play Store works too since
# Xvnc also listens on a normal VNC/RFB port).
#
# Every package name below was checked against Alpine 3.21's real package
# index (https://pkgs.alpinelinux.org, both aarch64 and x86_64) before being
# hardcoded here - see the README note in guiDesktop.js for details.
set -e

PACKAGES="tigervnc xterm icewm font-noto novnc websockify"
TOOLS_DIR="$HOME/.gui-desktop"

mkdir -p "$TOOLS_DIR/logs"

echo "==> Checking for GUI desktop packages..."
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

echo "==> Verifying required binaries..."
for bin in Xvnc icewm-session xterm novnc_server websockify; do
	if ! command -v "$bin" >/dev/null 2>&1; then
		echo "FAILED: '$bin' still not found after installing $PACKAGES." >&2
		echo "Your Alpine mirror may be out of date - try 'apk update' first." >&2
		rm -f "$TOOLS_DIR/setup-status"
		exit 1
	fi
done

echo "==> Done."
echo "    GUI apps launched from the terminal (after 'Start GUI Desktop') will"
echo "    show up on this virtual desktop, viewable from a browser on this"
echo "    device or any VNC viewer app pointed at localhost."
echo "gui-ok" > "$TOOLS_DIR/setup-status"
