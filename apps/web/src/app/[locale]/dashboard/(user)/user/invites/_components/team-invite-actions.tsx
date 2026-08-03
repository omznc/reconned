"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { getApiErrorMessage } from "@/lib/api/api-error";

interface TeamInviteActionsProps {
	eventId: string;
	registrationId: string;
	/** A waiting place has already been accepted; the only thing left to do is give it up. */
	isWaitlisted?: boolean;
}

export function TeamInviteActions({ eventId, registrationId, isWaitlisted = false }: TeamInviteActionsProps) {
	const router = useRouter();
	const t = useExtracted();
	const [isLoading, setIsLoading] = useState(false);

	const respond = async (status: "CONFIRMED" | "DECLINED") => {
		setIsLoading(true);
		try {
			const { data, error } = await apiClient.PUT("/api/events/{id}/registrations/{registrationId}/invite", {
				params: { path: { id: eventId, registrationId } },
				body: { status },
			});

			if (error) {
				throw new Error(getApiErrorMessage(error, t("Failed to process invite")));
			}

			if (status === "DECLINED") {
				toast.success(isWaitlisted ? t("You have left the waiting list") : t("Invite dismissed"));
			} else if (data?.status === "WAITLISTED") {
				// Accepting a full event is not a refusal — the place is queued for.
				toast.success(t("This event is full, so you have been added to the waiting list"));
			} else {
				toast.success(t("Invite accepted"));
			}

			router.refresh();
		} catch (error) {
			const message = getApiErrorMessage(error, t("An error occurred while processing the invite"));
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	};

	if (isWaitlisted) {
		return (
			<Button
				onClick={async () => {
					await respond("DECLINED");
				}}
				variant="outline"
				disabled={isLoading}
			>
				{t("Leave the waiting list")}
			</Button>
		);
	}

	return (
		<div className="flex gap-2">
			<Button
				onClick={async () => {
					await respond("CONFIRMED");
				}}
				variant="default"
				disabled={isLoading}
			>
				{t("Accept")}
			</Button>
			<Button
				onClick={async () => {
					await respond("DECLINED");
				}}
				variant="outline"
				disabled={isLoading}
			>
				{t("Dismiss")}
			</Button>
		</div>
	);
}
