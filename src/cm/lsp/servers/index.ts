import type { LspServerBundle, LspServerManifest } from "../types";
import { dartBundle, dartServers } from "./dart";
import { dataLanguageBundle, dataLanguageServers } from "./dataLanguages";
import { javascriptBundle, javascriptServers } from "./javascript";
import { kotlinBundle, kotlinServers } from "./kotlin";
import { luaBundle, luaServers } from "./lua";
import { luauBundle, luauServers } from "./luau";
import { pythonBundle, pythonServers } from "./python";
import { scriptingBundle, scriptingServers } from "./scripting";
import { systemsBundle, systemsServers } from "./systems";
import { webBundle, webServers } from "./web";

export const builtinServers: LspServerManifest[] = [
	...javascriptServers,
	...pythonServers,
	...luauServers,
	...webServers,
	...systemsServers,
	...luaServers,
	...dataLanguageServers,
	...scriptingServers,
	...kotlinServers,
	...dartServers,
];

export const builtinServerBundles: LspServerBundle[] = [
	javascriptBundle,
	pythonBundle,
	luauBundle,
	webBundle,
	systemsBundle,
	luaBundle,
	dataLanguageBundle,
	scriptingBundle,
	kotlinBundle,
	dartBundle,
];
