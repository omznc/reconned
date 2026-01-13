"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type Country = ApiResponse<"/api/countries", "get">[number];
type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

interface EditAllianceDialogProps {
	alliance: AdminAlliance;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditAllianceDialog({ alliance, open, onOpenChange }: EditAllianceDialogProps) {
	const t = useExtracted();
	const router = useRouter();
	const queryClient = useQueryClient();

	const allianceFormSchema = z.object({
		name: z.string().min(1, t("Alliance name is required")).max(100),
		description: z.string().max(1000).optional(),
		countryId: z.number({ message: t("Country is required") }),
	});

	const form = useForm<z.infer<typeof allianceFormSchema>>({
		resolver: zodResolver(allianceFormSchema),
		defaultValues: {
			name: alliance.name,
			description: alliance.description || "",
			countryId: alliance.countryId,
		},
	});

	// Reset form when alliance changes
	useEffect(() => {
		form.reset({
			name: alliance.name,
			description: alliance.description || "",
			countryId: alliance.countryId,
		});
	}, [alliance, form]);

	// Fetch countries
	const { data: countriesData = [] } = useQuery({
		queryKey: ["countries"],
		queryFn: async () => {
			const response = await apiClient.GET("/api/countries", {});
			return (response.data || []) as Country[];
		},
	});

	const countries = countriesData;

	const updateMutation = useMutation({
		mutationFn: async (values: z.infer<typeof allianceFormSchema>) => {
			const response = await apiClient.PUT("/api/admin/alliances/{id}", {
				params: {
					path: { id: alliance.id },
				},
				body: values,
			});
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin", "alliances"] });
			toast.success(t("Alliance updated successfully"));
			onOpenChange(false);
			router.refresh();
		},
		onError: (error) => {
			console.error("Failed to update alliance:", error);
			toast.error(t("Failed to update alliance"));
		},
	});

	const onSubmit = (values: z.infer<typeof allianceFormSchema>) => {
		updateMutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("Edit Alliance")}</DialogTitle>
					<DialogDescription>{t("Update alliance information")}</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("Alliance Name")}</FormLabel>
									<FormControl>
										<Input placeholder={t("Enter alliance name")} {...field} />
									</FormControl>
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
										<Textarea placeholder={t("Enter alliance description")} {...field} />
									</FormControl>
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
											{countries.map((country) => (
												<SelectItem key={country.id} value={country.id.toString()}>
													{country.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										{t("Select the country this alliance belongs to")}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								{t("Cancel")}
							</Button>
							<Button type="submit" disabled={updateMutation.isPending}>
								{updateMutation.isPending ? t("Saving...") : t("Save Changes")}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
