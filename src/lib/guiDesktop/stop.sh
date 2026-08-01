#!/bin/sh
# Force-stops the GUI desktop, in case the terminal tab running start.sh was
# closed directly instead of via Ctrl+C (which would otherwise leave Xvnc/
# IceWM/xterm running in the background). Safe to run even if nothing is
# running - every step is best-effort.
TOOLS_DIR="$HOME/.gui-desktop"

for f in xterm.pid icewm.pid xvnc.pid; do
	if [ -f "$TOOLS_DIR/$f" ]; then
		kill "$(cat "$TOOLS_DIR/$f")" 2>/dev/null || true
		rm -f "$TOOLS_DIR/$f"
	fi
done

pkill -f "novnc_server" 2>/dev/null || true
pkill -f "websockify" 2>/dev/null || true
pkill -f "icewm" 2>/dev/null || true
pkill -f "^Xvnc " 2>/dev/null || true
pkill -f " Xvnc " 2>/dev/null || true

rm -f /tmp/.X*-lock 2>/dev/null || true
rm -f /tmp/.X11-unix/X* 2>/dev/null || true

echo "GUI desktop stopped."
