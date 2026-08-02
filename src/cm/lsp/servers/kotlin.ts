import { defineBundle, defineServer, installers } from "../providerUtils";
import type { LspServerBundle, LspServerManifest } from "../types";

export const kotlinServers: LspServerManifest[] = [
	defineServer({
		id: "kotlin-language-server",
		label: "Kotlin",
		languages: ["kotlin"],
		command: "/opt/kotlin-language-server/server/bin/kotlin-language-server",
		checkCommand:
			"test -x /opt/kotlin-language-server/server/bin/kotlin-language-server",
		// Disabled by default: this is a genuinely heavy install for a mobile
		// device - the release archive alone is ~90MB (it bundles its own
		// kotlin-compiler jar), plus a JVM (openjdk21, another substantial
		// download) that isn't needed by anything else in this app. Verified
		// the archive's internal layout (server/bin/..., server/lib/*.jar)
		// directly before writing this install script, since it's a full
		// directory tree rather than a single binary the generic
		// githubRelease installer can handle.
		installer: installers.shell({
			executable:
				"/opt/kotlin-language-server/server/bin/kotlin-language-server",
			command:
				"apk add --no-cache openjdk21-jre curl unzip && rm -rf /opt/kotlin-language-server && mkdir -p /opt/kotlin-language-server && curl -fsSL https://github.com/fwcd/kotlin-language-server/releases/latest/download/server.zip -o /tmp/kotlin-lsp.zip && unzip -oq /tmp/kotlin-lsp.zip -d /opt/kotlin-language-server && rm /tmp/kotlin-lsp.zip && chmod +x /opt/kotlin-language-server/server/bin/kotlin-language-server",
		}),
		enabled: false,
	}),
];

export const kotlinBundle: LspServerBundle = defineBundle({
	id: "builtin-kotlin",
	label: "Kotlin",
	servers: kotlinServers,
});
