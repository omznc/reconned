"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type Alliance = ApiResponse<"/api/admin/alliances/{id}", "get">["alliance"];
type Country = ApiResponse<"/api/countries", "get">[number];

const allianceFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	description: z.string().max(1000).optional(),
	countryId: z.number({ message: "Country is required" }),
});

type AllianceFormValues = z.infer<typeof allianceFormSchema>;

interface AllianceFormProps {
	alliance?: Alliance;
}

export function AllianceForm({ alliance }: AllianceFormProps) {
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
	const t = useExtracted();
	const router = useRouter();

	const form = useForm<AllianceFormValues>({
		resolver: zodResolver(allianceFormSchema),
		defaultValues: {
			name: alliance?.name || "",
			description: alliance?.description || "",
			countryId: alliance?.countryId || undefined,
		},
	});

	// Fetch countries
	const { data: countriesData = [] } = useQuery({
		queryKey: ["countries"],
		queryFn: async () => {
			const response = await apiClient.GET("/api/countries", {});
			return (response.data || []) as Country[];
		},
	});

	const isEdit = mode === "edit" && alliance;
	const isOpen = mode === "create" || mode === "edit";

	const onSubmit = async (data: AllianceFormValues) => {
		try {
			if (isEdit && alliance) {
				const { error } = await apiClient.PUT("/api/admin/alliances/{id}", {
					params: {
						path: { id: alliance.id },
					},
					body: data,
				});

				if (error) {
					toast.error(t("Failed to update alliance"));
					return;
				}

				toast.success(t("Alliance updated successfully"));
			} else {
				const { error } = await apiClient.POST("/api/admin/alliances", {
					body: data,
				});

				if (error) {
					toast.error(t("Failed to create alliance"));
					return;
				}

				toast.success(t("Alliance created successfully"));
			}

			setMode(null);
			setAllianceId(null);
			form.reset();
			router.refresh();
		} catch (error) {
			console.error("Error saving alliance:", error);
			toast.error(t("An error occurred"));
		}
	};

	const handleClose = () => {
		setMode(null);
		setAllianceId(null);
		form.reset();
	};

	return (
		<Credenza open={isOpen} onOpenChange={handleClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{isEdit ? t("Edit alliance") : t("Create alliance")}</CredenzaTitle>
					<CredenzaDescription>
						{isEdit ? t("Update the alliance details") : t("Create a new alliance for clubs to join")}
					</CredenzaDescription>
				</CredenzaHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("Name")}</FormLabel>
									<FormControl>
										<Input placeholder={t("e.g., National Airsoft Alliance")} {...field} />
									</FormControl>
									<FormDescription>{t("The name of the alliance")}</FormDescription>
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
											placeholder={t("Describe the purpose of this alliance...")}
											{...field}
										/>
									</FormControl>
									<FormDescription>{t("Optional description of the alliance")}</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="countryId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("Country")}</FormLabel>
									<Select
										onValueChange={(value) => field.onChange(Number(value))}
										value={field.value?.toString()}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t("Select a country")} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{countriesData.map((country) => (
												<SelectItem key={country.id} value={country.id.toString()}>
													{country.emoji} {country.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>{t("The country this alliance belongs to")}</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<CredenzaFooter>
							<Button type="button" variant="outline" onClick={handleClose}>
								{t("Cancel")}
							</Button>
							<Button type="submit" disabled={form.formState.isSubmitting}>
								{form.formState.isSubmitting ? t("Saving...") : isEdit ? t("Update") : t("Create")}
							</Button>
						</CredenzaFooter>
					</form>
				</Form>
			</CredenzaContent>
		</Credenza>
	);
}
