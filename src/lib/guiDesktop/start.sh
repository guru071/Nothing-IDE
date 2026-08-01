#!/bin/sh
# Starts the GUI desktop: Xvnc (virtual X server + VNC server in one),
# IceWM (window manager), an xterm (so there's an immediate way to launch
# other GUI apps on the desktop), and novnc_server (the noVNC web bridge).
# Run 'setup.sh' first. Stays in the foreground running novnc_server, so
# Ctrl+C (or closing this terminal tab) stops the whole desktop via the trap
# below - nothing is left running in the background afterwards.
set -e

TOOLS_DIR="$HOME/.gui-desktop"
DISPLAY_NUM="${DISPLAY_NUM:-1}"
VNC_PORT=$((5900 + DISPLAY_NUM))
WEB_PORT="${WEB_PORT:-6080}"
GEOMETRY="${GEOMETRY:-1280x720}"

[ -f "$TOOLS_DIR/setup-status" ] || {
	echo "GUI desktop tools aren't set up yet. Run 'Set Up GUI Desktop' first." >&2
	exit 1
}

mkdir -p "$TOOLS_DIR/logs"

cleanup() {
	echo ""
	echo "==> Stopping GUI desktop..."
	[ -f "$TOOLS_DIR/xterm.pid" ] && kill "$(cat "$TOOLS_DIR/xterm.pid")" 2>/dev/null
	[ -f "$TOOLS_DIR/icewm.pid" ] && kill "$(cat "$TOOLS_DIR/icewm.pid")" 2>/dev/null
	[ -f "$TOOLS_DIR/xvnc.pid" ] && kill "$(cat "$TOOLS_DIR/xvnc.pid")" 2>/dev/null
	rm -f "$TOOLS_DIR/xterm.pid" "$TOOLS_DIR/icewm.pid" "$TOOLS_DIR/xvnc.pid"
}
trap cleanup EXIT INT TERM

# Clean up any previous run on this display so re-launching is idempotent.
if [ -f "$TOOLS_DIR/xvnc.pid" ]; then
	kill "$(cat "$TOOLS_DIR/xvnc.pid")" 2>/dev/null || true
fi
pkill -f "Xvnc :$DISPLAY_NUM " 2>/dev/null || true
rm -f "/tmp/.X$DISPLAY_NUM-lock" "/tmp/.X11-unix/X$DISPLAY_NUM" 2>/dev/null || true

echo "==> Starting Xvnc on display :$DISPLAY_NUM (VNC port $VNC_PORT)..."
Xvnc ":$DISPLAY_NUM" \
	-geometry "$GEOMETRY" \
	-depth 24 \
	-SecurityTypes None \
	-localhost \
	-AlwaysShared \
	>"$TOOLS_DIR/logs/xvnc.log" 2>&1 &
echo $! >"$TOOLS_DIR/xvnc.pid"

echo "==> Waiting for the X display to come up..."
i=0
while [ ! -e "/tmp/.X11-unix/X$DISPLAY_NUM" ]; do
	i=$((i + 1))
	if [ "$i" -ge 50 ]; then
		echo "FAILED: Xvnc didn't start. Log:" >&2
		cat "$TOOLS_DIR/logs/xvnc.log" >&2
		exit 1
	fi
	sleep 0.2
done

export DISPLAY=":$DISPLAY_NUM"

echo "==> Starting IceWM..."
icewm-session >"$TOOLS_DIR/logs/icewm.log" 2>&1 &
echo $! >"$TOOLS_DIR/icewm.pid"

echo "==> Starting a terminal on the desktop (use it to launch GUI apps)..."
xterm >"$TOOLS_DIR/logs/xterm.log" 2>&1 &
echo $! >"$TOOLS_DIR/xterm.pid"

echo ""
echo "=================================================================="
echo " GUI desktop is running."
echo ""
echo " View it from a browser ON THIS DEVICE (works in Acode's built-in"
echo " in-app browser, or any browser):"
echo ""
echo "   http://127.0.0.1:$WEB_PORT/vnc.html?autoconnect=true&resize=remote"
echo ""
echo " Or connect any VNC viewer app to:"
echo ""
echo "   localhost:$VNC_PORT"
echo ""
echo " The VNC server only listens on localhost (loopback) and has no"
echo " password - like a local dev server, it isn't reachable from"
echo " outside this device."
echo ""
echo " Press Ctrl+C here to stop the desktop."
echo "=================================================================="
echo ""

exec novnc_server --vnc "localhost:$VNC_PORT" --web /usr/share/novnc --listen "127.0.0.1:$WEB_PORT"
