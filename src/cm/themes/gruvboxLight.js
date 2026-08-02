import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

export const config = {
	name: "gruvbox_light",
	dark: false,
	background: "#FBF1C7",
	foreground: "#3C3836",
	selection: "#EBDBB2",
	cursor: "#3C3836",
	dropdownBackground: "#F2E5BC",
	dropdownBorder: "#D5C4A1",
	activeLine: "#EBDBB280",
	lineNumber: "#BDAE93",
	lineNumberActive: "#3C3836",
	matchingBracket: "#D5C4A1",
	keyword: "#9D0006",
	storage: "#9D0006",
	variable: "#3C3836",
	parameter: "#427B58",
	function: "#076678",
	string: "#79740E",
	constant: "#8F3F71",
	type: "#B57614",
	class: "#B57614",
	number: "#8F3F71",
	comment: "#928374",
	heading: "#076678",
	invalid: "#9D0006",
	regexp: "#427B58",
};

export const gruvboxLightTheme = EditorView.theme(
	{
		"&": {
			color: config.foreground,
			backgroundColor: config.background,
		},

		".cm-content": { caretColor: config.cursor },

		".cm-cursor, .cm-dropCursor": { borderLeftColor: config.cursor },
		"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
			{ backgroundColor: config.selection },

		".cm-panels": {
			backgroundColor: config.dropdownBackground,
			color: config.foreground,
		},
		".cm-panels.cm-panels-top": { borderBottom: "2px solid #D5C4A1" },
		".cm-panels.cm-panels-bottom": { borderTop: "2px solid #D5C4A1" },

		".cm-searchMatch": {
			backgroundColor: config.dropdownBackground,
			outline: `1px solid ${config.dropdownBorder}`,
		},
		".cm-searchMatch.cm-searchMatch-selected": {
			backgroundColor: config.selection,
		},

		".cm-activeLine": { backgroundColor: config.activeLine },
		".cm-selectionMatch": { backgroundColor: config.selection },

		"&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
			backgroundColor: config.matchingBracket,
			outline: "none",
		},

		".cm-gutters": {
			backgroundColor: config.background,
			color: config.foreground,
			border: "none",
		},
		".cm-activeLineGutter": { backgroundColor: config.background },

		".cm-lineNumbers .cm-gutterElement": { color: config.lineNumber },
		".cm-lineNumbers .cm-activeLineGutter": { color: config.lineNumberActive },

		".cm-foldPlaceholder": {
			backgroundColor: "transparent",
			border: "none",
			color: config.foreground,
		},
		".cm-tooltip": {
			border: `1px solid ${config.dropdownBorder}`,
			backgroundColor: config.dropdownBackground,
			color: config.foreground,
		},
		".cm-tooltip .cm-tooltip-arrow:before": {
			borderTopColor: "transparent",
			borderBottomColor: "transparent",
		},
		".cm-tooltip .cm-tooltip-arrow:after": {
			borderTopColor: config.foreground,
			borderBottomColor: config.foreground,
		},
		".cm-tooltip-autocomplete": {
			"& > ul > li[aria-selected]": {
				background: config.selection,
				color: config.foreground,
			},
		},
	},
	{ dark: config.dark },
);

export const gruvboxLightHighlightStyle = HighlightStyle.define([
	{ tag: t.keyword, color: config.keyword },
	{
		tag: [t.name, t.deleted, t.character, t.macroName],
		color: config.variable,
	},
	{ tag: [t.propertyName], color: config.function },
	{
		tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)],
		color: config.string,
	},
	{ tag: [t.function(t.variableName), t.labelName], color: config.function },
	{
		tag: [t.color, t.constant(t.name), t.standard(t.name)],
		color: config.constant,
	},
	{ tag: [t.definition(t.name), t.separator], color: config.variable },
	{ tag: [t.className], color: config.class },
	{
		tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
		color: config.number,
	},
	{ tag: [t.typeName], color: config.type, fontStyle: config.type },
	{ tag: [t.operator, t.operatorKeyword], color: config.keyword },
	{ tag: [t.url, t.escape, t.regexp, t.link], color: config.regexp },
	{ tag: [t.meta, t.comment], color: config.comment },
	{ tag: t.strong, fontWeight: "bold" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.link, textDecoration: "underline" },
	{ tag: t.heading, fontWeight: "bold", color: config.heading },
	{ tag: [t.atom, t.bool, t.special(t.variableName)], color: config.variable },
	{ tag: t.invalid, color: config.invalid },
	{ tag: t.strikethrough, textDecoration: "line-through" },
]);

export function gruvboxLight() {
	return [gruvboxLightTheme, syntaxHighlighting(gruvboxLightHighlightStyle)];
}

export default gruvboxLight;
