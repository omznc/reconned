"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Card } from "@/components/ui/card";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface UnsavedChangesProviderProps {
	children: React.ReactNode;
}

interface UnsavedChangesContextType {
	hasUnsavedChanges: boolean;
	setHasUnsavedChanges: (value: boolean) => void;
}

const UnsavedChangesContext = React.createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: UnsavedChangesProviderProps) {
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const router = useRouter();
	const pathname = usePathname();
	const t = useTranslations("components.unsavedChanges");
	const confirm = useConfirm();
	const ignoreNextPopRef = useRef(false);

	useEffect(() => {
		setHasUnsavedChanges(false);
	}, [pathname]);

	const showConfirm = useCallback(async () => {
		const result = await confirm({
			title: t("confirm.title"),
			body: t("confirm.body"),
			cancelButton: t("confirm.stay"),
			actionButton: t("confirm.leave"),
			actionButtonVariant: "destructive",
		});
		return Boolean(result);
	}, [confirm, t]);

	useEffect(() => {
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges) {
				e.preventDefault();
				e.returnValue = t("unloadPrompt");
			}
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [hasUnsavedChanges, t]);

	useEffect(() => {
		const onPopState = () => {
			if (ignoreNextPopRef.current) {
				ignoreNextPopRef.current = false;
				return;
			}
			if (!hasUnsavedChanges) {
				return;
			}
			window.history.pushState(null, "", window.location.href);
			void (async () => {
				const ok = await showConfirm();
				if (ok) {
					setHasUnsavedChanges(false);
					ignoreNextPopRef.current = true;
					window.history.back();
				}
			})();
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, [hasUnsavedChanges, showConfirm]);

	useEffect(() => {
		const onDocumentClick = (event: MouseEvent) => {
			if (!hasUnsavedChanges) {
				return;
			}
			if (event.defaultPrevented) {
				return;
			}
			if (event.button !== 0) {
				return;
			}
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			let el = event.target as HTMLElement | null;
			while (el && el.tagName !== "A") {
				el = el.parentElement;
			}
			if (!el) {
				return;
			}
			const anchor = el as HTMLAnchorElement;
			if (!anchor.href) {
				return;
			}
			if (anchor.target && anchor.target !== "" && anchor.target !== "_self") {
				return;
			}
			const href = anchor.href;
			const nextUrl = new URL(href);
			const currentUrl = new URL(window.location.href);
			const isSameOrigin = nextUrl.origin === currentUrl.origin;
			const isSameDocHashChange =
				isSameOrigin &&
				nextUrl.pathname === currentUrl.pathname &&
				nextUrl.search === currentUrl.search &&
				nextUrl.hash !== currentUrl.hash;
			if (isSameDocHashChange) {
				return;
			}
			event.preventDefault();
			void (async () => {
				const ok = await showConfirm();
				if (ok) {
					setHasUnsavedChanges(false);
					if (isSameOrigin) {
						// Strip the locale prefix from pathname since i18n router will add it back
						const pathWithoutLocale = nextUrl.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
						router.push(`${pathWithoutLocale}${nextUrl.search}${nextUrl.hash}`);
					} else {
						window.location.href = href;
					}
				}
			})();
		};
		document.addEventListener("click", onDocumentClick, true);
		return () => document.removeEventListener("click", onDocumentClick, true);
	}, [hasUnsavedChanges, router, showConfirm]);

	const contextValue = {
		hasUnsavedChanges,
		setHasUnsavedChanges,
	};

	return (
		<UnsavedChangesContext.Provider value={contextValue}>
			{children}
			<UnsavedChangesIndicator />
		</UnsavedChangesContext.Provider>
	);
}

export function useUnsavedChanges() {
	const context = React.useContext(UnsavedChangesContext);
	if (!context) {
		throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
	}
	return context;
}

function UnsavedChangesIndicator() {
	const { hasUnsavedChanges } = useUnsavedChanges();
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
	const t = useTranslations("components.unsavedChanges");

	useEffect(() => {
		const handleScroll = () => {
			// Find the scrollable container (SidebarInset with overflow-auto)
			const scrollContainer =
				document.querySelector('[data-sidebar="inset"]') ||
				document.querySelector(".max-h-dvh.overflow-auto") ||
				document.querySelector(".overflow-auto") ||
				document.documentElement;

			const scrollTop = scrollContainer.scrollTop || window.scrollY || window.pageYOffset;
			const containerHeight = scrollContainer.clientHeight || window.innerHeight;
			const scrollHeight =
				scrollContainer.scrollHeight ||
				Math.max(
					document.body.scrollHeight,
					document.body.offsetHeight,
					document.documentElement.clientHeight,
					document.documentElement.scrollHeight,
					document.documentElement.offsetHeight,
				);

			const distanceFromBottom = scrollHeight - (scrollTop + containerHeight);
			// Consider "at bottom" if within 100px of bottom
			const isNearBottom = distanceFromBottom <= 100;
			setIsScrolledToBottom(isNearBottom);
		};

		handleScroll();
		let ticking = false;
		const throttledHandleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
				ticking = true;
			}
		};

		// Listen to scroll on both window and potential scroll containers
		const scrollContainer =
			document.querySelector('[data-sidebar="inset"]') ||
			document.querySelector(".max-h-dvh.overflow-auto") ||
			document.querySelector(".overflow-auto");

		window.addEventListener("scroll", throttledHandleScroll);
		window.addEventListener("resize", handleScroll);
		if (scrollContainer) {
			scrollContainer.addEventListener("scroll", throttledHandleScroll);
		}

		return () => {
			window.removeEventListener("scroll", throttledHandleScroll);
			window.removeEventListener("resize", handleScroll);
			if (scrollContainer) {
				scrollContainer.removeEventListener("scroll", throttledHandleScroll);
			}
		};
	}, []);

	if (!hasUnsavedChanges) {
		return null;
	}

	return (
		<div
			className={cn(
				"fixed left-0 right-0 mx-2 sm:left-1/2 sm:right-auto sm:mx-0 sm:-translate-x-1/2 sm:transform z-50 transition-all duration-300 ease-in-out",
				isScrolledToBottom ? "top-4" : "bottom-4",
			)}
		>
			<Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900 dark:border-yellow-700 shadow-lg backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
				<div className="flex items-center gap-3 px-4 py-3">
					<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
					<div className="flex-1">
						<p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{t("banner.title")}</p>
						<p className="text-xs text-yellow-600 dark:text-yellow-400">{t("banner.subtitle")}</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
