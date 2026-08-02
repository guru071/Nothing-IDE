const STORAGE_PREFIX = "nothing-ide-bookmarks:";

function getFileId() {
	return window.editorManager?.activeFile?.id || null;
}

function loadBookmarks(fileId) {
	try {
		const raw = localStorage.getItem(STORAGE_PREFIX + fileId);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		return [];
	}
}

function saveBookmarks(fileId, lines) {
	localStorage.setItem(STORAGE_PREFIX + fileId, JSON.stringify(lines.slice().sort((a, b) => a - b)));
}

function currentLine(view) {
	return view.state.doc.lineAt(view.state.selection.main.head).number;
}

// A bookmarked line number can outlive the file being edited (lines
// removed since it was saved) - drop anything past the current end of
// document instead of letting doc.line() throw.
function pruneToValidLines(view, fileId, bookmarks) {
	const maxLine = view.state.doc.lines;
	const valid = bookmarks.filter((line) => line >= 1 && line <= maxLine);
	if (valid.length !== bookmarks.length) saveBookmarks(fileId, valid);
	return valid;
}

function jumpToLine(view, lineNumber) {
	const { EditorView } = acode.require("@codemirror/view");
	const line = view.state.doc.line(lineNumber);
	view.dispatch({
		selection: { anchor: line.from },
		effects: EditorView.scrollIntoView(line.from, { y: "center" }),
	});
	view.focus();
}

acode.setPluginInit("bookmarks", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "bookmark-toggle",
		description: "Bookmarks: Toggle Bookmark on Current Line",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			const fileId = getFileId();
			if (!view || !fileId) return;

			const line = currentLine(view);
			const bookmarks = loadBookmarks(fileId);
			const index = bookmarks.indexOf(line);

			if (index === -1) {
				bookmarks.push(line);
				window.toast?.(`Bookmarked line ${line}.`);
			} else {
				bookmarks.splice(index, 1);
				window.toast?.(`Removed bookmark on line ${line}.`);
			}

			saveBookmarks(fileId, bookmarks);
		},
	});

	acode.addCommand({
		name: "bookmark-next",
		description: "Bookmarks: Jump to Next Bookmark",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			const fileId = getFileId();
			if (!view || !fileId) return;

			const bookmarks = pruneToValidLines(view, fileId, loadBookmarks(fileId));
			if (bookmarks.length === 0) {
				window.toast?.("No bookmarks in this file.");
				return;
			}

			const line = currentLine(view);
			const next = bookmarks.find((b) => b > line) ?? bookmarks[0];
			jumpToLine(view, next);
		},
	});

	acode.addCommand({
		name: "bookmark-previous",
		description: "Bookmarks: Jump to Previous Bookmark",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			const fileId = getFileId();
			if (!view || !fileId) return;

			const bookmarks = pruneToValidLines(view, fileId, loadBookmarks(fileId));
			if (bookmarks.length === 0) {
				window.toast?.("No bookmarks in this file.");
				return;
			}

			const line = currentLine(view);
			const reversed = bookmarks.slice().reverse();
			const previous = reversed.find((b) => b < line) ?? reversed[0];
			jumpToLine(view, previous);
		},
	});

	acode.addCommand({
		name: "bookmark-clear",
		description: "Bookmarks: Clear All Bookmarks in File",
		requiresView: false,
		exec: () => {
			const fileId = getFileId();
			if (!fileId) return;
			localStorage.removeItem(STORAGE_PREFIX + fileId);
			window.toast?.("Cleared all bookmarks in this file.");
		},
	});
});

acode.setPluginUnmount("bookmarks", () => {
	acode.removeCommand("bookmark-toggle");
	acode.removeCommand("bookmark-next");
	acode.removeCommand("bookmark-previous");
	acode.removeCommand("bookmark-clear");
});
