const WORDS = (
	"lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
	"tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam " +
	"quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo " +
	"consequat duis aute irure in reprehenderit voluptate velit esse cillum " +
	"eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident " +
	"sunt culpa qui officia deserunt mollit anim id est laborum"
).split(" ");

function randomWord() {
	return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function generateSentence(wordCount) {
	const words = Array.from({ length: wordCount }, randomWord);
	const sentence = words.join(" ");
	return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function generateParagraph(sentenceCount) {
	return Array.from({ length: sentenceCount }, () =>
		generateSentence(6 + Math.floor(Math.random() * 10)),
	).join(" ");
}

function insertAtCursor(view, text) {
	const { from, to } = view.state.selection.main;
	view.dispatch({
		changes: { from, to, insert: text },
		selection: { anchor: from + text.length },
	});
}

acode.setPluginInit("lorem-ipsum", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "lorem-ipsum-sentence",
		description: "Lorem Ipsum: Insert Sentence",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			insertAtCursor(view, generateSentence(10));
		},
	});

	acode.addCommand({
		name: "lorem-ipsum-paragraph",
		description: "Lorem Ipsum: Insert Paragraph",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			insertAtCursor(view, generateParagraph(5));
		},
	});
});

acode.setPluginUnmount("lorem-ipsum", () => {
	acode.removeCommand("lorem-ipsum-sentence");
	acode.removeCommand("lorem-ipsum-paragraph");
});
