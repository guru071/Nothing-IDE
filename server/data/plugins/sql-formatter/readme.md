# SQL Formatter

Reformats a SQL query, putting major clauses (`SELECT`, `FROM`, `WHERE`,
`JOIN`, etc.) on their own indented lines.

This is a heuristic keyword-based formatter, not a full SQL parser - it
works well for typical single-statement queries but isn't guaranteed
correct for every dialect or deeply nested subquery.

## Commands

- **SQL: Format Query**
