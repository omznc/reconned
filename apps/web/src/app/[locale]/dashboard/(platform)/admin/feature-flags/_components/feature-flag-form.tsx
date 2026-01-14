"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type FeatureFlag = ApiResponse<"/api/admin/feature-flags/{id}", "get">;

interface FeatureFlagFormProps {
	flag?: FeatureFlag;
}

export function FeatureFlagForm({ flag }: FeatureFlagFormProps) {
	const [flagId, setFlagId] = useQueryState("flagId", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const t = useExtracted();
	const router = useRouter();

	const featureFlagFormSchema = z.object({
		name: z
			.string()
			.min(1, t("Name is required"))
			.regex(/^[A-Z_]+$/, t("Name must be uppercase with underscores only (e.g., MY_FEATURE_FLAG)"))
			.transform((val) => val.toUpperCase().replace(/[^A-Z_]/g, "_")),
		description: z.string().optional(),
		enabled: z.boolean(),
	});

	type FeatureFlagFormValues = z.infer<typeof featureFlagFormSchema>;

	const form = useForm<FeatureFlagFormValues>({
		resolver: zodResolver(featureFlagFormSchema),
		defaultValues: {
			name: flag?.name || "",
			description: flag?.description || "",
			enabled: flag?.enabled || false,
		},
	});

	const isEdit = flagId !== "new" && Boolean(flag);
	const isOpen = flagId === "new" || Boolean(flag);

	const onSubmit = async (data: FeatureFlagFormValues) => {
		try {
			if (isEdit && flag) {
				const { error } = await apiClient.PUT("/api/admin/feature-flags/{id}", {
					params: {
						path: { id: flag.id },
					},
					body: data,
				});

				if (error) {
					toast.error(t("Failed to update feature flag"));
					return;
				}

				toast.success(t("Feature flag updated successfully"));
			} else {
				const { error } = await apiClient.POST("/api/admin/feature-flags", {
					body: data,
				});

				if (error) {
					toast.error(t("Failed to create feature flag"));
					return;
				}

				toast.success(t("Feature flag created successfully"));
			}

			setFlagId(null);
			form.reset();
			router.refresh();
		} catch (error) {
			console.error("Error saving feature flag:", error);
			toast.error(t("An error occurred"));
		}
	};

	const handleClose = () => {
		setFlagId(null);
		form.reset();
	};

	return (
		<Credenza open={isOpen} onOpenChange={handleClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{isEdit ? t("Edit feature flag") : t("Create feature flag")}</CredenzaTitle>
					<CredenzaDescription>
						{isEdit
							? t("Update the feature flag settings")
							: t("Create a new feature flag for your application")}
					</CredenzaDescription>
				</CredenzaHeader>

				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("Name")}</FormLabel>
										<FormControl>
											<Input
												placeholder={t("e.g., NEW_DASHBOARD_UI")}
												{...field}
												onChange={(e) => {
													const value = e.target.value.toUpperCase().replace(/[^A-Z_]/g, "_");
													field.onChange(value);
												}}
												className="font-mono"
											/>
										</FormControl>
										<FormDescription>
											{t("Uppercase with underscores only (auto-formatted)")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("Description")}</FormLabel>
										<FormControl>
											<Textarea
												placeholder={t("Describe what this flag controls...")}
												{...field}
											/>
										</FormControl>
										<FormDescription>
											{t("Optional description of what this flag does")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="enabled"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">{t("Enabled")}</FormLabel>
											<FormDescription>{t("Turn this feature flag on or off")}</FormDescription>
										</div>
										<FormControl>
											<Switch checked={field.value} onCheckedChange={field.onChange} />
										</FormControl>
									</FormItem>
								)}
							/>
						</form>
					</Form>
				</CredenzaBody>

				<CredenzaFooter>
					<Button type="button" variant="outline" onClick={handleClose}>
						{t("Cancel")}
					</Button>
					<Button type="submit" disabled={form.formState.isSubmitting} onClick={form.handleSubmit(onSubmit)}>
						{form.formState.isSubmitting ? t("Saving...") : isEdit ? t("Update") : t("Create")}
					</Button>
				</CredenzaFooter>
			</CredenzaContent>
		</Credenza>
	);
}
