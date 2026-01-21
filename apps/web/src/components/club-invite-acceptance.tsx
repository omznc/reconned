"use client";

import { CheckCircle, Mail, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { EventInvite } from "@/lib/api/api-type-helpers";

interface ClubInviteAcceptanceProps {
	invites?: EventInvite[];
}

export function ClubInviteAcceptance({ invites }: ClubInviteAcceptanceProps) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const t = useExtracted();
	const [isLoading, setIsLoading] = useState(false);

	const inviteCode = searchParams.get("invite");

	// Show if there's a URL invite parameter OR if there are pending invites passed as props
	if (!inviteCode && (!invites || invites.length === 0)) {
		return null;
	}

	const handleAccept = async (code: string) => {
		setIsLoading(true);
		try {
			const { error } = await apiClient.POST("/api/club/member-invite/{inviteCode}", {
				params: {
					path: { inviteCode: code },
					query: { action: "approve" },
				},
			});

			if (error) {
				toast.error(t("Failed to accept invite"));
				return;
			}

			toast.success(t("Invite accepted successfully"));
			router.refresh();
		} catch (error) {
			console.error("Error accepting invite:", error);
			toast.error(t("An error occurred"));
		} finally {
			setIsLoading(false);
		}
	};

	const handleDismiss = async (code: string) => {
		setIsLoading(true);
		try {
			const { error } = await apiClient.POST("/api/club/member-invite/{inviteCode}", {
				params: {
					path: { inviteCode: code },
					query: { action: "dismiss" },
				},
			});

			if (error) {
				toast.error(t("Failed to dismiss invite"));
				return;
			}

			toast.success(t("Invite dismissed"));
			router.refresh();
		} catch (error) {
			console.error("Error dismissing invite:", error);
			toast.error(t("An error occurred"));
		} finally {
			setIsLoading(false);
		}
	};

	// Combine URL invite with prop invites
	const allInvites = invites ? [...invites] : [];
	if (inviteCode) {
		// Add URL invite if not already in the list
		const urlInviteExists = allInvites.some((invite) => invite.inviteCode === inviteCode);
		if (!urlInviteExists) {
			// For URL invites, we don't have full invite data, so we'll handle it separately
		}
	}

	return (
		<Card className="mb-6">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Mail className="size-5" />
					{t("Club Invitations")}
				</CardTitle>
				<CardDescription>
					{inviteCode
						? t("You've been invited to join this club")
						: t("You have pending invitations to join this club")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{inviteCode ? (
					// Handle URL-based invite
					<div className="flex gap-3">
						<Button
							onClick={() => handleAccept(inviteCode)}
							disabled={isLoading}
							className="flex items-center gap-2"
							variant="default"
						>
							<CheckCircle className="size-4" />
							{t("Accept Invite")}
						</Button>
						<Button
							onClick={() => handleDismiss(inviteCode)}
							disabled={isLoading}
							variant="outline"
							className="flex items-center gap-2"
						>
							<XCircle className="size-4" />
							{t("Dismiss")}
						</Button>
					</div>
				) : (
					// Handle multiple invites from props
					<div className="space-y-3">
						{allInvites.map((invite) => (
							<div
								key={invite.inviteCode}
								className="flex items-center justify-between p-3 border rounded-md"
							>
								<div>
									<p className="font-medium">{invite.club.name}</p>
									<p className="text-sm text-muted-foreground">{t("Club invitation")}</p>
								</div>
								<div className="flex gap-2">
									<Button
										onClick={() => handleAccept(invite.inviteCode)}
										disabled={isLoading}
										size="sm"
										className="flex items-center gap-2"
										variant="default"
									>
										<CheckCircle className="size-3" />
										{t("Accept")}
									</Button>
									<Button
										onClick={() => handleDismiss(invite.inviteCode)}
										disabled={isLoading}
										size="sm"
										variant="outline"
										className="flex items-center gap-2"
									>
										<XCircle className="size-3" />
										{t("Dismiss")}
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
