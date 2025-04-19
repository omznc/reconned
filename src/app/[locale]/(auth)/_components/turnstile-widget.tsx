"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { env } from "@/lib/env";

export interface TurnstileWidgetRef {
	reset: () => void;
}

interface TurnstileWidgetProps {
	onVerify: (token: string) => void;
	sitekey?: string;
}

// Track script loading state globally across component instances
let isTurnstileScriptLoaded = false;

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(function TurnstileWidget(
	{ onVerify, sitekey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY },
	ref,
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isScriptReady, setIsScriptReady] = useState(isTurnstileScriptLoaded);
	const widgetId = useRef<string | null>(null);
	const pathname = usePathname();

	// Create a unique ID for this instance
	const instanceId = useRef(`turnstile-${Math.random().toString(36).substring(2, 9)}`);

	// Function to render the widget
	const renderWidget = () => {
		if (!(containerRef.current && window.turnstile)) {
			return;
		}

		// Remove existing widget if it exists
		if (widgetId.current) {
			try {
				window.turnstile.remove(widgetId.current);
			} catch (e) {
				console.error("Error removing existing widget:", e);
			}
			widgetId.current = null;
		}

		// Clear the container before rendering
		if (containerRef.current.firstChild) {
			containerRef.current.innerHTML = "";
		}

		try {
			widgetId.current = window.turnstile.render(containerRef.current, {
				sitekey: sitekey,
				callback: (token: string) => {
					if (token && token.length > 0) {
						setTimeout(() => {
							onVerify(token);
						}, 0);
					}
				},
				size: "normal",
				appearance: "always",
				execution: "render",
			});
		} catch (error) {
			console.error("Error rendering turnstile widget:", error);
		}
	};

	// Reset function for the widget
	const resetWidget = () => {
		if (window.turnstile && widgetId.current) {
			try {
				// Reset the widget UI but don't clear token
				// The callback will be triggered again when verification completes
				window.turnstile.reset(widgetId.current);
			} catch (_error) {
				// If reset fails, try to re-render the widget completely
				setTimeout(() => {
					renderWidget();
				}, 100);
			}
		}
	};

	// Expose the reset function to parent components
	useImperativeHandle(ref, () => ({
		reset: resetWidget,
	}));

	// Handle script loading
	useEffect(() => {
		if (isTurnstileScriptLoaded && window.turnstile) {
			setIsScriptReady(true);
		}
	}, []);

	// Initialize widget when script is loaded and container is available
	useEffect(() => {
		if (!(isScriptReady && containerRef.current)) {
			return;
		}

		// Small timeout to ensure DOM is fully ready
		const timer = setTimeout(() => {
			renderWidget();
		}, 50);

		return () => {
			clearTimeout(timer);
			if (widgetId.current && window.turnstile) {
				window.turnstile.remove(widgetId.current);
				widgetId.current = null;
			}
		};
	}, [isScriptReady, sitekey, pathname]);

	// Do NOT clear the token on pathname changes, only handle cleanup
	useEffect(() => {
		return () => {
			// Only when component unmounts, clean up widget but don't clear token
			if (widgetId.current && window.turnstile) {
				window.turnstile.remove(widgetId.current);
				widgetId.current = null;
			}
		};
	}, [pathname]);

	return (
		<>
			<Script
				src="https://challenges.cloudflare.com/turnstile/v0/api.js"
				async
				defer
				onLoad={() => {
					isTurnstileScriptLoaded = true;
					setIsScriptReady(true);
				}}
				strategy="afterInteractive"
			/>
			<div
				suppressHydrationWarning
				ref={containerRef}
				id={instanceId.current}
				className="mt-2 mb-2 w-full h-auto flex justify-center"
				key={`turnstile-container-${pathname}`}
			/>
		</>
	);
});

// Update TypeScript global declaration
declare global {
	interface Window {
		turnstile: {
			render: (
				container: HTMLElement,
				options: {
					sitekey: string;
					callback: (token: string) => void;
					"error-callback"?: () => void;
					size?: string;
					appearance?: string;
					execution?: string;
				},
			) => string;
			remove: (widgetId: string) => void;
			reset: (widgetId: string) => void;
		};
	}
}
