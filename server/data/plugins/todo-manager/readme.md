# TODO Manager

Scans the current file for `TODO`, `FIXME`, `HACK`, `XXX`, and `BUG`
comments and copies a line-numbered list to the clipboard.

This is a simple line-based scan, not a comment-aware parser - for a
block comment like `/* HACK: ... */`, the captured note includes
everything to the end of the line (including the closing `*/`).

## Commands

- **TODO: List TODO/FIXME/HACK Comments in File**
