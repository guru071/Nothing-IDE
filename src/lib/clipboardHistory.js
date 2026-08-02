const STORAGE_KEY = "clipboard_history";
const MAX_ENTRIES = 50;
const MIN_LENGTH = 1;

const listeners = new Set();

function load() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
	} catch {
		return [];
	}
}

function save(entries) {
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify(entries.slice(0, MAX_ENTRIES)),
	);
	for (const listener of listeners) listener(entries);
}

function addEntry(text) {
	if (typeof text !== "string" || text.trim().length < MIN_LENGTH) return;

	const entries = load().filter((entry) => entry.text !== text);
	entries.unshift({ text, timestamp: Date.now() });
	save(entries);
}

/** Installs the global copy/cut listener - call once at app startup. */
function init() {
	const onCopyOrCut = () => {
		const selection = window.getSelection?.().toString();
		if (selection) addEntry(selection);
	};
	document.addEventListener("copy", onCopyOrCut);
	document.addEventListener("cut", onCopyOrCut);
}

function getHistory() {
	return load();
}

function clearHistory() {
	save([]);
}

/**
 * @param {(entries: Array<{text: string, timestamp: number}>) => void} callback
 * @returns {() => void} unsubscribe
 */
function onChange(callback) {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

export default { init, addEntry, getHistory, clearHistory, onChange };
