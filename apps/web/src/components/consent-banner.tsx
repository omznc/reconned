"use client";

import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CONSENT_OPEN_EVENT, readConsent, setConsent } from "@/lib/consent";

/**
 * Analytics consent banner.
 *
 * Accept and Reject are the same element at the same size, and rejecting is one
 * click — no "manage preferences" detour on the way to no. The banner is also
 * reopenable from the footer, because withdrawing consent has to be as easy as
 * giving it was.
 */
export function ConsentBanner() {
	const t = useExtracted();
	const [open, setOpen] = useState(false);
	const [current, setCurrent] = useState<boolean | null>(null);
	// Only set when the footer reopened the banner: moving focus on first paint
	// would yank it away from someone already reading the page, but a person who
	// pressed "Cookie settings" is asking to be taken here.
	const reopenedRef = useRef(false);
	const firstButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const stored = readConsent();
		setCurrent(stored?.analytics ?? null);

		// No stored decision — including one recorded against an older policy
		// version — means we have to ask.
		if (!stored) {
			setOpen(true);
		}

		const onOpen = () => {
			setCurrent(readConsent()?.analytics ?? null);
			reopenedRef.current = true;
			setOpen(true);
		};

		window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
		return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
	}, []);

	useEffect(() => {
		if (open && reopenedRef.current) {
			firstButtonRef.current?.focus();
		}
	}, [open]);

	// Escape dismisses without recording anything. Closing is not a decision, so
	// the stored record is left exactly as it was — which for a first visit means
	// no consent, and nothing is collected either way.
	useEffect(() => {
		if (!open) {
			return;
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open]);

	if (!open) {
		return null;
	}

	function decide(analytics: boolean) {
		setConsent(analytics);
		setCurrent(analytics);
		setOpen(false);
	}

	return (
		<div
			role="dialog"
			aria-label={t("Analytics consent")}
			className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4 shadow-lg sm:p-6"
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm text-muted-foreground">
					{t(
						"We’d like to use analytics to help improve the platform experience. This is completely optional and won’t affect how the site works.",
					)}{" "}
					<Link href="/privacy-policy" className="underline underline-offset-4">
						{t("Privacy Policy")}
					</Link>
				</p>
				<div className="flex shrink-0 gap-2">
					<Button ref={firstButtonRef} type="button" variant="outline" onClick={() => decide(false)}>
						{current === false ? t("Keep analytics off") : t("Reject")}
					</Button>
					<Button type="button" variant="outline" onClick={() => decide(true)}>
						{current === true ? t("Keep analytics on") : t("Accept")}
					</Button>
				</div>
			</div>
		</div>
	);
}
