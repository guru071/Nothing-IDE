# Nothing IDE

A free, full-featured code editor and IDE for Android — edit, run, and build projects entirely on your phone or tablet, online or offline.

## Features

- Multi-language syntax highlighting and autocomplete, powered by CodeMirror and language servers
- Command palette (Ctrl-Shift-P) with VS Code-style keybindings
- VS Code Dark and VS Code Light editor themes, plus dozens of other built-in themes
- Built-in Linux terminal sandbox (Alpine via proot) with a real shell, package manager, and language runtimes
- Git source control panel — stage, unstage, commit, push, pull, and view diffs without leaving the editor
- On-device Android APK builder — compile and sign a debug APK straight from the terminal sandbox, no desktop required
- On-device GUI desktop (VNC) — run graphical Linux apps and view them in-app
- Camera and sensor capture bridge for on-device Python/OpenCV scripts
- A large plugin ecosystem for extending the editor further
- No ads, no paywall, no account required

## Project Structure

```
Nothing IDE/
|
|- src/   - Core code and language files
|
|- www/   - Public documents, compiled files, and HTML templates
|
|- utils/ - CLI tools for building, string manipulation, and more
```

## Multi-language UI Support

Add a new UI language by creating a file with the language code (e.g. `en-us` for English) in [`src/lang/`](src/lang/) and registering it in [`src/lib/lang.js`](src/lib/lang.js). Manage strings across languages with:

```shell
npm run lang add
npm run lang remove
npm run lang search
npm run lang update
```

## Building the Application

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed build instructions.

## Developing a Plugin

Plugins extend the editor with new commands, languages, and UI. See the plugin API exposed via `acode.addCommand`, `acode.registerFileHandler`, and related methods in `src/lib/acode.js`.
