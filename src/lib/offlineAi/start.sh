#!/bin/sh
# Starts the offline model server in the foreground. Ctrl+C here (or closing
# this terminal tab) stops it - nothing is left running in the background.
TOOLS_DIR="$HOME/.offline-ai"
MODEL_PATH="$TOOLS_DIR/model.gguf"
PORT="${PORT:-8090}"

[ -f "$TOOLS_DIR/setup-status" ] || {
	echo "Offline AI isn't set up yet. Run 'Set Up Offline AI' first." >&2
	exit 1
}

pkill -f "llama-server .*--port $PORT" 2>/dev/null || true

echo "==> Starting offline AI model server on 127.0.0.1:$PORT..."
exec llama-server -m "$MODEL_PATH" --port "$PORT" --host 127.0.0.1 -c 4096
