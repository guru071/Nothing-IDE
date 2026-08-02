#!/bin/sh
# Force-stops the offline model server, in case the terminal tab running it
# was closed directly instead of via Ctrl+C.
pkill -f "llama-server" 2>/dev/null || true
echo "Offline AI model server stopped."
