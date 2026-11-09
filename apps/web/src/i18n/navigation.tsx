import { redirect as routerRedirect, useLocation, useRouter as useTanstackRouter } from "@tanstack/react-router";
import { type AnchorHTMLAttributes, type MouseEvent, type Ref, useMemo } from "react";
import { useLocale } from "use-intl";
import { isLocale } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

type Query = Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>;
type Href = string | { pathname: string; query?: Query };
type LocaleOption = { locale?: string };

const ABSOLUTE_HREF = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

function stringifyHref(href: Href): string {
	if (typeof href === "string") {
		return href;
	}
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(href.query ?? {})) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== null && item !== undefined) {
				params.append(key, String(item));
			}
		}
	}
	const search = params.toString();
	return search ? `${href.pathname}?${search}` : href.pathname;
}

function stripLocale(pathname: string): string {
	const first = pathname.split("/")[1];
	if (!isLocale(first)) {
		return pathname;
	}
	return pathname.slice(first.length + 1) || "/";
}

/** Prefixes a path with the locale, except for the default locale (`localePrefix: "as-needed"`). */
export function getPathname({ href, locale }: { href: Href; locale: string }): string {
	const value = stringifyHref(href);
	if (ABSOLUTE_HREF.test(value) || value.startsWith("?") || locale === routing.defaultLocale) {
		return value;
	}
	const [path = "", ...rest] = value.split(/(?=[?#])/);
	const suffix = rest.join("");
	return `/${locale}${path === "/" ? "" : path}${suffix}`;
}

/** Returns the path without the locale prefix, like next-intl's `usePathname`. */
export function usePathname(): string {
	return stripLocale(useLocation().pathname);
}

/**
 * Same contract as Next.js `redirect`, except it must be thrown: `throw redirect({ href, locale })`.
 * Use it in `beforeLoad`, loaders and server functions.
 */
export function redirect(options: { href: Href; locale: string }) {
	return routerRedirect({ href: getPathname(options) });
}

export function useRouter() {
	const router = useTanstackRouter();
	const currentLocale = useLocale();

	return useMemo(() => {
		const go = (href: Href, options: LocaleOption | undefined, replace: boolean) => {
			const target = getPathname({ href, locale: options?.locale ?? currentLocale });
			if (replace) {
				router.history.replace(target);
			} else {
				router.history.push(target);
			}
		};
		return {
			push: (href: Href, options?: LocaleOption) => go(href, options, false),
			replace: (href: Href, options?: LocaleOption) => go(href, options, true),
			back: () => router.history.back(),
			forward: () => router.history.forward(),
			refresh: () => router.invalidate(),
			// shortcut: no route preloading, Next.js prefetch is not replicated
			prefetch: (_href: Href, _options?: LocaleOption) => undefined,
		};
	}, [router, currentLocale]);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
	href: Href;
	locale?: string;
	replace?: boolean;
	prefetch?: boolean;
	ref?: Ref<HTMLAnchorElement>;
};

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
	return !(
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	);
}

export function Link({ href, locale, replace, prefetch: _prefetch, onClick, target, ...props }: LinkProps) {
	const router = useTanstackRouter();
	const currentLocale = useLocale();
	const resolved = getPathname({ href, locale: locale ?? currentLocale });
	const isInternal = !ABSOLUTE_HREF.test(resolved) && (target === undefined || target === "_self");

	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (isInternal && isPlainLeftClick(event)) {
			event.preventDefault();
			if (replace) {
				router.history.replace(resolved);
			} else {
				router.history.push(resolved);
			}
		}
	};

	return <a {...props} href={resolved} target={target} onClick={handleClick} />;
}
