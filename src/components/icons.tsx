"use client";

import { Crown, UserCog, VerifiedIcon, Wrench } from "lucide-react";
import { useExtracted } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AdminIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<Wrench className="h-4 w-4 mt-[1px] text-red-500" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Administrator")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function VerifiedClubIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<VerifiedIcon className="h-4 w-4 mt-[1px] text-red-500" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Verified club")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClubOwnerIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<Crown className="h-4 w-4 mt-[1px] text-black dark:text-white" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Club owner")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClubManagerIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<UserCog className="h-4 w-4 mt-[1px] text-black dark:text-white" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Club manager")}</p>
			</TooltipContent>
		</Tooltip>
	);
}
