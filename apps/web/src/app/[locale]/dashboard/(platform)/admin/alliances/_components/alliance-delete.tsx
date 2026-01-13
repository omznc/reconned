"use client";

import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type Alliance = ApiResponse<"/api/admin/alliances/{id}", "get">["alliance"];

interface AllianceDeleteProps {
	alliance?: Alliance;
}

export function AllianceDelete({ alliance }: AllianceDeleteProps) {
	const [mode, setMode] = useQueryState("mode", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const [, setAllianceId] = useQueryState("allianceId", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const [isDeleting, setIsDeleting] = useState(false);
	const t = useExtracted();
	const router = useRouter();

	const isOpen = mode === "delete" && Boolean(alliance);

	const handleDelete = async () => {
		if (!alliance) return;

		setIsDeleting(true);
		try {
			const { error } = await apiClient.DELETE("/api/admin/alliances/{id}", {
				params: {
					path: { id: alliance.id },
				},
			});

			if (error) {
				toast.error(t("Failed to delete alliance"));
				return;
			}

			toast.success(t("Alliance deleted successfully"));
			setMode(null);
			setAllianceId(null);
			router.refresh();
		} catch (error) {
			console.error("Error deleting alliance:", error);
			toast.error(t("An error occurred"));
		} finally {
			setIsDeleting(false);
		}
	};

	const handleClose = () => {
		setMode(null);
		setAllianceId(null);
	};

	const clubCount = alliance?.clubAlliances?.length || 0;

	return (
		<Credenza open={isOpen} onOpenChange={handleClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("Delete alliance")}</CredenzaTitle>
					<CredenzaDescription>
						{clubCount > 0
							? t(
									"This alliance has {count} club(s). Are you sure you want to delete it? This action cannot be undone.",
									{ count: clubCount.toString() },
								)
							: t("Are you sure you want to delete this alliance? This action cannot be undone.")}
					</CredenzaDescription>
				</CredenzaHeader>

				{alliance && (
					<div className="py-4">
						<div className="rounded-lg border p-4 bg-muted/50">
							<div className="font-medium">{alliance.name}</div>
							<div className="text-sm text-muted-foreground mt-1">
								{alliance.country.iso2} - {alliance.country.name}
							</div>
							{alliance.description && (
								<div className="text-sm text-muted-foreground mt-2">{alliance.description}</div>
							)}
							{clubCount > 0 && (
								<div className="text-sm text-orange-600 mt-2 font-medium">
									⚠️{" "}
									{t("{count} club(s) will be removed from this alliance", {
										count: clubCount.toString(),
									})}
								</div>
							)}
						</div>
					</div>
				)}

				<CredenzaFooter>
					<Button type="button" variant="outline" onClick={handleClose} disabled={isDeleting}>
						{t("Cancel")}
					</Button>
					<Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
						{isDeleting ? t("Deleting...") : t("Delete")}
					</Button>
				</CredenzaFooter>
			</CredenzaContent>
		</Credenza>
	);
}
