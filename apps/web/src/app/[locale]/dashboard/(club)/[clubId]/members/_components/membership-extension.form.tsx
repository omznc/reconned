"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, formatDistanceToNow } from "date-fns";
import { bs, enUS } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import apiClient from "@/lib/api/api.client";
import type { ClubMembership } from "@/lib/api/api-type-helpers";

interface MembershipExtensionFormProps {
	clubId: string;
	membership: ClubMembership & {
		user: {
			name: string;
			image?: string | null;
		};
	};
	variant?: "button" | "icon" | "menuItem";
	icon?: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function MembershipExtensionForm({
	clubId,
	membership,
	variant = "button",
	icon,
	open,
	onOpenChange,
}: MembershipExtensionFormProps) {
	const t = useExtracted();
	const locale = useLocale();
	const router = useRouter();

	const membershipExtensionSchema = z.object({
		clubId: z.string().min(1),
		memberId: z.string().min(1),
		duration: z.enum(["1", "3", "6", "12"], {
			error: t("Please select a duration"),
		}),
	});

	type MembershipExtensionFormValues = z.infer<typeof membershipExtensionSchema>;
	const [isLocalOpen, setIsLocalOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	// Use the controlled state if provided, otherwise use local state
	const isOpen = open !== undefined ? open : isLocalOpen;
	const setIsOpen = (value: boolean) => {
		if (onOpenChange) {
			onOpenChange(value);
		} else {
			setIsLocalOpen(value);
		}
	};

	const dateFnsLocale = locale === "en" ? enUS : bs;

	const form = useForm<MembershipExtensionFormValues>({
		resolver: zodResolver(membershipExtensionSchema),
		defaultValues: {
			clubId,
			memberId: membership.id,
			duration: "1",
		},
	});

	async function onSubmit(data: MembershipExtensionFormValues) {
		setIsLoading(true);

		try {
			const { error } = await apiClient.PUT("/api/clubs/{id}/members/{memberId}/extend", {
				params: {
					path: {
						id: clubId,
						memberId: data.memberId,
					},
				},
				body: {
					duration: data.duration,
				},
			});

			if (error) {
				toast.error(error.error || t("There was an error while extending the membership"));
				return;
			}

			toast.success(t("Membership successfully extended for {user}", { user: membership.user.name }));
			router.refresh();
			setIsOpen(false);
		} catch {
			toast.error(t("There was an error while extending the membership"));
		} finally {
			setIsLoading(false);
		}
	}

	const getMembershipStatus = (membership: ClubMembership) => {
		const today = new Date();

		if (!(membership.startDate || membership.endDate)) {
			return {
				label: t("Unlimited"),
				variant: "default",
			} as const;
		}

		if (membership.endDate && new Date(membership.endDate) < today) {
			return {
				label: t("Expired"),
				variant: "outline",
			} as const;
		}

		if (membership.endDate) {
			// Check if membership expires within 30 days
			const thirtyDaysFromNow = new Date();
			thirtyDaysFromNow.setDate(today.getDate() + 30);

			if (new Date(membership.endDate) < thirtyDaysFromNow) {
				return {
					label: t("Expires soon"),
					variant: "secondary",
				} as const;
			}

			return {
				label: t("Active"),
				variant: "default",
			} as const;
		}

		return {
			label: t("Active"),
			variant: "default",
		} as const;
	};

	const membershipStatus = getMembershipStatus(membership);

	// Create a trigger element based on the variant
	const renderTrigger = () => {
		if (variant === "button") {
			return (
				<Button variant="outline" size="sm">
					<CalendarClock className="mr-2 h-4 w-4" /> {t("Extend")}
				</Button>
			);
		}
		if (variant === "icon") {
			return (
				<Button variant="ghost" size="sm">
					<CalendarClock className="h-4 w-4" />
				</Button>
			);
		}
		if (variant === "menuItem") {
			return (
				<button type="button" className="flex items-center w-full text-left">
					{icon || <CalendarClock className="size-4 mr-2" />}
					{t("Extend")}
				</button>
			);
		}

		return null;
	};

	return (
		<Credenza open={isOpen} onOpenChange={setIsOpen}>
			{/* Only render the trigger if we're not using controlled open state from parent */}
			{open === undefined && <CredenzaTrigger asChild>{renderTrigger()}</CredenzaTrigger>}
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("Extend membership")}</CredenzaTitle>
					<p className="text-sm text-muted-foreground">
						{t("Extend membership for user {user}", {
							user: membership.user.name,
						})}
					</p>
				</CredenzaHeader>
				<CredenzaBody>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<div className="font-medium">{t("Current status")}</div>
							<div className="text-sm">
								<Badge variant={membershipStatus.variant}>{membershipStatus.label}</Badge>
							</div>
						</div>

						{membership.startDate && (
							<div className="grid gap-2">
								<div className="font-medium">{t("Start date")}</div>
								<div className="text-sm flex items-center gap-2">
									<span>
										{format(membership.startDate, "PPP", {
											locale: dateFnsLocale,
										})}
									</span>
									<span className="text-xs text-muted-foreground">
										(
										{formatDistanceToNow(membership.startDate, {
											addSuffix: true,
											locale: dateFnsLocale,
										})}
										)
									</span>
								</div>
							</div>
						)}

						{membership.endDate && (
							<div className="grid gap-2">
								<div className="font-medium">{t("End date")}</div>
								<div className="text-sm flex items-center gap-2">
									<span>
										{format(membership.endDate, "PPP", {
											locale: dateFnsLocale,
										})}
									</span>
									<span className="text-xs text-muted-foreground">
										(
										{formatDistanceToNow(membership.endDate, {
											addSuffix: true,
											locale: dateFnsLocale,
										})}
										)
									</span>
								</div>
							</div>
						)}

						<Form {...form}>
							<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
								<FormField
									control={form.control}
									name="duration"
									render={({ field }) => (
										<FormItem>
											<FormLabel>{t("Extension duration")}</FormLabel>
											<Select onValueChange={field.onChange} defaultValue={field.value}>
												<SelectTrigger>
													<SelectValue placeholder={t("Select duration")} />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="1">{t("1 month")}</SelectItem>
													<SelectItem value="3">{t("3 months")}</SelectItem>
													<SelectItem value="6">{t("6 months")}</SelectItem>
													<SelectItem value="12">{t("1 year")}</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</form>
						</Form>
					</div>
				</CredenzaBody>

				<CredenzaFooter>
					<Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
						{t("Cancel")}
					</Button>
					<Button type="submit" disabled={isLoading} onClick={form.handleSubmit(onSubmit)}>
						{isLoading ? t("Saving...") : t("Save")}
					</Button>
				</CredenzaFooter>
			</CredenzaContent>
		</Credenza>
	);
}
