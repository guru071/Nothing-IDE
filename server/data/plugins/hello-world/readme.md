# Hello World

An example plugin for Nothing IDE's self-hosted plugin marketplace.

It registers one command, **"Hello World: Say Hi"**, reachable from the command palette (Ctrl-Shift-P). Selecting it shows a toast message.

Use this plugin's files as a starting point for your own:

- `plugin.json` — manifest (id, name, version, entry point, icon, readme)
- `main.js` — registers commands/UI via the global `acode` API (`acode.addCommand`, `acode.setPluginInit`, `acode.setPluginUnmount`, etc.)
- `icon.png` — shown in the plugin marketplace list
- `readme.md` — this file, shown on the plugin's detail page
