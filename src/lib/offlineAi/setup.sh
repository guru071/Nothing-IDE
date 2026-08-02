#!/bin/sh
# Installs llama.cpp (CPU build) from Alpine's edge/community repo - not yet
# in the stable branch's repos, so it's pulled from edge for this one
# package only, leaving the rest of the system on stable - and downloads a
# small instruct model (Qwen2.5 0.5B, ~450MB, one-time). Run in a visible
# terminal so install/download progress is shown.
set -e

TOOLS_DIR="$HOME/.offline-ai"
MODEL_PATH="$TOOLS_DIR/model.gguf"
MODEL_URL="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
EDGE_COMMUNITY="https://dl-cdn.alpinelinux.org/alpine/edge/community"

mkdir -p "$TOOLS_DIR"

if ! command -v llama-server >/dev/null 2>&1; then
	echo "==> Installing llama.cpp (this pulls one package from Alpine edge, since it's not in stable yet)..."
	apk add --no-cache --repository "$EDGE_COMMUNITY" llama-server llama.cpp-cpu
fi

if ! command -v llama-server >/dev/null 2>&1; then
	echo "Error: llama-server still isn't available after install. Your Alpine version may not have this package yet." >&2
	exit 1
fi

if [ ! -f "$MODEL_PATH" ]; then
	echo "==> Downloading Qwen2.5-0.5B-Instruct model (~450MB, one-time)..."
	wget -O "$MODEL_PATH.part" "$MODEL_URL"
	mv "$MODEL_PATH.part" "$MODEL_PATH"
fi

touch "$TOOLS_DIR/setup-status"
echo "==> Offline AI is ready. Close this tab, then use 'Start Offline AI' from the AI Agent panel."
