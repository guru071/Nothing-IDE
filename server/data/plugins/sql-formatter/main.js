// Heuristic keyword-based formatter, not a real SQL parser - good enough for
// typical single-statement queries, not guaranteed correct for every dialect
// or deeply nested subquery.

const TOP_LEVEL = [
	"SELECT",
	"FROM",
	"WHERE",
	"GROUP BY",
	"ORDER BY",
	"HAVING",
	"LIMIT",
	"OFFSET",
	"INSERT INTO",
	"VALUES",
	"UPDATE",
	"SET",
	"DELETE FROM",
	"UNION ALL",
	"UNION",
];

const JOIN_LEVEL = [
	"LEFT OUTER JOIN",
	"RIGHT OUTER JOIN",
	"FULL OUTER JOIN",
	"INNER JOIN",
	"LEFT JOIN",
	"RIGHT JOIN",
	"CROSS JOIN",
	"JOIN",
];

const SUB_LEVEL = ["AND", "OR", "ON"];

// Longest-first within each level, and levels concatenated longest-first
// overall, so e.g. "LEFT OUTER JOIN" matches before "LEFT JOIN" or "JOIN".
const ALL_KEYWORDS = [...TOP_LEVEL, ...JOIN_LEVEL, ...SUB_LEVEL].sort(
	(a, b) => b.length - a.length,
);

const KEYWORD_PATTERN = new RegExp(
	`\\b(${ALL_KEYWORDS.map((k) => k.replace(/ /g, "\\s+")).join("|")})\\b`,
	"gi",
);

function levelOf(keywordUpper) {
	if (TOP_LEVEL.includes(keywordUpper)) return 0;
	if (JOIN_LEVEL.includes(keywordUpper)) return 1;
	return 2;
}

function formatSql(text) {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return text;

	const matches = [...normalized.matchAll(KEYWORD_PATTERN)];
	if (matches.length === 0) return normalized;

	const lines = [];
	const leading = normalized.slice(0, matches[0].index).trim();
	if (leading) lines.push({ indent: 0, text: leading });

	for (let i = 0; i < matches.length; i++) {
		const keywordUpper = matches[i][0].replace(/\s+/g, " ").toUpperCase();
		const start = matches[i].index + matches[i][0].length;
		const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
		const rest = normalized.slice(start, end).trim();
		lines.push({
			indent: levelOf(keywordUpper),
			text: rest ? `${keywordUpper} ${rest}` : keywordUpper,
		});
	}

	return lines.map((line) => "  ".repeat(line.indent) + line.text).join("\n");
}

function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

acode.setPluginInit("sql-formatter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "sql-format",
		description: "SQL: Format Query",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			view.dispatch({
				changes: { from: target.from, to: target.to, insert: formatSql(target.text) },
			});
		},
	});
});

acode.setPluginUnmount("sql-formatter", () => {
	acode.removeCommand("sql-format");
});
