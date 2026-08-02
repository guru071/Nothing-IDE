import { snippetCompletion } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionSource } from "@codemirror/autocomplete";
import { language } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";

/** Abbreviation -> snippet template, IntelliJ/Android-Studio "live template" style
 * shorthand (sop, psvm, ...) rather than full IDE-generated boilerplate. `${}` is
 * the final cursor stop, `${name}` a tab-stop the user can type over. */
const SNIPPETS_BY_LANGUAGE: Record<string, Completion[]> = {
	java: [
		snippetCompletion("System.out.println(${});", {
			label: "sop",
			detail: "System.out.println()",
		}),
		snippetCompletion('System.out.printf("${}%n");', {
			label: "sopf",
			detail: "System.out.printf()",
		}),
		snippetCompletion("System.err.println(${});", {
			label: "serr",
			detail: "System.err.println()",
		}),
		snippetCompletion("public static void main(String[] args) {\n\t${}\n}", {
			label: "psvm",
			detail: "main method",
		}),
		snippetCompletion(
			"for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}",
			{ label: "fori", detail: "for loop" },
		),
		snippetCompletion(
			"for (${Type} ${item} : ${collection}) {\n\t${}\n}",
			{ label: "iter", detail: "for-each loop" },
		),
		snippetCompletion(
			"try {\n\t${}\n} catch (${Exception} e) {\n\t${}\n}",
			{ label: "try", detail: "try/catch" },
		),
		snippetCompletion('public static final String ${NAME} = "${value}";', {
			label: "psfs",
			detail: "public static final String",
		}),
	],
	javascript: [
		snippetCompletion("console.log(${});", { label: "cl", detail: "console.log()" }),
		snippetCompletion("console.log(${});", { label: "clg", detail: "console.log()" }),
		snippetCompletion("console.error(${});", { label: "cle", detail: "console.error()" }),
		snippetCompletion("function ${name}(${args}) {\n\t${}\n}", {
			label: "fn",
			detail: "function declaration",
		}),
		snippetCompletion("const ${name} = (${args}) => {\n\t${}\n};", {
			label: "afn",
			detail: "arrow function",
		}),
		snippetCompletion("async function ${name}(${args}) {\n\t${}\n}", {
			label: "asfn",
			detail: "async function",
		}),
		snippetCompletion('import ${module} from "${path}";', {
			label: "imp",
			detail: "import statement",
		}),
		snippetCompletion("export default ${};", {
			label: "exp",
			detail: "export default",
		}),
		snippetCompletion("for (const ${item} of ${iterable}) {\n\t${}\n}", {
			label: "forof",
			detail: "for-of loop",
		}),
		snippetCompletion("${array}.forEach((${item}) => {\n\t${}\n});", {
			label: "foreach",
			detail: "Array.forEach()",
		}),
		snippetCompletion(
			"try {\n\t${}\n} catch (${error}) {\n\t${}\n}",
			{ label: "try", detail: "try/catch" },
		),
		snippetCompletion(
			"new Promise((resolve, reject) => {\n\t${}\n});",
			{ label: "prom", detail: "new Promise()" },
		),
	],
	python: [
		snippetCompletion("print(${})", { label: "pr", detail: "print()" }),
		snippetCompletion("print(${})", { label: "print", detail: "print()" }),
		snippetCompletion("def ${name}(${args}):\n\t${}", {
			label: "def",
			detail: "function definition",
		}),
		snippetCompletion(
			"class ${Name}:\n\tdef __init__(self${args}):\n\t\t${}",
			{ label: "cls", detail: "class definition" },
		),
		snippetCompletion('if __name__ == "__main__":\n\t${}', {
			label: "main",
			detail: "main guard",
		}),
		snippetCompletion("for ${i} in range(${n}):\n\t${}", {
			label: "fori",
			detail: "for-range loop",
		}),
		snippetCompletion("for ${item} in ${iterable}:\n\t${}", {
			label: "forin",
			detail: "for-in loop",
		}),
		snippetCompletion(
			"try:\n\t${}\nexcept ${Exception} as e:\n\t${}",
			{ label: "try", detail: "try/except" },
		),
	],
	cpp: [
		snippetCompletion('printf("${}\\n");', { label: "printf", detail: "printf()" }),
		snippetCompletion("std::cout << ${} << std::endl;", {
			label: "cout",
			detail: "std::cout",
		}),
		snippetCompletion("int main() {\n\t${}\n\treturn 0;\n}", {
			label: "main",
			detail: "main function",
		}),
		snippetCompletion(
			"for (int ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}",
			{ label: "fori", detail: "for loop" },
		),
		snippetCompletion("#include <${header}>", {
			label: "inc",
			detail: "#include",
		}),
	],
	go: [
		snippetCompletion("func ${name}(${args}) ${returnType} {\n\t${}\n}", {
			label: "fn",
			detail: "func declaration",
		}),
		snippetCompletion("func ${name}(${args}) ${returnType} {\n\t${}\n}", {
			label: "func",
			detail: "func declaration",
		}),
		snippetCompletion("func main() {\n\t${}\n}", {
			label: "main",
			detail: "main function",
		}),
		snippetCompletion("if err != nil {\n\treturn err\n}", {
			label: "errif",
			detail: "error check",
		}),
		snippetCompletion(
			"for ${i} := 0; ${i} < ${n}; ${i}++ {\n\t${}\n}",
			{ label: "fori", detail: "for loop" },
		),
		snippetCompletion('fmt.Println(${})', { label: "pr", detail: "fmt.Println()" }),
	],
	rust: [
		snippetCompletion("fn ${name}(${args}) {\n\t${}\n}", {
			label: "fn",
			detail: "fn declaration",
		}),
		snippetCompletion("fn main() {\n\t${}\n}", {
			label: "main",
			detail: "main function",
		}),
		snippetCompletion('println!("${}");', { label: "pr", detail: "println!()" }),
		snippetCompletion("for ${item} in ${iterable} {\n\t${}\n}", {
			label: "forr",
			detail: "for loop",
		}),
	],
	php: [
		snippetCompletion("echo ${};", { label: "echo", detail: "echo statement" }),
		snippetCompletion("function ${name}(${args}) {\n\t${}\n}", {
			label: "fn",
			detail: "function declaration",
		}),
		snippetCompletion("foreach (${array} as ${item}) {\n\t${}\n}", {
			label: "foreach",
			detail: "foreach loop",
		}),
	],
};

/** Standalone completion source, usable directly as an `autocompletion({override: [...]})` entry. */
export const snippetCompletionSource: CompletionSource = (
	context: CompletionContext,
) => {
	const lang = context.state.facet(language)?.name?.toLowerCase();
	if (!lang) return null;
	const snippets = SNIPPETS_BY_LANGUAGE[lang];
	if (!snippets?.length) return null;

	const word = context.matchBefore(/\w+/);
	if (!word) return null;
	if (word.from === word.to && !context.explicit) return null;

	return {
		from: word.from,
		options: snippets,
		validFor: /^\w*$/,
	};
};

/** Registers the snippet source via language data, so it shows up alongside each
 * language's own built-in completions without needing `languageCompletion: false`. */
export default function snippetsExtension(): Extension {
	return EditorState.languageData.of(() => [
		{ autocomplete: snippetCompletionSource },
	]);
}
