import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import { loadFileBrowser } from "lib/lazyImports";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm";

const RESULT_DIR_NAME = "db-browser";
const RESULT_FILE = "result.tsv";
const ERROR_FILE = "error.txt";

function shellEscape(str = "") {
	return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

async function ensurePublicResultDir() {
	const publicUrl = await fsOperation(
		cordova.file.dataDirectory,
	).createDirectory("public");
	return fsOperation(publicUrl).createDirectory(RESULT_DIR_NAME);
}

async function runInTerminal(title, script) {
	const { TerminalManager } = await import(
		/* webpackChunkName: "terminal" */ "components/terminal"
	);
	const terminal = await TerminalManager.createTerminal({
		name: title,
		render: true,
	});
	if (!terminal?.component) throw new Error("Failed to open a terminal.");

	await new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (terminal.component.isConnected) resolve();
			else if (Date.now() - start > 5000)
				reject(new Error("Terminal connection timeout"));
			else setTimeout(check, 50);
		};
		check();
	});

	const encoded = window.btoa(unescape(encodeURIComponent(script)));
	terminal.component.write(`echo '${encoded}' | base64 -d | sh\n`);
}

function parseTsv(text) {
	const lines = text.split("\n").filter((line) => line.length > 0);
	return lines.map((line) => line.split("\t"));
}

/**
 * Two independent modes, because there's no way to open a raw TCP socket
 * from WebView JS:
 * - SQLite: fully in-process via sql.js (WASM), genuinely local/offline.
 * - MySQL/Postgres: no in-process client is possible here, so this builds
 *   and runs the actual `mysql`/`psql` CLI command in the terminal sandbox
 *   (which has a real network stack) and reads the result back from the
 *   shared /public folder - same bind-mount bridge already used by
 *   lib/hardwareBridge.js.
 */
export default function DatabaseBrowser() {
	const $page = Page("Database Browser");
	let mode = "sqlite";

	const $modeButtons = (
		<div className="db-mode-tabs">
			<button type="button" className="db-mode-tab active" data-mode="sqlite">
				SQLite
			</button>
			<button type="button" className="db-mode-tab" data-mode="server">
				MySQL / Postgres
			</button>
		</div>
	);
	const $body = <div className="db-body"></div>;

	const $content = (
		<div id="database-browser">
			{$modeButtons}
			{$body}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("database-browser");
	};
	actionStack.push({ id: "database-browser", action: $page.hide });

	$modeButtons.addEventListener("click", (e) => {
		const $button = e.target.closest("[data-mode]");
		if (!$button) return;
		mode = $button.dataset.mode;
		for (const btn of $modeButtons.querySelectorAll("[data-mode]")) {
			btn.classList.toggle("active", btn === $button);
		}
		renderMode();
	});

	renderMode();

	function renderMode() {
		$body.textContent = "";
		if (mode === "sqlite") $body.append(renderSqliteMode());
		else $body.append(renderServerMode());
	}
}

