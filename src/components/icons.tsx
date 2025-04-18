"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, UserCog, VerifiedIcon, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";

export function AdminIcon() {
	const t = useTranslations("components.icons");

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<Wrench className="h-4 w-4 mt-[1px] text-red-500" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("administrator")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function VerifiedClubIcon() {
	const t = useTranslations("components.icons");

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<VerifiedIcon className="h-4 w-4 mt-[1px] text-red-500" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("verifiedClub")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClubOwnerIcon() {
	const t = useTranslations("components.icons");

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<Crown className="h-4 w-4 mt-[1px] text-black dark:text-white" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("clubOwner")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClubManagerIcon() {
	const t = useTranslations("components.icons");

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<UserCog className="h-4 w-4 mt-[1px] text-black dark:text-white" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("clubManager")}</p>
			</TooltipContent>
		</Tooltip>
	);
}
