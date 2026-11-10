"use client";

import { useExtracted } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/alert-dialog-provider";

/** Shares the page link with the share sheet, or copies it. The tab query is dropped. */
export function useShare(title: string) {
	const t = useExtracted();
	return async () => {
		const url = `${window.location.origin}${window.location.pathname}`;
		if (navigator.share) {
			try {
				await navigator.share({ title, url });
			} catch {
				// The person closed the share sheet.
			}
			return;
		}
		await navigator.clipboard.writeText(url);
		toast.success(t("Link copied"));
	};
}

/** Opens an external site in a new tab. An unverified site asks first, as the club page always did. */
export function useOpenExternal(askFirst: boolean) {
	const t = useExtracted();
	const confirm = useConfirm();
	return async (url: string) => {
		if (askFirst) {
			const confirmed = await confirm({
				title: t("You're leaving RECONNED"),
				body: t("You're about to visit an external website. Are you sure you want to continue?"),
				cancelButton: t("Cancel"),
				actionButton: t("Continue"),
			});
			if (!confirmed) {
				return;
			}
		}
		window.open(url, "_blank", "noopener,noreferrer");
	};
}
