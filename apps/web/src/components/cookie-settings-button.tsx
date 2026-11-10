"use client";

import { openConsentSettings } from "@/lib/consent";

/**
 * Persistent route back to the consent choice. Lives in the footer so
 * withdrawing is reachable from any page, which is what makes the original
 * consent withdrawable rather than one-way.
 */
export function CookieSettingsButton({ label }: { label: string }) {
	return (
		<button
			type="button"
			onClick={openConsentSettings}
			className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			{label}
		</button>
	);
}
