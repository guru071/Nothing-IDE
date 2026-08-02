import { defineBundle, defineServer, installers } from "../providerUtils";
import type { LspServerBundle, LspServerManifest } from "../types";

export const dartServers: LspServerManifest[] = [
	defineServer({
		id: "dart",
		label: "Dart",
		languages: ["dart"],
		command: "dart",
		args: ["language-server"],
		checkCommand: "which dart",
		// Disabled by default: the `dart` package only exists in Alpine's
		// edge/testing repo (not in any stable branch), which is a rolling,
		// less-tested repo - pulling from it can affect other packages'
		// dependency resolution on the same system. Left available (not
		// removed) since the Dart SDK's own `dart language-server` subcommand
		// genuinely works as an LSP server once installed; just not
		// auto-enabled given the repo-stability tradeoff.
		installer: installers.shell({
			executable: "dart",
			command:
				"apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/testing dart",
		}),
		enabled: false,
	}),
];

export const dartBundle: LspServerBundle = defineBundle({
	id: "builtin-dart",
	label: "Dart",
	servers: dartServers,
});
