import { defineBundle, defineServer, installers } from "../providerUtils";
import type { LspServerBundle, LspServerManifest } from "../types";

export const dataLanguageServers: LspServerManifest[] = [
	defineServer({
		id: "yaml-language-server",
		label: "YAML",
		languages: ["yaml"],
		command: "yaml-language-server",
		args: ["--stdio"],
		checkCommand: "which yaml-language-server",
		installer: installers.npm({
			executable: "yaml-language-server",
			packages: ["yaml-language-server"],
		}),
		enabled: true,
	}),
	defineServer({
		id: "taplo",
		label: "TOML (Taplo)",
		languages: ["toml"],
		command: "taplo",
		args: ["lsp", "stdio"],
		checkCommand: "which taplo",
		installer: installers.apk({
			executable: "taplo",
			packages: ["taplo"],
		}),
		enabled: true,
	}),
];

export const dataLanguageBundle: LspServerBundle = defineBundle({
	id: "builtin-data-languages",
	label: "YAML / TOML",
	servers: dataLanguageServers,
});
