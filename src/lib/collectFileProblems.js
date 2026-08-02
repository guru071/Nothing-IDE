import { getLspDiagnostics } from "cm/lsp/diagnostics";

/**
 * Collects Ace-session annotations and LSP diagnostics for one open editor
 * file into a single normalized list. Shared by the Problems page and the
 * docked Problems sidebar app so both stay in sync with one implementation.
 * @param {import("./editorFile").default} file
 * @returns {Array<{row: number, column: number, text: string, type: "error"|"warning"|"info"}>}
 */
export function collectFileProblems(file) {
	const annotations = [];
	const { session } = file;
	const isActiveFile = editorManager.activeFile?.id === file.id;
	const state =
		isActiveFile && editorManager.editor ? editorManager.editor.state : session;

	if (session && typeof session.getAnnotations === "function") {
		const aceAnnotations = session.getAnnotations() || [];
		for (const item of aceAnnotations) {
			if (!item) continue;
			const row = normalizeIndex(item.row);
			const column = normalizeIndex(item.column);
			annotations.push({
				row,
				column,
				text: item.text || "",
				type: normalizeSeverity(item.type),
			});
		}
	}

	if (state && typeof state.field === "function") {
		annotations.push(...readLspAnnotations(state));
	}

	return annotations;
}

function readLspAnnotations(state) {
	const diagnostics = getLspDiagnostics(state);
	if (!diagnostics.length) return [];

	const doc = state.doc;
	if (!doc || typeof doc.lineAt !== "function") return [];

	return diagnostics
		.map((diagnostic) => {
			const start = clampPosition(diagnostic.from, doc.length);
			const line = doc.lineAt(start);
			const row = Math.max(0, line.number - 1);
			const column = Math.max(0, start - line.from);

			let message = diagnostic.message || "";
			if (diagnostic.source) {
				message = message
					? `${message} (${diagnostic.source})`
					: diagnostic.source;
			}

			return {
				row: normalizeIndex(row),
				column: normalizeIndex(column),
				text: message,
				type: normalizeSeverity(diagnostic.severity),
			};
		})
		.filter((annotation) => annotation.text);
}

function clampPosition(pos, length) {
	if (typeof pos !== "number" || Number.isNaN(pos)) return 0;
	return Math.max(0, Math.min(pos, Math.max(0, length)));
}

function normalizeIndex(value) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.max(0, value);
	}
	const parsed = Number(value);
	if (Number.isFinite(parsed)) {
		return Math.max(0, parsed);
	}
	return 0;
}

export function normalizeSeverity(severity) {
	switch (severity) {
		case "error":
		case "fatal":
			return "error";
		case "warn":
		case "warning":
			return "warning";
		default:
			return "info";
	}
}

export function getIconForProblemType(type) {
	switch (type) {
		case "error":
			return "cancel";
		case "warning":
			return "warningreport_problem";
		default:
			return "info";
	}
}
