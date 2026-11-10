import { unstable_extractMessages as extractMessages } from "next-intl/extractor";

await extractMessages({
	srcPath: "./src",
	extract: true,
	messages: {
		sourceLocale: "en",
		path: "./messages",
		format: "json",
		locales: "infer",
	},
});