function renderSqliteMode() {
	let db = null;
	let dbUrl = null;

	const $meta = <div className="db-meta">No database open.</div>;
	const $chooseButton = (
		<button type="button" className="action-button" data-action="choose">
			Open .db / .sqlite File
		</button>
	);
	const $tablesList = <div className="db-tables"></div>;
	const $query = (
		<textarea
			className="db-query-input"
			placeholder="SELECT * FROM ..."
			rows="3"
			spellcheck="false"
		></textarea>
	);
	const $runButton = (
		<button type="button" className="action-button" data-action="run" disabled>
			Run Query
		</button>
	);
	const $saveButton = (
		<button
			type="button"
			className="action-button secondary"
			data-action="save"
			disabled
		>
			Save Changes to File
		</button>
	);
	const $results = <div className="db-results"></div>;

	const $container = (
		<div className="db-sqlite">
			{$chooseButton}
			{$meta}
			{$tablesList}
			{$query}
			<div className="db-query-actions">
				{$runButton}
				{$saveButton}
			</div>
			{$results}
		</div>
	);

	$chooseButton.addEventListener("click", chooseFile);
	$runButton.addEventListener("click", () => runQuery($query.value));
	$saveButton.addEventListener("click", saveChanges);
	$tablesList.addEventListener("click", (e) => {
		const $item = e.target.closest("[data-table]");
		if (!$item) return;
		const table = $item.dataset.table;
		$query.value = `SELECT * FROM "${table}" LIMIT 100;`;
		runQuery($query.value);
	});

	return $container;

	async function chooseFile() {
		try {
			const FileBrowser = await loadFileBrowser();
			const res = await FileBrowser("file", "Select a SQLite database file");
			if (!res?.url) return;
			await openDatabase(res.url, res.name || res.url);
		} catch (error) {
			// user cancelled
		}
	}

	async function openDatabase(url, name) {
		$meta.textContent = "Loading...";
		try {
			const { default: initSqlJs } = await import(
				/* webpackChunkName: "sqljs" */ "sql.js"
			);
			const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });

			const data = await fsOperation(url).readFile();
			db = new SQL.Database(new Uint8Array(data));
			dbUrl = url;

			$meta.textContent = name;
			$runButton.disabled = false;
			$saveButton.disabled = false;
			listTables();
		} catch (error) {
			toast(`Couldn't open database: ${error?.message || error}`);
			$meta.textContent = "No database open.";
		}
	}

	function listTables() {
		const result = db.exec(
			"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
		);
		const tables = result[0]?.values.map((row) => row[0]) || [];

		$tablesList.textContent = "";
		if (!tables.length) {
			$tablesList.append(<div className="db-empty">No tables.</div>);
			return;
		}
		$tablesList.append(
			...tables.map((table) => (
				<button type="button" className="db-table-chip" data-table={table}>
					{table}
				</button>
			)),
		);
	}

	function runQuery(sql) {
		if (!db || !sql.trim()) return;
		$results.textContent = "";
		try {
			const result = db.exec(sql);
			if (!result.length) {
				$results.append(
					<div className="db-empty">
						Query ran successfully (no rows returned).
					</div>,
				);
				return;
			}
			$results.append(renderResultTable(result[0]));
		} catch (error) {
			$results.append(<div className="db-error">{error.message}</div>);
		}
	}

	async function saveChanges() {
		if (!db || !dbUrl) return;
		try {
			const bytes = db.export();
			await fsOperation(dbUrl).writeFile(bytes.buffer);
			toast("Saved.");
		} catch (error) {
			toast(`Couldn't save: ${error?.message || error}`);
		}
	}
}

