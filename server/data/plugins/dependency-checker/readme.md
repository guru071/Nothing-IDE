# Dependency Checker

Checks a selected `package.json`'s `dependencies`/`devDependencies`
against the public npm registry and reports which pinned versions differ
from the latest published version. Copies the report to the clipboard.

Requires network access - this is the one plugin in this set that talks
to an external service (`registry.npmjs.org`, no auth/API key needed).

## Commands

- **Dependencies: Check package.json for Outdated Versions**
