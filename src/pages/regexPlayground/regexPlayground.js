import "./style.scss";
import Page from "components/page";
import actionStack from "lib/actionStack";
import helpers from "utils/helpers";

const FLAG_KEYS = ["g", "i", "m", "s", "u", "y"];
const DEFAULT_FLAGS = {
	g: true,
	i: false,
	m: false,
	s: false,
	u: false,
	y: false,
};

export default function RegexPlayground() {
	const flags = { ...DEFAULT_FLAGS };

	const $page = Page("Regex Playground");

	const $pattern = (
		<input
			type="text"
			className="regex-pattern-input"
			placeholder="Enter a regular expression..."
			spellcheck="false"
		></input>
	);
	const $flags = (
		<div className="regex-flags">
			{FLAG_KEYS.map((flag) => (
				<label className="regex-flag">
					<input type="checkbox" data-flag={flag} checked={flags[flag]}></input>
					{flag}
				</label>
			))}
		</div>
	);
	const $error = <div className="regex-error"></div>;
	const $testInput = (
		<textarea
			className="regex-test-input"
			placeholder="Enter test text..."
			rows="6"
			spellcheck="false"
		></textarea>
	);
	const $highlighted = <div className="regex-highlighted"></div>;
	const $matchCount = <div className="regex-match-count"></div>;
	const $matchList = <div className="regex-match-list"></div>;

	const $content = (
		<div id="regex-playground">
			<div className="regex-row">
				{$pattern}
				{$flags}
			</div>
			{$error}
			<div className="regex-section-label">Test string</div>
			{$testInput}
			<div className="regex-section-label">Highlighted matches</div>
			{$highlighted}
			{$matchCount}
			{$matchList}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("regex-playground");
	};
	actionStack.push({ id: "regex-playground", action: $page.hide });

	const debouncedUpdate = helpers.debounce(update, 200);
	$pattern.addEventListener("input", debouncedUpdate);
	$testInput.addEventListener("input", debouncedUpdate);
	$flags.addEventListener("change", (e) => {
		const checkbox = e.target.closest("[data-flag]");
		if (!checkbox) return;
		flags[checkbox.dataset.flag] = checkbox.checked;
		update();
	});

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	function update() {
		const patternText = $pattern.value;
		const testText = $testInput.value;

		$error.textContent = "";
		$matchList.textContent = "";
		$matchCount.textContent = "";

		if (!patternText) {
			$highlighted.innerHTML = escapeHtml(testText);
			return;
		}

		const flagString = FLAG_KEYS.filter((f) => flags[f]).join("");
		let regex;
		try {
			regex = new RegExp(patternText, flagString);
		} catch (error) {
			$error.textContent = error.message;
			$highlighted.innerHTML = escapeHtml(testText);
			return;
		}

		if (!testText) {
			$highlighted.innerHTML = "";
			return;
		}

		const matches = [];
		let html = "";
		let lastIndex = 0;

		if (flags.g) {
			for (
				let match = regex.exec(testText);
				match;
				match = regex.exec(testText)
			) {
				matches.push(match);
				html += `${escapeHtml(testText.slice(lastIndex, match.index))}<mark>${escapeHtml(match[0])}</mark>`;
				lastIndex = match.index + match[0].length;
				if (match[0].length === 0) regex.lastIndex++; // avoid infinite loop on empty matches
				if (matches.length > 5000) break; // safety cap
			}
		} else {
			const match = regex.exec(testText);
			if (match) {
				matches.push(match);
				html += `${escapeHtml(testText.slice(lastIndex, match.index))}<mark>${escapeHtml(match[0])}</mark>`;
				lastIndex = match.index + match[0].length;
			}
		}
		html += escapeHtml(testText.slice(lastIndex));
		$highlighted.innerHTML = html;

		$matchCount.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
		$matchList.append(
			...matches.map((match, i) => (
				<div className="regex-match-item">
					<div className="regex-match-head">
						#{i + 1} at index {match.index}
					</div>
					<div className="regex-match-full">{match[0] || "(empty match)"}</div>
					{match.length > 1 && (
						<div className="regex-match-groups">
							{Array.from(match)
								.slice(1)
								.map((group, gi) => (
									<div className="regex-match-group">
										Group {gi + 1}: {group ?? "(no match)"}
									</div>
								))}
						</div>
					)}
				</div>
			)),
		);
	}
}
