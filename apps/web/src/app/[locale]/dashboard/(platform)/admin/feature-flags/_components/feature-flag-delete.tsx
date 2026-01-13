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

type FeatureFlag = ApiResponse<"/api/admin/feature-flags/{id}", "get">;

interface FeatureFlagDeleteProps {
	flag?: FeatureFlag;
}

export function FeatureFlagDelete({ flag }: FeatureFlagDeleteProps) {
	const [mode, setMode] = useQueryState("mode", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const [, setFlagId] = useQueryState("flagId", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const [isDeleting, setIsDeleting] = useState(false);
	const t = useExtracted();
	const router = useRouter();

	const isOpen = mode === "delete" && Boolean(flag);

	const handleDelete = async () => {
		if (!flag) return;

		setIsDeleting(true);
		try {
			const { error } = await apiClient.DELETE("/api/admin/feature-flags/{id}", {
				params: {
					path: { id: flag.id },
				},
			});

			if (error) {
				toast.error(t("Failed to delete feature flag"));
				return;
			}

			toast.success(t("Feature flag deleted successfully"));
			setMode(null);
			setFlagId(null);
			router.refresh();
		} catch (error) {
			console.error("Error deleting feature flag:", error);
			toast.error(t("An error occurred"));
		} finally {
			setIsDeleting(false);
		}
	};

	const handleClose = () => {
		setMode(null);
		setFlagId(null);
	};

	return (
		<Credenza open={isOpen} onOpenChange={handleClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("Delete feature flag")}</CredenzaTitle>
					<CredenzaDescription>
						{t("Are you sure you want to delete this feature flag? This action cannot be undone.")}
					</CredenzaDescription>
				</CredenzaHeader>

				{flag && (
					<div className="py-4">
						<div className="rounded-lg border p-4 bg-muted/50">
							<div className="font-medium">{flag.name}</div>
							{flag.description && (
								<div className="text-sm text-muted-foreground mt-1">{flag.description}</div>
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