function renderServerMode() {
	const $engine = (
		<select className="db-engine">
			<option value="mysql">MySQL</option>
			<option value="postgres">PostgreSQL</option>
		</select>
	);
	const $host = (
		<input type="text" placeholder="Host" value="127.0.0.1"></input>
	);
	const $port = <input type="text" placeholder="Port"></input>;
	const $user = <input type="text" placeholder="User"></input>;
	const $password = <input type="password" placeholder="Password"></input>;
	const $database = <input type="text" placeholder="Database"></input>;
	const $query = (
		<textarea
			className="db-query-input"
			placeholder="SELECT * FROM ... LIMIT 100;"
			rows="3"
			spellcheck="false"
		></textarea>
	);
	const $installButton = (
		<button
			type="button"
			className="action-button secondary"
			data-action="install"
		>
			Install Client
		</button>
	);
	const $runButton = (
		<button type="button" className="action-button" data-action="run">
			Run in Terminal
		</button>
	);
	const $loadButton = (
		<button
			type="button"
			className="action-button secondary"
			data-action="load"
		>
			Load Result
		</button>
	);
	const $results = <div className="db-results"></div>;

	const $container = (
		<div className="db-server">
			<p className="db-intro">
				There's no way to open a raw database socket from here directly, so this
				runs the real <code>mysql</code>/<code>psql</code> command line client
				in the terminal sandbox (which has real network access) and reads the
				result back. Requires the Terminal feature and its client package
				installed once.
			</p>
			<div className="db-field-row">{$engine}</div>
			<div className="db-field-row">
				{$host}
				{$port}
			</div>
			<div className="db-field-row">
				{$user}
				{$password}
			</div>
			<div className="db-field-row">{$database}</div>
			{$query}
			<div className="db-query-actions">
				{$installButton}
				{$runButton}
				{$loadButton}
			</div>
			{$results}
		</div>
	);

	$installButton.addEventListener("click", installClient);
	$runButton.addEventListener("click", runRemoteQuery);
	$loadButton.addEventListener("click", loadResult);

	return $container;

	function defaultPort() {
		return $engine.value === "mysql" ? "3306" : "5432";
	}

	async function installClient() {
		const pkg =
			$engine.value === "mysql" ? "mysql-client" : "postgresql-client";
		try {
			await runInTerminal(`Install ${pkg}`, `apk add --no-cache ${pkg}\n`);
		} catch (error) {
			toast(`Couldn't open terminal: ${error?.message || error}`);
		}
	}

	async function runRemoteQuery() {
		const sql = $query.value.trim();
		if (!sql) {
			toast("Enter a query first.");
			return;
		}

		const host = $host.value.trim() || "127.0.0.1";
		const port = $port.value.trim() || defaultPort();
		const user = $user.value.trim();
		const password = $password.value;
		const database = $database.value.trim();

		try {
			const dirUrl = await ensurePublicResultDir();
			const resultPath = `/public/${RESULT_DIR_NAME}/${RESULT_FILE}`;
			const errorPath = `/public/${RESULT_DIR_NAME}/${ERROR_FILE}`;

			let script;
			if ($engine.value === "mysql") {
				script = [
					`export MYSQL_PWD=${shellEscape(password)}`,
					`mysql -h ${shellEscape(host)} -P ${shellEscape(port)} -u ${shellEscape(user)} ${shellEscape(database)} --batch --raw -e ${shellEscape(sql)} > ${resultPath} 2> ${errorPath}`,
				].join("\n");
			} else {
				script = [
					`export PGPASSWORD=${shellEscape(password)}`,
					`psql -h ${shellEscape(host)} -p ${shellEscape(port)} -U ${shellEscape(user)} -d ${shellEscape(database)} -A -F $'\\t' -c ${shellEscape(sql)} > ${resultPath} 2> ${errorPath}`,
				].join("\n");
			}

			await runInTerminal(`${$engine.value} query`, script);
			toast("Running in the terminal tab - tap Load Result once it finishes.");
			void dirUrl; // dir just needs to exist before the terminal writes into it
		} catch (error) {
			toast(`Couldn't run query: ${error?.message || error}`);
		}
	}

	async function loadResult() {
		try {
			const resultUrl = `${cordova.file.dataDirectory}public/${RESULT_DIR_NAME}/${RESULT_FILE}`;
			const errorUrl = `${cordova.file.dataDirectory}public/${RESULT_DIR_NAME}/${ERROR_FILE}`;

			const errorExists = await fsOperation(errorUrl)
				.exists()
				.catch(() => false);
			if (errorExists) {
				const errorText = await fsOperation(errorUrl).readFile("utf8");
				if (errorText.trim()) {
					$results.textContent = "";
					$results.append(<div className="db-error">{errorText.trim()}</div>);
					return;
				}
			}

			const exists = await fsOperation(resultUrl)
				.exists()
				.catch(() => false);
			if (!exists) {
				toast("No result yet - run a query first.");
				return;
			}

			const text = await fsOperation(resultUrl).readFile("utf8");
			const rows = parseTsv(text);
			$results.textContent = "";
			if (!rows.length) {
				$results.append(<div className="db-empty">No rows.</div>);
				return;
			}
			$results.append(
				renderResultTable({ columns: rows[0], values: rows.slice(1) }),
			);
		} catch (error) {
			toast(`Couldn't load result: ${error?.message || error}`);
		}
	}
}

function formatCell(cell) {
	if (cell === null || cell === undefined) return "NULL";
	// sql.js returns BLOB columns as a Uint8Array - showing that via String()
	// would dump a garbled comma-separated byte list, so show a short hex
	// preview and the real size instead.
	if (cell instanceof Uint8Array) {
		const previewBytes = Array.from(cell.subarray(0, 16))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join(" ");
		const suffix = cell.length > 16 ? "..." : "";
		return `<BLOB ${cell.length} bytes: ${previewBytes}${suffix}>`;
	}
	return String(cell);
}

function renderResultTable({ columns, values }) {
	return (
		<div className="db-table-wrap">
			<table className="db-result-table">
				<thead>
					<tr>
						{columns.map((col) => (
							<th>{col}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{values.map((row) => (
						<tr>
							{row.map((cell) => (
								<td
									className={cell instanceof Uint8Array ? "db-cell-blob" : ""}
								>
									{formatCell(cell)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<div className="db-row-count">{values.length} rows</div>
		</div>
	);
}
