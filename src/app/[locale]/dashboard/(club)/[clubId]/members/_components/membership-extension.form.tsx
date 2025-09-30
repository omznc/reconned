"use client";

import type { ClubMembership } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, formatDistanceToNow } from "date-fns";
import { bs, enUS } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	type MembershipExtensionFormValues,
	membershipExtensionSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.schema";
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
import { extendMembership } from "./membership-extension.action.ts";

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
	const t = useTranslations();
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

			toast.success(t("components.membershipExtension.success", { user: membership.user.name }));

			setIsOpen(false);
		} catch {
			toast.error(t("components.membershipExtension.failedToExtend"));
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
					<CalendarClock className="mr-2 h-4 w-4" /> {t("components.membershipExtension.extendMembership")}
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
					{t("components.membershipExtension.extendMembership")}
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
					<CredenzaTitle>{t("components.membershipExtension.extendMembershipTitle")}</CredenzaTitle>
					<p className="text-sm text-muted-foreground">
						{t("components.membershipExtension.extendMembershipDescription", {
							user: membership.user.name,
						})}
					</p>
				</CredenzaHeader>
				<CredenzaBody>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<div className="font-medium">{t("components.membershipExtension.currentStatus")}</div>
							<div className="text-sm">
								<Badge variant={membershipStatus.variant}>{membershipStatus.label}</Badge>
							</div>
						</div>

						{membership.startDate && (
							<div className="grid gap-2">
								<div className="font-medium">{t("components.membershipExtension.startDate")}</div>
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
								<div className="font-medium">{t("components.membershipExtension.endDate")}</div>
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
											<FormLabel>
												{t("components.membershipExtension.extensionDuration")}
											</FormLabel>
											<Select onValueChange={field.onChange} defaultValue={field.value}>
												<SelectTrigger>
													<SelectValue
														placeholder={t("components.membershipExtension.selectDuration")}
													/>
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="1">
														{t("components.membershipExtension.oneMonth")}
													</SelectItem>
													<SelectItem value="3">
														{t("components.membershipExtension.threeMonths")}
													</SelectItem>
													<SelectItem value="6">
														{t("components.membershipExtension.sixMonths")}
													</SelectItem>
													<SelectItem value="12">
														{t("components.membershipExtension.oneYear")}
													</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<CredenzaFooter>
									<Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
										{t("common.actions.cancel")}
									</Button>
									<Button type="submit" disabled={isLoading}>
										{isLoading ? t("common.actions.saving") : t("common.actions.save")}
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
			label: t("components.membershipExtension.unlimited"),
			variant: "default",
		} as const;
	}

	if (membership.endDate && new Date(membership.endDate) < today) {
		return {
			label: t("components.membershipExtension.expired"),
			variant: "outline",
		} as const;
	}

	if (membership.endDate) {
		// Check if membership expires within 30 days
		const thirtyDaysFromNow = new Date();
		thirtyDaysFromNow.setDate(today.getDate() + 30);

		if (new Date(membership.endDate) < thirtyDaysFromNow) {
			return {
				label: t("components.membershipExtension.expiringSoon"),
				variant: "secondary",
			} as const;
		}

		return {
			label: t("components.membershipExtension.active"),
			variant: "default",
		} as const;
	}

	return {
		label: t("components.membershipExtension.active"),
		variant: "default",
	} as const;
}
