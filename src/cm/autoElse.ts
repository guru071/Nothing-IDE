import { snippetCompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionSource } from "@codemirror/autocomplete";
import { language } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";

/** Curly-brace, C-style-`if` languages this heuristic applies to. Python's
 * indentation-based if/elif/else has a different shape and isn't handled here. */
const CURLY_BRACE_LANGUAGES = new Set([
	"java",
	"javascript",
	"cpp",
	"go",
	"rust",
	"php",
]);

/** Bound backward scans so a huge/minified file with unmatched braces can't
 * make this run unbounded work on every keystroke. */
const MAX_BACKWARD_SCAN = 20000;

function isIdentChar(ch: string | undefined): boolean {
	return !!ch && /[A-Za-z0-9_]/.test(ch);
}

function isWhitespace(ch: string | undefined): boolean {
	return !!ch && /\s/.test(ch);
}

function findMatchingOpen(
	doc: string,
	closeIndex: number,
	openChar: string,
	closeChar: string,
): number | null {
	let depth = 0;
	const limit = Math.max(0, closeIndex - MAX_BACKWARD_SCAN);
	for (let i = closeIndex; i >= limit; i--) {
		if (doc[i] === closeChar) depth++;
		else if (doc[i] === openChar) {
			depth--;
			if (depth === 0) return i;
		}
	}
	return null;
}

/** Is the `}` at `closeBraceIndex` the closing brace of an `if (...) { ... }`
 * (or `else if (...) { ... }`) block? Walks back over the matched `{...}`,
 * then the matched `(...)`, then checks the word right before `(` is "if". */
function closesIfBlock(doc: string, closeBraceIndex: number): boolean {
	const openBraceIndex = findMatchingOpen(doc, closeBraceIndex, "{", "}");
	if (openBraceIndex == null) return false;

	let i = openBraceIndex - 1;
	while (i >= 0 && isWhitespace(doc[i])) i--;
	if (i < 0 || doc[i] !== ")") return false;

	const openParenIndex = findMatchingOpen(doc, i, "(", ")");
	if (openParenIndex == null) return false;

	let j = openParenIndex - 1;
	while (j >= 0 && isWhitespace(doc[j])) j--;
	const wordEnd = j + 1;
	while (j >= 0 && isIdentChar(doc[j])) j--;
	return doc.slice(j + 1, wordEnd) === "if";
}

function alreadyFollowedByElse(doc: string, pos: number): boolean {
	let i = pos;
	while (i < doc.length && isWhitespace(doc[i])) i++;
	return doc.slice(i, i + 4) === "else" && !isIdentChar(doc[i + 4]);
}

/** Suggests "else" / "else if" completions right after the user finishes
 * typing the closing brace of an if-block that doesn't already have one. */
export const autoElseCompletionSource: CompletionSource = (
	context: CompletionContext,
) => {
	const lang = context.state.facet(language)?.name?.toLowerCase();
	if (!lang || !CURLY_BRACE_LANGUAGES.has(lang)) return null;

	const doc = context.state.doc.toString();
	const pos = context.pos;

	let i = pos - 1;
	while (i >= 0 && isWhitespace(doc[i])) i--;
	if (i < 0 || doc[i] !== "}") return null;
	if (!closesIfBlock(doc, i)) return null;
	if (alreadyFollowedByElse(doc, pos)) return null;

	return {
		from: pos,
		options: [
			snippetCompletion(" else {\n\t${}\n}", {
				label: "else",
				detail: "else block",
			}),
			snippetCompletion(" else if (${}) {\n\t${}\n}", {
				label: "else if",
				detail: "else if block",
			}),
		],
		validFor: /^$/,
	};
};

export default function autoElseExtension(): Extension {
	return EditorState.languageData.of(() => [
		{ autocomplete: autoElseCompletionSource },
	]);
}
