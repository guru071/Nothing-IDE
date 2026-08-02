# Secret Scanner

Scans the current selection (or the whole file) for high-confidence
patterns of leaked credentials - AWS keys, GitHub/npm/Slack tokens,
Google API keys, Stripe live keys, PEM private key blocks, JWTs, and
URLs with embedded credentials. Copies a line-numbered report to the
clipboard.

Deliberately does *not* flag generic `password = "..."` style assignments
- those produce overwhelmingly false positives and would bury the real
findings in noise.

## Commands

- **Secrets: Scan Selection/File for Leaked Credentials**
