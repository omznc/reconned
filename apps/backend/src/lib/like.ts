/** Escapes LIKE wildcards so user text matches literally. Postgres uses backslash as the default escape. */
export function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, "\\$&");
}
