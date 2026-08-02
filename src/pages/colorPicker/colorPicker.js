import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";

export default function ColorPicker() {
	let hex = "#2196f3";

	const $page = Page("Color Picker");

	const $swatch = (
		<input type="color" className="color-swatch" value={hex}></input>
	);
	const $hexInput = (
		<input type="text" className="color-field-input" value={hex}></input>
	);
	const $rgbInput = <input type="text" className="color-field-input"></input>;
	const $hslInput = <input type="text" className="color-field-input"></input>;

	const $content = (
		<div id="color-picker">
			<div className="color-swatch-row">{$swatch}</div>

			<div className="color-field">
				<span className="color-field-label">HEX</span>
				{$hexInput}
				<button type="button" data-copy="hex">
					<span className="icon copy"></span>
				</button>
			</div>
			<div className="color-field">
				<span className="color-field-label">RGB</span>
				{$rgbInput}
				<button type="button" data-copy="rgb">
					<span className="icon copy"></span>
				</button>
			</div>
			<div className="color-field">
				<span className="color-field-label">HSL</span>
				{$hslInput}
				<button type="button" data-copy="hsl">
					<span className="icon copy"></span>
				</button>
			</div>

			<button type="button" className="action-button" data-action="insert">
				Insert HEX at cursor
			</button>
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("color-picker");
	};
	actionStack.push({ id: "color-picker", action: $page.hide });

	$swatch.addEventListener("input", () => setColor($swatch.value, "swatch"));
	$hexInput.addEventListener("change", () => {
		const value = normalizeHex($hexInput.value);
		if (value) setColor(value, "hex");
		else toast("Invalid hex color");
	});
	$rgbInput.addEventListener("change", () => {
		const rgb = parseRgbString($rgbInput.value);
		if (rgb) setColor(rgbToHex(rgb), "rgb");
		else toast("Expected format: rgb(r, g, b)");
	});
	$hslInput.addEventListener("change", () => {
		const hsl = parseHslString($hslInput.value);
		if (hsl) setColor(hslToHex(hsl), "hsl");
		else toast("Expected format: hsl(h, s%, l%)");
	});
	$content.addEventListener("click", (e) => {
		const $copyButton = e.target.closest("[data-copy]");
		if ($copyButton) {
			const source = { hex: $hexInput, rgb: $rgbInput, hsl: $hslInput }[
				$copyButton.dataset.copy
			];
			navigator.clipboard?.writeText(source.value).then(() => toast("Copied"));
			return;
		}

		if (e.target.closest("[data-action='insert']")) {
			const { editor, activeFile } = editorManager;
			if (activeFile?.type !== "editor" || !editor) {
				toast("Open a file first.");
				return;
			}
			editor.dispatch(editor.state.replaceSelection(hex));
			editor.focus();
		}
	});

	setColor(hex, "init");

	function setColor(newHex, source) {
		hex = newHex;
		const rgb = hexToRgb(hex);
		const hsl = rgbToHsl(rgb);

		if (source !== "swatch") $swatch.value = hex;
		if (source !== "hex") $hexInput.value = hex;
		if (source !== "rgb") {
			$rgbInput.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
		}
		if (source !== "hsl") {
			$hslInput.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
		}
	}
}

function normalizeHex(value) {
	const match = String(value)
		.trim()
		.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
	if (!match) return null;
	let hex = match[1];
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}
	return `#${hex.toLowerCase()}`;
}

function hexToRgb(hex) {
	const value = hex.replace("#", "");
	return {
		r: Number.parseInt(value.slice(0, 2), 16),
		g: Number.parseInt(value.slice(2, 4), 16),
		b: Number.parseInt(value.slice(4, 6), 16),
	};
}

function rgbToHex({ r, g, b }) {
	const toHex = (n) =>
		Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseRgbString(value) {
	const match = String(value)
		.trim()
		.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (!match) return null;
	return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function rgbToHsl({ r, g, b }) {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case rn:
				h = (gn - bn) / d + (gn < bn ? 6 : 0);
				break;
			case gn:
				h = (bn - rn) / d + 2;
				break;
			default:
				h = (rn - gn) / d + 4;
		}
		h /= 6;
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	};
}

function hslToRgb({ h, s, l }) {
	const sn = s / 100;
	const ln = l / 100;
	const k = (n) => (n + h / 30) % 12;
	const a = sn * Math.min(ln, 1 - ln);
	const f = (n) =>
		ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return {
		r: Math.round(f(0) * 255),
		g: Math.round(f(8) * 255),
		b: Math.round(f(4) * 255),
	};
}

function hslToHex(hsl) {
	return rgbToHex(hslToRgb(hsl));
}

function parseHslString(value) {
	const match = String(value)
		.trim()
		.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/i);
	if (!match) return null;
	return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}
