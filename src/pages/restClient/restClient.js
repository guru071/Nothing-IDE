import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import helpers from "utils/helpers";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const HISTORY_KEY = "rest_client_history";
const MAX_HISTORY = 20;

export default function RestClient() {
	let headerRows = [{ key: "", value: "" }];

	const $page = Page("REST Client");

	const $method = (
		<select className="rest-method">
			{METHODS.map((method) => (
				<option value={method}>{method}</option>
			))}
		</select>
	);
	const $url = (
		<input
			type="text"
			className="rest-url"
			placeholder="https://api.example.com/..."
			spellcheck="false"
		></input>
	);
	const $sendButton = (
		<button type="button" className="rest-send">
			Send
		</button>
	);
	const $headersList = <div className="rest-headers-list"></div>;
	const $addHeaderButton = (
		<button type="button" className="rest-add-header">
			+ Add header
		</button>
	);
	const $body = (
		<textarea
			className="rest-body-input"
			placeholder="Request body (JSON, text, ...)"
			rows="6"
			spellcheck="false"
		></textarea>
	);
	const $status = <div className="rest-status"></div>;
	const $responseHeaders = <div className="rest-response-headers"></div>;
	const $responseBody = <pre className="rest-response-body"></pre>;
	const $historyList = <div className="rest-history-list"></div>;

	const $content = (
		<div id="rest-client">
			<div className="rest-request-row">
				{$method}
				{$url}
				{$sendButton}
			</div>

			<div className="rest-section-label">Headers</div>
			{$headersList}
			{$addHeaderButton}

			<div className="rest-section-label">Body</div>
			{$body}

			{$status}
			{$responseHeaders}
			{$responseBody}

			<div className="rest-section-label">History</div>
			{$historyList}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("rest-client");
	};
	actionStack.push({ id: "rest-client", action: $page.hide });

	renderHeaderRows();
	renderHistory();

	$addHeaderButton.addEventListener("click", () => {
		headerRows.push({ key: "", value: "" });
		renderHeaderRows();
	});

	$headersList.addEventListener("click", (e) => {
		const $removeButton = e.target.closest("[data-remove-header]");
		if (!$removeButton) return;
		const index = Number.parseInt($removeButton.dataset.removeHeader, 10);
		headerRows.splice(index, 1);
		if (!headerRows.length) headerRows.push({ key: "", value: "" });
		renderHeaderRows();
	});

	$sendButton.addEventListener("click", send);

	$historyList.addEventListener("click", (e) => {
		const $item = e.target.closest("[data-history-index]");
		if (!$item) return;
		const history = loadHistory();
		const entry = history[Number.parseInt($item.dataset.historyIndex, 10)];
		if (!entry) return;
		$method.value = entry.method;
		$url.value = entry.url;
		headerRows = entry.headers?.length
			? entry.headers
			: [{ key: "", value: "" }];
		$body.value = entry.body || "";
		renderHeaderRows();
	});

	function renderHeaderRows() {
		$headersList.textContent = "";
		$headersList.append(
			...headerRows.map((row, index) => (
				<div className="rest-header-row">
					<input
						type="text"
						placeholder="Header"
						value={row.key}
						oninput={(e) => {
							headerRows[index].key = e.target.value;
						}}
					></input>
					<input
						type="text"
						placeholder="Value"
						value={row.value}
						oninput={(e) => {
							headerRows[index].value = e.target.value;
						}}
					></input>
					<button type="button" data-remove-header={index}>
						<span className="icon delete_outline"></span>
					</button>
				</div>
			)),
		);
	}

	function loadHistory() {
		try {
			return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
		} catch {
			return [];
		}
	}

	function saveToHistory(entry) {
		const history = loadHistory();
		history.unshift(entry);
		localStorage.setItem(
			HISTORY_KEY,
			JSON.stringify(history.slice(0, MAX_HISTORY)),
		);
		renderHistory();
	}

	function renderHistory() {
		const history = loadHistory();
		$historyList.textContent = "";
		if (!history.length) {
			$historyList.append(
				<div className="rest-history-empty">No requests yet.</div>,
			);
			return;
		}
		$historyList.append(
			...history.map((entry, index) => (
				<div className="rest-history-item" data-history-index={index}>
					<span className="rest-history-method">{entry.method}</span>
					<span className="rest-history-url">{entry.url}</span>
				</div>
			)),
		);
	}

	async function send() {
		const url = $url.value.trim();
		if (!url) {
			toast("Enter a URL first.");
			return;
		}

		const method = $method.value;
		const headers = {};
		for (const row of headerRows) {
			if (row.key.trim()) headers[row.key.trim()] = row.value;
		}

		const hasBody = !["GET", "HEAD"].includes(method) && $body.value.trim();

		$sendButton.disabled = true;
		$status.textContent = "Sending...";
		$responseHeaders.textContent = "";
		$responseBody.textContent = "";

		const startedAt = performance.now();
		try {
			const response = await fetch(url, {
				method,
				headers,
				body: hasBody ? $body.value : undefined,
			});
			const elapsedMs = Math.round(performance.now() - startedAt);
			const text = await response.text();

			$status.textContent = `${response.status} ${response.statusText} - ${elapsedMs}ms`;
			$status.dataset.ok = String(response.ok);

			const headerLines = [];
			response.headers.forEach((value, key) =>
				headerLines.push(`${key}: ${value}`),
			);
			$responseHeaders.textContent = headerLines.join("\n");

			$responseBody.textContent = prettyPrint(text);

			saveToHistory({
				method,
				url,
				headers: headerRows.filter((h) => h.key.trim()),
				body: $body.value,
			});
		} catch (error) {
			$status.textContent = "Request failed";
			$status.dataset.ok = "false";
			$responseBody.textContent = String(error?.message || error);
		} finally {
			$sendButton.disabled = false;
		}
	}

	function prettyPrint(text) {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}
}
