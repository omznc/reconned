import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "src");
const SOURCE_FILE = /\.(tsx?|jsx?)$/;

type Extractor = {
	extract: (file: string, source: string) => Promise<{ code: string; map?: string }>;
};

async function createExtractor(): Promise<Extractor> {
	const modulePath = require
		.resolve("next-intl/extractor")
		.replace(/extractor\.js$/, "extractor/extractor/MessageExtractor.js");
	const { default: MessageExtractor } = await import(modulePath);
	return new MessageExtractor({
		isDevelopment: process.env.NODE_ENV === "development",
		projectRoot,
		sourceMap: true,
	});
}

/**
 * Rewrites `useExtracted("English text")` and `getExtracted()` calls to `useTranslations()` and
 * `getTranslations()` with the hashed message key. It runs the same SWC plugin that next-intl ran
 * under Next.js, so the keys match `messages/*.json` exactly. `scripts/extract-messages.ts` writes
 * those files.
 */
export function nextIntlExtract(): Plugin {
	let extractor: Extractor | undefined;

	return {
		name: "next-intl-extract",
		enforce: "pre",
		async transform(source, id) {
			const file = id.split("?")[0] ?? id;
			if (!(SOURCE_FILE.test(file) && file.startsWith(sourceRoot))) {
				return null;
			}
			if (!(source.includes("useExtracted") || source.includes("getExtracted"))) {
				return null;
			}
			extractor ??= await createExtractor();
			const result = await extractor.extract(file, source);
			return { code: result.code, map: result.map ?? null };
		},
	};
}
