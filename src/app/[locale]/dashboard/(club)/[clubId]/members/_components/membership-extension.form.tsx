"use client";

import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { extendMembership } from "./membership-extension.action";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
	CredenzaFooter,
} from "@/components/ui/credenza";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CalendarClock } from "lucide-react";
import type { ClubMembership } from "@prisma/client";
import { toast } from "sonner";
import {
	membershipExtensionSchema,
	type MembershipExtensionFormValues,
} from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.schema";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, bs } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

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
	onOpenChange
}: MembershipExtensionFormProps) {
	const t = useTranslations("components.membershipExtension");
	const locale = useLocale();
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
			const result = await extendMembership(data);

			if (result?.serverError) {
				toast.error(result.serverError);
				return;
			}

			toast.success(t("success", { user: membership.user.name }));

			setIsOpen(false);
		} catch (error) {
			toast.error(t("error"));
		} finally {
			setIsLoading(false);
		}
	}

	const membershipStatus = getMembershipStatus(membership, t);

	// Create a trigger element based on the variant
	const renderTrigger = () => {
		if (variant === "button") {
			return (
				<Button variant="outline" size="sm">
					<CalendarClock className="mr-2 h-4 w-4" /> {t("extendMembership")}
				</Button>
			);
		} if (variant === "icon") {
			return (
				<Button variant="ghost" size="sm">
					<CalendarClock className="h-4 w-4" />
				</Button>
			);
		} if (variant === "menuItem") {
			return (
				<button type="button" className="flex items-center w-full text-left">
					{icon || <CalendarClock className="size-4 mr-2" />}
					{t("extendMembership")}
				</button>
			);
		}

		return null;
	};

	return (
		<Credenza open={isOpen} onOpenChange={setIsOpen}>
			{/* Only render the trigger if we're not using controlled open state from parent */}
			{open === undefined && (
				<CredenzaTrigger asChild>
					{renderTrigger()}
				</CredenzaTrigger>
			)}
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("extendMembershipTitle")}</CredenzaTitle>
					<p className="text-sm text-muted-foreground">
						{t("extendMembershipDescription", {
							user: membership.user.name,
						})}
					</p>
				</CredenzaHeader>
				<CredenzaBody>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<div className="font-medium">{t("currentStatus")}</div>
							<div className="text-sm">
								<Badge variant={membershipStatus.variant}>{membershipStatus.label}</Badge>
							</div>
						</div>

						{membership.startDate && (
							<div className="grid gap-2">
								<div className="font-medium">{t("startDate")}</div>
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
								<div className="font-medium">{t("endDate")}</div>
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
											<FormLabel>{t("extensionDuration")}</FormLabel>
											<Select onValueChange={field.onChange} defaultValue={field.value}>
												<SelectTrigger>
													<SelectValue placeholder={t("selectDuration")} />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="1">{t("oneMonth")}</SelectItem>
													<SelectItem value="3">{t("threeMonths")}</SelectItem>
													<SelectItem value="6">{t("sixMonths")}</SelectItem>
													<SelectItem value="12">{t("oneYear")}</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<CredenzaFooter>
									<Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
										{t("cancel")}
									</Button>
									<Button type="submit" disabled={isLoading}>
										{isLoading ? t("extending") : t("extend")}
									</Button>
								</CredenzaFooter>
							</form>
						</Form>
					</div>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}

function getMembershipStatus(
	membership: ClubMembership,
	t: (key: string) => string, // I wish I typed this, but hey
) {
	const today = new Date();

	if (!(membership.startDate || membership.endDate)) {
		return {
			label: t("unlimited"),
			variant: "default",
		} as const;
	}

	if (membership.endDate && new Date(membership.endDate) < today) {
		return {
			label: t("expired"),
			variant: "outline",
		} as const;
	}

	if (membership.endDate) {
		// Check if membership expires within 30 days
		const thirtyDaysFromNow = new Date();
		thirtyDaysFromNow.setDate(today.getDate() + 30);

		if (new Date(membership.endDate) < thirtyDaysFromNow) {
			return {
				label: t("expiringSoon"),
				variant: "secondary",
			} as const;
		}

		return {
			label: t("active"),
			variant: "default",
		} as const;
	}

	return {
		label: t("active"),
		variant: "default",
	} as const;
}
