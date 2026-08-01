import settingsPage from "components/settingsPage";

export default function help() {
	const title = strings.help;
	const items = [];

	const page = settingsPage(title, items, () => {}, "separate", {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		groupByDefault: true,
	});
	page.show();
}
