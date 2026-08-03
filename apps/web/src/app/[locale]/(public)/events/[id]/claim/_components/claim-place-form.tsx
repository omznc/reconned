"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { getApiErrorMessage } from "@/lib/api/api-error";

interface ClaimPlaceFormProps {
	token: string;
	eventId: string;
}

export function ClaimPlaceForm({ token, eventId }: ClaimPlaceFormProps) {
	const router = useRouter();
	const t = useExtracted();
	const [isLoading, setIsLoading] = useState(false);
	const [claimed, setClaimed] = useState(false);

	// Claiming is a write, so it waits for a deliberate press rather than firing on page load,
	// where a link preview or a prefetch would spend the one-time token for them.
	const claim = async () => {
		setIsLoading(true);
		try {
			const { data, error } = await apiClient.POST("/api/events/attendees/claim", {
				body: { token },
			});

			if (error || !data) {
				throw new Error(getApiErrorMessage(error, t("This invitation is no longer valid")));
			}

			setClaimed(true);
			toast.success(t("The place is now on your account"));
			router.refresh();
		} catch (error) {
			toast.error(getApiErrorMessage(error, t("This invitation is no longer valid")));
		} finally {
			setIsLoading(false);
		}
	};

	if (claimed) {
		return (
			<div className="space-y-3">
				<p className="text-sm">{t("You are on the roster for this event.")}</p>
				<Button asChild>
					<Link href={`/events/${eventId}`}>{t("View the event")}</Link>
				</Button>
			</div>
		);
	}

	return (
		<Button onClick={claim} disabled={isLoading}>
			{t("Claim your place")}
		</Button>
	);
}
