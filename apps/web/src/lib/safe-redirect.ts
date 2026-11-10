const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Returns the value only if it is a same-site relative path. Rejects `//host`, `\`, schemes and control characters. */
export function sanitizeRedirectTo(value: string | null | undefined): string | undefined {
	if (!value?.startsWith("/") || value.startsWith("//")) {
		return undefined;
	}
	// biome-ignore lint/suspicious/noControlCharactersInRegex: browsers strip tab and newline, so "/\t/host" must fail.
	if (value.includes("\\") || SCHEME.test(value) || /[\u0000-\u001f]/.test(value)) {
		return undefined;
	}
	return value;
}

/** Login URL that returns the visitor to the requested page (path and search). */
export function loginHrefFor(location: { pathname: string; searchStr?: string }): string {
	return `/login?redirectTo=${encodeURIComponent(`${location.pathname}${location.searchStr ?? ""}`)}`;
}
