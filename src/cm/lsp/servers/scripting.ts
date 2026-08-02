import { defineBundle, defineServer, installers } from "../providerUtils";
import type { LspServerBundle, LspServerManifest } from "../types";

export const scriptingServers: LspServerManifest[] = [
	defineServer({
		id: "bash-language-server",
		label: "Bash",
		languages: ["shell", "bash"],
		command: "bash-language-server",
		args: ["start"],
		checkCommand: "which bash-language-server",
		installer: installers.npm({
			executable: "bash-language-server",
			packages: ["bash-language-server"],
		}),
		enabled: true,
	}),
	defineServer({
		id: "solargraph",
		label: "Ruby (Solargraph)",
		languages: ["ruby"],
		command: "solargraph",
		args: ["stdio"],
		checkCommand: "which solargraph",
		// solargraph's own gem install has no apk equivalent, and its
		// jaro_winkler dependency is a native extension - needs a C toolchain
		// present before `gem install` will succeed.
		installer: installers.shell({
			executable: "solargraph",
			command:
				"apk add --no-cache ruby ruby-dev build-base && gem install solargraph",
		}),
		enabled: true,
	}),
	defineServer({
		id: "phpactor",
		label: "PHP (Phpactor)",
		languages: ["php"],
		command: "phpactor",
		args: ["language-server"],
		checkCommand: "which phpactor",
		// The standalone .phar from GitHub releases is simpler than a Composer
		// install and needs no per-architecture asset (pure PHP bytecode).
		installer: installers.shell({
			executable: "phpactor",
			command:
				"apk add --no-cache php83 php83-mbstring php83-phar curl && curl -fsSL https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar -o /usr/local/bin/phpactor && chmod +x /usr/local/bin/phpactor",
		}),
		enabled: true,
	}),
];

export const scriptingBundle: LspServerBundle = defineBundle({
	id: "builtin-scripting",
	label: "Scripting",
	servers: scriptingServers,
});
